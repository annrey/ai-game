/**
 * 事件总线
 * 代理之间的解耦通信通道
 */

import EventEmitter from 'eventemitter3';
import type { GameEvent } from '../types/game.js';

/** 事件类型常量 */
export const GameEvents = {
  // 场景事件
  LOCATION_CHANGE: 'location:change',
  ENVIRONMENT_CHANGE: 'environment:change',
  TIME_ADVANCE: 'time:advance',

  // NPC 事件
  NPC_ENTER: 'npc:enter',
  NPC_EXIT: 'npc:exit',
  NPC_REACT: 'npc:should-react',
  NPC_MOOD_CHANGE: 'npc:mood-change',

  // 战斗事件
  COMBAT_START: 'combat:initiated',
  COMBAT_ACTION: 'combat:action',
  COMBAT_END: 'combat:end',

  // 剧情事件
  PLOT_ADVANCE: 'plot:advance',
  PLOT_CHECKPOINT: 'plot:checkpoint',
  PLOT_REVEAL: 'plot:reveal',

  // 玩家事件
  PLAYER_ACTION: 'player:action',
  PLAYER_SPEAK: 'player:speak',
  PLAYER_MOVE: 'player:move',

  // 系统事件
  GAME_START: 'game:start',
  GAME_SAVE: 'game:save',
  GAME_LOAD: 'game:load',
  GAME_END: 'game:end',
  AGENT_ERROR: 'agent:error',
} as const;

export type GameEventType = (typeof GameEvents)[keyof typeof GameEvents];

export class EventBus {
  private emitter = new EventEmitter();
  private eventLog: GameEvent[] = [];
  private maxLogSize = 1000;

  /** 发布事件 */
  emit(type: GameEventType | string, payload: Record<string, unknown> = {}, source: GameEvent['source'] = 'engine'): void {
    const event: GameEvent = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    this.emitter.emit(type, event);
    this.emitter.emit('*', event); // 全局监听
  }

  /** 订阅事件 */
  on(type: GameEventType | string | '*', handler: (event: GameEvent) => void | Promise<void>): void {
    this.emitter.on(type, handler);
  }

  /** 一次性订阅 */
  once(type: GameEventType | string, handler: (event: GameEvent) => void | Promise<void>): void {
    this.emitter.once(type, handler);
  }

  /** 取消订阅 */
  off(type: GameEventType | string, handler: (event: GameEvent) => void | Promise<void>): void {
    this.emitter.off(type, handler);
  }

  /** 获取事件日志 */
  getLog(limit?: number): GameEvent[] {
    return limit ? this.eventLog.slice(-limit) : [...this.eventLog];
  }

  /** 获取特定类型的最近事件 */
  getLatest(type: string): GameEvent | undefined {
    for (let i = this.eventLog.length - 1; i >= 0; i--) {
      if (this.eventLog[i].type === type) return this.eventLog[i];
    }
    return undefined;
  }

  /** 清空日志 */
  clearLog(): void {
    this.eventLog = [];
  }

  /** 移除所有监听 */
  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}
