/**
 * NPC 日程管理器
 * 管理 NPC 的日程安排，处理 NPC 的出现和离开
 */

import type { GameTime } from '../types/scene.js';
import type {
  NPCSchedule,
  NPCScheduleEntry,
  NPCPresenceEvent,
  ScheduleManagerConfig,
} from '../types/schedule.js';

const DEFAULT_CONFIG: ScheduleManagerConfig = {
  checkInterval: 1,
  enableRandomVariation: true,
  variationChance: 0.1,
};

export class ScheduleManager {
  private schedules = new Map<string, NPCSchedule>();
  private config: ScheduleManagerConfig;
  private lastCheckTurn = 0;
  private currentTurn = 0;
  private currentTime: GameTime | null = null;

  constructor(config: Partial<ScheduleManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 注册 NPC 日程 */
  registerSchedule(schedule: NPCSchedule): void {
    this.schedules.set(schedule.npcId, schedule);
  }

  /** 获取 NPC 日程 */
  getSchedule(npcId: string): NPCSchedule | undefined {
    return this.schedules.get(npcId);
  }

  /** 获取所有日程 */
  getAllSchedules(): NPCSchedule[] {
    return Array.from(this.schedules.values());
  }

  /** 设置当前时间 */
  setCurrentTime(time: GameTime): void {
    this.currentTime = time;
  }

  /** 设置当前回合 */
  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /** 获取当前时间段的日程条目 */
  private getCurrentEntry(schedule: NPCSchedule): NPCScheduleEntry | null {
    if (!this.currentTime) return null;

    const currentHour = this.currentTime.hour;

    // 查找匹配当前时间的条目
    for (const entry of schedule.entries) {
      if (entry.startHour <= entry.endHour) {
        // 正常情况（如 8:00-12:00）
        if (currentHour >= entry.startHour && currentHour < entry.endHour) {
          return entry;
        }
      } else {
        // 跨午夜情况（如 22:00-2:00）
        if (currentHour >= entry.startHour || currentHour < entry.endHour) {
          return entry;
        }
      }
    }

    return null;
  }

  /** 获取 NPC 当前状态 */
  getNPCCurrentState(npcId: string): {
    activity: string;
    location: string;
    isPresent: boolean;
    mood?: string;
  } | null {
    const schedule = this.schedules.get(npcId);
    if (!schedule) return null;

    const entry = this.getCurrentEntry(schedule);

    if (entry) {
      return {
        activity: entry.activity,
        location: entry.location,
        isPresent: entry.isPresent,
        mood: entry.mood,
      };
    }

    // 使用默认值
    return {
      activity: schedule.defaultActivity,
      location: schedule.defaultLocation,
      isPresent: true,
    };
  }

  /** 检查日程变化，返回出现/离开事件 */
  checkScheduleChanges(previousStates: Map<string, boolean>): NPCPresenceEvent[] {
    const events: NPCPresenceEvent[] = [];

    if (!this.currentTime) return events;

    for (const [npcId, schedule] of this.schedules) {
      const currentState = this.getNPCCurrentState(npcId);
      if (!currentState) continue;

      const wasPresent = previousStates.get(npcId) ?? true;
      const isPresent = currentState.isPresent;

      if (wasPresent && !isPresent) {
        // NPC 离开
        events.push({
          type: 'leave',
          npcId,
          npcName: schedule.npcName,
          time: this.currentTime,
          reason: `${schedule.npcName} ${currentState.activity}，离开了酒馆。`,
        });
      } else if (!wasPresent && isPresent) {
        // NPC 到达
        events.push({
          type: 'arrive',
          npcId,
          npcName: schedule.npcName,
          time: this.currentTime,
          reason: `${schedule.npcName} ${currentState.activity}，来到了酒馆。`,
        });
      }
    }

    return events;
  }

  /** 获取当前在场的 NPC 列表 */
  getPresentNPCs(): string[] {
    const present: string[] = [];

    for (const [npcId, schedule] of this.schedules) {
      const state = this.getNPCCurrentState(npcId);
      if (state?.isPresent) {
        present.push(npcId);
      }
    }

    return present;
  }

  /** 获取当前不在场的 NPC 列表 */
  getAbsentNPCs(): string[] {
    const absent: string[] = [];

    for (const [npcId, schedule] of this.schedules) {
      const state = this.getNPCCurrentState(npcId);
      if (!state?.isPresent) {
        absent.push(npcId);
      }
    }

    return absent;
  }

  /** 更新所有 NPC 状态（在每个回合调用） */
  update(): NPCPresenceEvent[] {
    // 检查是否需要更新（根据 checkInterval）
    if (this.currentTurn - this.lastCheckTurn < this.config.checkInterval) {
      return [];
    }

    this.lastCheckTurn = this.currentTurn;

    // 记录当前状态用于比较
    const previousStates = new Map<string, boolean>();
    for (const [npcId, schedule] of this.schedules) {
      const state = this.getNPCCurrentState(npcId);
      previousStates.set(npcId, state?.isPresent ?? true);
    }

    // 应用随机变化（如果启用）
    if (this.config.enableRandomVariation && Math.random() < this.config.variationChance) {
      this.applyRandomVariation();
    }

    // 检查变化并返回事件
    return this.checkScheduleChanges(previousStates);
  }

  /** 应用随机变化（让日程不那么死板） */
  private applyRandomVariation(): void {
    // 随机选择一些 NPC 稍微调整他们的活动时间
    // 这里可以实现更复杂的逻辑
    // 目前作为占位符
  }

  /** 加载预定义的日程模板 */
  loadScheduleTemplates(templates: Record<string, NPCSchedule>): void {
    for (const schedule of Object.values(templates)) {
      this.registerSchedule(schedule);
    }
  }

  /** 清除所有日程 */
  clear(): void {
    this.schedules.clear();
    this.lastCheckTurn = 0;
  }
}
