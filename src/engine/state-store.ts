/**
 * 状态存储
 * 管理场景状态的读写和持久化
 */

import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { GameTime, EnvironmentState, NPCState, Action, Resolution, PlotPoint, PlayerState, Quest, SceneState } from '../types/scene.js';
import type { SaveData, GameMode } from '../types/game.js';
import { v4 as uuidv4 } from 'uuid';
import { TIME, TIME_PERIODS, HISTORY, LIMITS, GAME } from '../constants.js';

// ============ 类型安全的路径类型定义 ============

type Primitive = string | number | boolean | null | undefined;

/**
 * 获取对象的所有路径（包括嵌套路径）
 * 用于类型安全的路径访问
 */
type Path<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Primitive
    ? K
    : T[K] extends (infer U)[]
      ? U extends Primitive
        ? K | `${K}[${number}]` | `${K}.${Path<T[K]>}`
        : K | `${K}[${number}]` | `${K}.${Path<U>}`
      : T[K] extends object
        ? K | `${K}.${Path<T[K]>}`
        : K
  : never;

/**
 * 根据路径获取对应的值类型
 */
type PathValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? Rest extends Path<T[K]>
        ? PathValue<T[K], Rest>
        : never
      : K extends `${infer ArrKey}[${number}]`
        ? ArrKey extends keyof T
          ? T[ArrKey] extends (infer U)[]
            ? PathValue<U, Rest>
            : never
          : never
        : never
    : P extends `${infer K}[${number}]`
      ? K extends keyof T
        ? T[K] extends (infer U)[]
          ? U
          : never
        : never
      : never;

/**
 * SceneState 的所有有效路径类型
 */
export type SceneStatePath = Path<SceneState>;

/**
 * 根据路径获取 SceneState 的值类型
 */
export type SceneStateValue<P extends SceneStatePath> = PathValue<SceneState, P>;

/** 默认场景状态 */
export function createDefaultSceneState(): SceneState {
  return {
    currentLocation: '起始之地',
    locationDescription: '你站在一个十字路口，四条道路向不同方向延伸。',
    presentNPCs: [],
    activePlots: [],
    playerActions: [],
    pendingResolutions: [],
    worldTime: {
      day: GAME.DEFAULT_DAY,
      hour: GAME.DEFAULT_HOUR,
      minute: GAME.DEFAULT_MINUTE,
      period: TIME_PERIODS.MORNING.name,
    },
    environment: {
      weather: '晴朗',
      lighting: '明亮的晨光',
      ambiance: '鸟鸣和微风',
      hazards: [],
    },
    playerState: {
      name: '冒险者',
      health: GAME.DEFAULT_HEALTH,
      maxHealth: GAME.DEFAULT_MAX_HEALTH,
      mana: GAME.DEFAULT_MANA,
      maxMana: GAME.DEFAULT_MAX_MANA,
      stamina: GAME.DEFAULT_STAMINA,
      maxStamina: GAME.DEFAULT_MAX_STAMINA,
      gold: 100, // 初始金币
      visitedLocations: ['起始之地'],
      explorationProgress: GAME.DEFAULT_EXPLORATION_PROGRESS,
      inventory: [
        {
          id: uuidv4(),
          name: '生锈的铁剑',
          description: '一把用来防身的旧武器',
          quantity: 1,
          type: 'weapon'
        },
        {
          id: uuidv4(),
          name: '微型治疗药水',
          description: '恢复少量生命值',
          quantity: 3,
          type: 'consumable'
        }
      ],
      quests: [],
    },
  };
}

export class StateStore {
  private state: SceneState;
  private savePath: string;

  constructor(savePath: string, initialState?: SceneState) {
    this.state = initialState ?? createDefaultSceneState();
    this.savePath = savePath;
  }

  /** 获取完整状态 */
  getState(): Readonly<SceneState> {
    return this.state;
  }

  /** 获取状态的可序列化摘要（用于传递给代理） */
  getContextSummary(): Record<string, unknown> {
    return {
      location: this.state.currentLocation,
      locationDesc: this.state.locationDescription,
      npcs: this.state.presentNPCs.map(n => `${n.name}(${n.disposition})`),
      time: `第${this.state.worldTime.day}天 ${this.state.worldTime.hour}:${String(this.state.worldTime.minute).padStart(2, '0')} (${this.state.worldTime.period})`,
      weather: this.state.environment.weather,
      recentActions: this.state.playerActions.slice(-HISTORY.RECENT_ACTIONS_COUNT).map(a => a.description),
      activePlots: this.state.activePlots.filter(p => p.status === 'active').map(p => p.name),
      inventory: this.state.playerState.inventory.map(i => `${i.name}x${i.quantity}`),
      quests: this.state.playerState.quests.map(q => `[${q.status}] ${q.title}: ${q.description}`),
    };
  }

