/**
 * 状态存储
 * 管理场景状态的读写和持久化
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { SceneState, SaveData, GameMode } from '../types/game.js';
import { v4 as uuidv4 } from 'uuid';

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
      day: 1,
      hour: 8,
      minute: 0,
      period: 'morning',
    },
    environment: {
      weather: '晴朗',
      lighting: '明亮的晨光',
      ambiance: '鸟鸣和微风',
      hazards: [],
    },
    playerState: {
      name: '冒险者',
      health: 100,
      inventory: [],
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
      recentActions: this.state.playerActions.slice(-3).map(a => a.description),
      activePlots: this.state.activePlots.filter(p => p.status === 'active').map(p => p.name),
    };
  }

  /** 更新状态（部分更新） */
  update(partial: Partial<SceneState>): void {
    this.state = { ...this.state, ...partial };
  }

  /** 深度更新嵌套状态 */
  patch(path: string, value: unknown): void {
    const keys = path.split('.');
    let target: any = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
      if (target === undefined) return;
    }
    target[keys[keys.length - 1]] = value;
  }

  /** 推进游戏时间 */
  advanceTime(minutes: number): void {
    let totalMinutes = this.state.worldTime.hour * 60 + this.state.worldTime.minute + minutes;
    const extraDays = Math.floor(totalMinutes / (24 * 60));
    totalMinutes = totalMinutes % (24 * 60);

    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    let period: SceneState['worldTime']['period'];
    if (hour >= 5 && hour < 7) period = 'dawn';
    else if (hour >= 7 && hour < 11) period = 'morning';
    else if (hour >= 11 && hour < 13) period = 'noon';
    else if (hour >= 13 && hour < 17) period = 'afternoon';
    else if (hour >= 17 && hour < 19) period = 'dusk';
    else if (hour >= 19 && hour < 22) period = 'evening';
    else if (hour >= 22 || hour < 1) period = 'night';
    else period = 'midnight';

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

  /** 重置状态 */
  reset(): void {
    this.state = createDefaultSceneState();
  }
}
