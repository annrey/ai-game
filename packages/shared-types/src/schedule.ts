/**
 * NPC 日程表类型定义
 * 用于管理 NPC 在不同时间的活动安排
 */

import type { GameTime } from './scene.js';

/** NPC 日程条目 */
export interface NPCScheduleEntry {
  /** 时间段开始（小时，0-23） */
  startHour: number;
  /** 时间段结束（小时，0-23） */
  endHour: number;
  /** 活动描述 */
  activity: string;
  /** 活动地点（如 'tavern', 'market', 'home'） */
  location: string;
  /** 是否在场（false 表示离开酒馆） */
  isPresent: boolean;
  /** 心情状态（可选，覆盖默认心情） */
  mood?: string;
  /** 优先级（用于冲突解决，数值越高越优先） */
  priority?: number;
}

/** NPC 日程表 */
export interface NPCSchedule {
  /** NPC ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 日程条目列表 */
  entries: NPCScheduleEntry[];
  /** 默认活动（当没有匹配的时间段时） */
  defaultActivity: string;
  /** 默认地点 */
  defaultLocation: string;
}

/** NPC 出现/离开事件 */
export interface NPCPresenceEvent {
  /** 事件类型 */
  type: 'arrive' | 'leave';
  /** NPC ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 当前时间 */
  time: GameTime;
  /** 原因/描述 */
  reason: string;
}

/** 日程管理器配置 */
export interface ScheduleManagerConfig {
  /** 检查间隔（回合数，默认 1） */
  checkInterval: number;
  /** 是否启用随机变化（让日程不那么死板） */
  enableRandomVariation: boolean;
  /** 随机变化概率（0-1） */
  variationChance: number;
}

/** 预定义的酒馆 NPC 日程模板 */
export const TAVERN_NPC_SCHEDULES: Record<string, NPCSchedule> = {
  'bard-elara': {
    npcId: 'bard-elara',
    npcName: '艾拉（吟游诗人）',
    defaultActivity: '在角落整理乐谱',
    defaultLocation: 'tavern',
    entries: [
      { startHour: 8, endHour: 12, activity: '在角落整理乐谱', location: 'tavern', isPresent: true, mood: 'calm' },
      { startHour: 12, endHour: 14, activity: '在吧台享用午餐', location: 'tavern', isPresent: true, mood: 'happy' },
      { startHour: 14, endHour: 18, activity: '外出寻找灵感', location: 'market', isPresent: false, mood: 'curious' },
      { startHour: 18, endHour: 22, activity: '在舞台演奏', location: 'tavern', isPresent: true, mood: 'happy' },
      { startHour: 22, endHour: 2, activity: '与客人交谈并接受点歌', location: 'tavern', isPresent: true, mood: 'friendly' },
      { startHour: 2, endHour: 8, activity: '在客房休息', location: 'tavern', isPresent: true, mood: 'tired' },
    ],
  },
  'barkeep-thomas': {
    npcId: 'barkeep-thomas',
    npcName: '托马斯（酒馆老板）',
    defaultActivity: '擦拭酒杯',
    defaultLocation: 'tavern',
    entries: [
      { startHour: 6, endHour: 10, activity: '准备酒馆开门', location: 'tavern', isPresent: true, mood: 'calm' },
      { startHour: 10, endHour: 14, activity: '擦拭酒杯和整理酒架', location: 'tavern', isPresent: true, mood: 'calm' },
      { startHour: 14, endHour: 18, activity: '与常客闲聊', location: 'tavern', isPresent: true, mood: 'friendly' },
      { startHour: 18, endHour: 23, activity: '忙碌地招待客人', location: 'tavern', isPresent: true, mood: 'happy' },
      { startHour: 23, endHour: 2, activity: '清点账目', location: 'tavern', isPresent: true, mood: 'tired' },
      { startHour: 2, endHour: 6, activity: '在后台休息', location: 'tavern', isPresent: true, mood: 'tired' },
    ],
  },
  'merchant-lucas': {
    npcId: 'merchant-lucas',
    npcName: '卢卡斯（商人）',
    defaultActivity: '在市场上做生意',
    defaultLocation: 'market',
    entries: [
      { startHour: 8, endHour: 12, activity: '在市场上做生意', location: 'market', isPresent: false, mood: 'calm' },
      { startHour: 12, endHour: 14, activity: '在酒馆吃午餐', location: 'tavern', isPresent: true, mood: 'happy' },
      { startHour: 14, endHour: 18, activity: '在市场上做生意', location: 'market', isPresent: false, mood: 'calm' },
      { startHour: 18, endHour: 21, activity: '在酒馆喝酒放松', location: 'tavern', isPresent: true, mood: 'friendly' },
      { startHour: 21, endHour: 8, activity: '回家休息', location: 'home', isPresent: false, mood: 'tired' },
    ],
  },
  'guard-marcus': {
    npcId: 'guard-marcus',
    npcName: '马库斯（守卫）',
    defaultActivity: '在城镇巡逻',
    defaultLocation: 'town',
    entries: [
      { startHour: 6, endHour: 14, activity: '在城镇巡逻', location: 'town', isPresent: false, mood: 'calm' },
      { startHour: 14, endHour: 15, activity: '在酒馆吃午餐', location: 'tavern', isPresent: true, mood: 'calm' },
      { startHour: 15, endHour: 22, activity: '在城镇巡逻', location: 'town', isPresent: false, mood: 'calm' },
      { startHour: 22, endHour: 23, activity: '在酒馆喝杯酒再下班', location: 'tavern', isPresent: true, mood: 'friendly' },
      { startHour: 23, endHour: 6, activity: '回家休息', location: 'home', isPresent: false, mood: 'tired' },
    ],
  },
};