  /** 更新状态（部分更新） */
  update(partial: Partial<SceneState>): void {
    this.state = { ...this.state, ...partial };
  }

  /** 深度更新嵌套状态 */
  patch<P extends SceneStatePath>(path: P, value: SceneStateValue<P>): void {
    const keys = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: any = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      // 处理数组索引访问，如 "inventory[0]"
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrKey, indexStr] = arrayMatch;
        target = target[arrKey];
        if (target === undefined) return;
        target = target[parseInt(indexStr, 10)];
      } else {
        target = target[key];
      }
      if (target === undefined) return;
    }
    target[keys[keys.length - 1]] = value;
  }

  /** 推进游戏时间 */
  advanceTime(minutes: number): void {
    let totalMinutes = this.state.worldTime.hour * TIME.MINUTES_PER_HOUR + this.state.worldTime.minute + minutes;
    const extraDays = Math.floor(totalMinutes / TIME.MINUTES_PER_DAY);
    totalMinutes = totalMinutes % TIME.MINUTES_PER_DAY;

    const hour = Math.floor(totalMinutes / TIME.MINUTES_PER_HOUR);
    const minute = totalMinutes % TIME.MINUTES_PER_HOUR;

    let period: SceneState['worldTime']['period'];
    if (hour >= TIME_PERIODS.DAWN.start && hour < TIME_PERIODS.DAWN.end) period = TIME_PERIODS.DAWN.name;
    else if (hour >= TIME_PERIODS.MORNING.start && hour < TIME_PERIODS.MORNING.end) period = TIME_PERIODS.MORNING.name;
    else if (hour >= TIME_PERIODS.NOON.start && hour < TIME_PERIODS.NOON.end) period = TIME_PERIODS.NOON.name;
    else if (hour >= TIME_PERIODS.AFTERNOON.start && hour < TIME_PERIODS.AFTERNOON.end) period = TIME_PERIODS.AFTERNOON.name;
    else if (hour >= TIME_PERIODS.DUSK.start && hour < TIME_PERIODS.DUSK.end) period = TIME_PERIODS.DUSK.name;
    else if (hour >= TIME_PERIODS.EVENING.start && hour < TIME_PERIODS.EVENING.end) period = TIME_PERIODS.EVENING.name;
    else if (hour >= TIME_PERIODS.NIGHT.start || hour < TIME_PERIODS.NIGHT.end) period = TIME_PERIODS.NIGHT.name;
    else period = TIME_PERIODS.MIDNIGHT.name;

    this.state.worldTime = {
      day: this.state.worldTime.day + extraDays,
      hour,
      minute,
      period,
    };
  }

  /** 保存存档 */
  async save(name: string, mode: GameMode): Promise<string> {
    const id = uuidv4();
    const saveData: SaveData = {
      id,
      name,
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sceneState: this.state,
      history: [],
      metadata: {},
    };

    const dir = join(this.savePath, 'saves');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const filePath = join(dir, `${id}.json`);
    await writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
    return id;
  }

  /** 加载存档 */
  async load(id: string): Promise<SaveData> {
    const filePath = join(this.savePath, 'saves', `${id}.json`);
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as SaveData;
    this.state = data.sceneState as SceneState;
    return data;
  }

  async listSaves(limit: number = LIMITS.SAVES_LIST_DEFAULT): Promise<Array<Pick<SaveData, 'id' | 'name' | 'mode' | 'createdAt' | 'updatedAt'>>> {
    const dir = join(this.savePath, 'saves');
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter(f => f.endsWith('.json')).slice(0, LIMITS.SAVES_FILE_SCAN_MAX);
    const saves: Array<Pick<SaveData, 'id' | 'name' | 'mode' | 'createdAt' | 'updatedAt'>> = [];
    for (const f of files) {
      try {
        const raw = await readFile(join(dir, f), 'utf-8');
        const data = JSON.parse(raw) as SaveData;
        if (!data?.id || !data?.name || !data?.mode) continue;
        saves.push({
          id: data.id,
          name: data.name,
          mode: data.mode,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      } catch {}
    }
    saves.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return saves.slice(0, Math.max(1, Math.min(limit, LIMITS.SAVES_LIST_MAX)));
  }

  /** 重置状态 */
  reset(): void {
    this.state = createDefaultSceneState();
  }

  /** 删除存档 */
  async deleteSave(id: string): Promise<void> {
    const filePath = join(this.savePath, 'saves', `${id}.json`);
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
    }
  }
}
