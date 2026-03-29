/**
 * StateStore 单元测试
 * 测试：getState / update / patch / advanceTime / save-load / reset
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateStore, createDefaultSceneState } from '../state-store.js';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StateStore', () => {
  let store: StateStore;
  const testSavePath = join(tmpdir(), `state-store-test-${Date.now()}`);

  beforeEach(() => {
    store = new StateStore(testSavePath);
  });

  afterEach(async () => {
    // 清理测试存档目录
    const savesDir = join(testSavePath, 'saves');
    if (existsSync(savesDir)) {
      await rm(savesDir, { recursive: true, force: true });
    }
  });

  describe('createDefaultSceneState', () => {
    it('应返回默认场景状态', () => {
      const state = createDefaultSceneState();
      expect(state.currentLocation).toBe('起始之地');
      expect(state.presentNPCs).toEqual([]);
      expect(state.worldTime.day).toBe(1);
      expect(state.worldTime.hour).toBe(8);
      expect(state.worldTime.period).toBe('morning');
      expect(state.playerState.name).toBe('冒险者');
      expect(state.playerState.health).toBe(100);
    });
  });

  describe('getState', () => {
    it('应返回当前状态', () => {
      const state = store.getState();
      expect(state.currentLocation).toBe('起始之地');
    });

    it('应支持自定义初始状态', () => {
      const customState = createDefaultSceneState();
      customState.currentLocation = '森林';
      const customStore = new StateStore(testSavePath, customState);
      expect(customStore.getState().currentLocation).toBe('森林');
    });
  });

  describe('getContextSummary', () => {
    it('应返回可序列化的上下文摘要', () => {
      const summary = store.getContextSummary();
      expect(summary).toHaveProperty('location');
      expect(summary).toHaveProperty('time');
      expect(summary).toHaveProperty('weather');
      expect(summary.location).toBe('起始之地');
      expect(typeof summary.time).toBe('string');
    });
  });

  describe('update', () => {
    it('应进行部分更新', () => {
      store.update({ currentLocation: '山洞' });
      expect(store.getState().currentLocation).toBe('山洞');
      // 其他字段不受影响
      expect(store.getState().playerState.name).toBe('冒险者');
    });

    it('应能更新嵌套对象', () => {
      store.update({
        environment: {
          weather: '暴风雨',
          lighting: '闪电照亮',
          ambiance: '雷声轰鸣',
          hazards: ['雷击'],
        },
      });
      expect(store.getState().environment.weather).toBe('暴风雨');
      expect(store.getState().environment.hazards).toContain('雷击');
    });
  });

  describe('patch', () => {
    it('应支持路径式深度更新', () => {
      store.patch('environment.weather', '大雪');
      expect(store.getState().environment.weather).toBe('大雪');
    });

    it('当路径不存在时应静默忽略', () => {
      // 不应抛出错误
      store.patch('nonexistent.deep.path', 'value');
      expect(store.getState().currentLocation).toBe('起始之地');
    });
  });

  describe('advanceTime', () => {
    it('应正确推进分钟', () => {
      // 初始 8:00 morning
      store.advanceTime(30);
      const time = store.getState().worldTime;
      expect(time.hour).toBe(8);
      expect(time.minute).toBe(30);
      expect(time.period).toBe('morning');
    });

    it('应正确跨小时', () => {
      store.advanceTime(180); // 3小时 → 11:00
      const time = store.getState().worldTime;
      expect(time.hour).toBe(11);
      expect(time.minute).toBe(0);
      expect(time.period).toBe('noon');
    });

    it('应正确跨天', () => {
      store.advanceTime(24 * 60); // 24小时
      const time = store.getState().worldTime;
      expect(time.day).toBe(2);
      expect(time.hour).toBe(8);
      expect(time.minute).toBe(0);
    });

    it('应正确判断时间段', () => {
      // dawn: 5-7
      store.update({ worldTime: { day: 1, hour: 5, minute: 0, period: 'dawn' } });
      store.advanceTime(0);
      // advanceTime adds 0, should recalculate period
      expect(store.getState().worldTime.period).toBe('dawn');

      // night: 22-1
      store.update({ worldTime: { day: 1, hour: 0, minute: 0, period: 'midnight' } });
      store.advanceTime(22 * 60); // go to 22:00
      expect(store.getState().worldTime.period).toBe('night');
    });
  });

  describe('save / load', () => {
    it('应保存并加载存档', async () => {
      store.update({ currentLocation: '古堡' });
      const id = await store.save('测试存档', 'text-adventure');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      // 创建新 store 并加载
      const newStore = new StateStore(testSavePath);
      const saveData = await newStore.load(id);

      expect(saveData.name).toBe('测试存档');
      expect(saveData.mode).toBe('text-adventure');
      expect(newStore.getState().currentLocation).toBe('古堡');
    });

    it('应在存档目录不存在时自动创建', async () => {
      const id = await store.save('自动创建', 'text-adventure');
      expect(existsSync(join(testSavePath, 'saves', `${id}.json`))).toBe(true);
    });
  });

  describe('reset', () => {
    it('应重置为默认状态', () => {
      store.update({ currentLocation: '地狱' });
      store.reset();
      expect(store.getState().currentLocation).toBe('起始之地');
      expect(store.getState().worldTime.day).toBe(1);
    });
  });
});
