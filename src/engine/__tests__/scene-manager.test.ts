/**
 * SceneManager 单元测试
 * 测试：changeLocation / addNPC / removeNPC / recordAction / advanceTime / addPlot / advancePlot
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneManager } from '../scene-manager.js';
import { EventBus, GameEvents } from '../event-bus.js';
import { StateStore } from '../state-store.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SceneManager', () => {
  let eventBus: EventBus;
  let stateStore: StateStore;
  let scene: SceneManager;

  beforeEach(() => {
    eventBus = new EventBus();
    stateStore = new StateStore(join(tmpdir(), 'scene-test'));
    scene = new SceneManager(eventBus, stateStore);
  });

  describe('changeLocation', () => {
    it('应更新位置并清空 NPC', () => {
      // 先添加一个 NPC
      stateStore.update({
        presentNPCs: [{ id: 'npc1', name: '老王', disposition: 'friendly', currentActivity: '聊天' }],
      });

      scene.changeLocation('神秘森林', '高大的古树遮天蔽日');

      const state = stateStore.getState();
      expect(state.currentLocation).toBe('神秘森林');
      expect(state.locationDescription).toBe('高大的古树遮天蔽日');
      expect(state.presentNPCs).toHaveLength(0);
    });

    it('应触发 LOCATION_CHANGE 事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.LOCATION_CHANGE, handler);

      scene.changeLocation('城镇', '繁华的城镇广场');

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.payload.from).toBe('起始之地');
      expect(event.payload.to).toBe('城镇');
    });
  });

  describe('addNPC', () => {
    it('应将 NPC 添加到场景', () => {
      const npc = { id: 'npc1', name: '铁匠', disposition: 'friendly' as const, currentActivity: '打铁' };
      scene.addNPC(npc);

      const npcs = stateStore.getState().presentNPCs;
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('铁匠');
    });

    it('应触发 NPC_ENTER 事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.NPC_ENTER, handler);

      scene.addNPC({ id: 'npc2', name: '旅行商人', disposition: 'neutral', currentActivity: '摆摊' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.npc.name).toBe('旅行商人');
    });
  });

  describe('removeNPC', () => {
    it('应将 NPC 从场景移除', () => {
      scene.addNPC({ id: 'npc1', name: '铁匠', disposition: 'friendly', currentActivity: '打铁' });
      scene.addNPC({ id: 'npc2', name: '商人', disposition: 'neutral', currentActivity: '交易' });

      scene.removeNPC('npc1');

      const npcs = stateStore.getState().presentNPCs;
      expect(npcs).toHaveLength(1);
      expect(npcs[0].id).toBe('npc2');
    });

    it('应触发 NPC_EXIT 事件', () => {
      const handler = vi.fn();
      scene.addNPC({ id: 'npc1', name: '铁匠', disposition: 'friendly', currentActivity: '打铁' });
      eventBus.on(GameEvents.NPC_EXIT, handler);

      scene.removeNPC('npc1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.npc.name).toBe('铁匠');
    });

    it('移除不存在的 NPC 不应触发事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.NPC_EXIT, handler);

      scene.removeNPC('nonexistent');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('recordAction', () => {
    it('应记录行动并返回 Action 对象', () => {
      const action = scene.recordAction('move', '向北走去');
      expect(action.type).toBe('move');
      expect(action.description).toBe('向北走去');
      expect(action.actor).toBe('player');
      expect(action.id).toBeDefined();
    });

    it('应将行动添加到状态', () => {
      scene.recordAction('talk', '和铁匠交谈', '铁匠');
      const actions = stateStore.getState().playerActions;
      expect(actions).toHaveLength(1);
      expect(actions[0].target).toBe('铁匠');
    });

    it('应触发 PLAYER_ACTION 事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.PLAYER_ACTION, handler);

      scene.recordAction('examine', '查看宝箱');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('应限制行动历史最多 50 条', () => {
      for (let i = 0; i < 55; i++) {
        scene.recordAction('move', `行动${i}`);
      }
      expect(stateStore.getState().playerActions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('advanceTime', () => {
    it('应推进时间并触发事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.TIME_ADVANCE, handler);

      scene.advanceTime(60);

      const time = stateStore.getState().worldTime;
      expect(time.hour).toBe(9);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.advanced).toBe(60);
    });
  });

  describe('updateEnvironment', () => {
    it('应部分更新环境状态', () => {
      scene.updateEnvironment({ weather: '暴风雪' });
      const env = stateStore.getState().environment;
      expect(env.weather).toBe('暴风雪');
      // 其他字段应保持不变
      expect(env.lighting).toBe('明亮的晨光');
    });

    it('应触发 ENVIRONMENT_CHANGE 事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.ENVIRONMENT_CHANGE, handler);

      scene.updateEnvironment({ weather: '雨' });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('addPlot / advancePlot', () => {
    it('应添加剧情点', () => {
      scene.addPlot({
        id: 'plot1',
        name: '失落的宝藏',
        status: 'foreshadowed',
        description: '传说中古堡里有一批宝藏',
      });

      const plots = stateStore.getState().activePlots;
      expect(plots).toHaveLength(1);
      expect(plots[0].name).toBe('失落的宝藏');
    });

    it('应推进剧情状态', () => {
      scene.addPlot({
        id: 'plot1',
        name: '失落的宝藏',
        status: 'foreshadowed',
        description: '传说中古堡里有一批宝藏',
      });

      scene.advancePlot('plot1', 'active');

      const plots = stateStore.getState().activePlots;
      expect(plots[0].status).toBe('active');
    });

    it('应触发 PLOT_ADVANCE 事件', () => {
      const handler = vi.fn();
      eventBus.on(GameEvents.PLOT_ADVANCE, handler);

      scene.addPlot({
        id: 'plot1',
        name: '测试',
        status: 'hidden',
        description: '测试剧情',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
