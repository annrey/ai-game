/**
 * EventBus 单元测试
 * 测试：on / emit / once / off / wildcard / getLog / getLatest / clearLog
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, GameEvents } from '../event-bus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('emit / on', () => {
    it('应发布和接收事件', () => {
      const handler = vi.fn();
      bus.on(GameEvents.PLAYER_ACTION, handler);
      bus.emit(GameEvents.PLAYER_ACTION, { action: 'test' }, 'player');

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe('player:action');
      expect(event.payload.action).toBe('test');
      expect(event.source).toBe('player');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('应支持多个监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on(GameEvents.LOCATION_CHANGE, h1);
      bus.on(GameEvents.LOCATION_CHANGE, h2);
      bus.emit(GameEvents.LOCATION_CHANGE, { to: '森林' });

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('emit 默认 source 为 engine', () => {
      const handler = vi.fn();
      bus.on(GameEvents.TIME_ADVANCE, handler);
      bus.emit(GameEvents.TIME_ADVANCE, { minutes: 30 });

      expect(handler.mock.calls[0][0].source).toBe('engine');
    });
  });

  describe('wildcard *', () => {
    it('应通过 * 接收所有事件', () => {
      const handler = vi.fn();
      bus.on('*', handler);

      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });
      bus.emit(GameEvents.COMBAT_START, { c: 3 });

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('once', () => {
    it('应只触发一次', () => {
      const handler = vi.fn();
      bus.once(GameEvents.GAME_START, handler);

      bus.emit(GameEvents.GAME_START);
      bus.emit(GameEvents.GAME_START);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('应取消订阅', () => {
      const handler = vi.fn();
      bus.on(GameEvents.PLAYER_MOVE, handler);
      bus.off(GameEvents.PLAYER_MOVE, handler);
      bus.emit(GameEvents.PLAYER_MOVE, { to: '北方' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getLog', () => {
    it('应记录所有发布的事件', () => {
      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });

      const log = bus.getLog();
      expect(log).toHaveLength(2);
      expect(log[0].type).toBe('player:action');
      expect(log[1].type).toBe('npc:enter');
    });

    it('应支持 limit 参数', () => {
      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });
      bus.emit(GameEvents.COMBAT_START, { c: 3 });

      const log = bus.getLog(2);
      expect(log).toHaveLength(2);
      expect(log[0].type).toBe('npc:enter');
      expect(log[1].type).toBe('combat:initiated');
    });

    it('应在日志超过上限时自动裁剪', () => {
      // maxLogSize 默认 1000
      for (let i = 0; i < 1050; i++) {
        bus.emit(GameEvents.PLAYER_ACTION, { i });
      }
      const log = bus.getLog();
      expect(log.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getLatest', () => {
    it('应返回特定类型的最近事件', () => {
      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });
      bus.emit(GameEvents.PLAYER_ACTION, { a: 3 });

      const latest = bus.getLatest(GameEvents.PLAYER_ACTION);
      expect(latest).toBeDefined();
      expect(latest!.payload.a).toBe(3);
    });

    it('不存在的事件类型应返回 undefined', () => {
      expect(bus.getLatest('nonexistent')).toBeUndefined();
    });
  });

  describe('clearLog', () => {
    it('应清空事件日志', () => {
      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });
      bus.clearLog();

      expect(bus.getLog()).toHaveLength(0);
    });
  });

  describe('removeAll', () => {
    it('应移除所有监听器', () => {
      const handler = vi.fn();
      bus.on(GameEvents.PLAYER_ACTION, handler);
      bus.on(GameEvents.NPC_ENTER, handler);
      bus.removeAll();

      bus.emit(GameEvents.PLAYER_ACTION, { a: 1 });
      bus.emit(GameEvents.NPC_ENTER, { b: 2 });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
