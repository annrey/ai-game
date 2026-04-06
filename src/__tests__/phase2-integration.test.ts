/**
 * 第二阶段功能集成测试
 * 验证 NPC 日程表、关系网络、经济系统和环境系统
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleManager } from '../engine/schedule-manager.js';
import { RelationshipManager } from '../engine/relationship-manager.js';
import { EconomyManager } from '../engine/economy-manager.js';
import { EnvironmentManager } from '../engine/environment-manager.js';
import { TAVERN_NPC_SCHEDULES } from '../types/schedule.js';
import { TAVERN_NPC_RELATIONSHIPS } from '../types/relationship.js';
import type { GameTime } from '../types/scene.js';

describe('第二阶段功能集成测试', () => {
  describe('ScheduleManager', () => {
    let scheduleManager: ScheduleManager;

    beforeEach(() => {
      scheduleManager = new ScheduleManager();
      scheduleManager.loadScheduleTemplates(TAVERN_NPC_SCHEDULES);
    });

    it('应正确加载 NPC 日程', () => {
      const schedules = scheduleManager.getAllSchedules();
      expect(schedules.length).toBeGreaterThan(0);
    });

    it('应根据时间返回正确的 NPC 状态', () => {
      const time: GameTime = { day: 1, hour: 12, minute: 0, period: 'noon' };
      scheduleManager.setCurrentTime(time);

      const state = scheduleManager.getNPCCurrentState('bard-elara');
      expect(state).toBeDefined();
      expect(state?.isPresent).toBe(true);
    });

    it('应正确识别在场和不在场的 NPC', () => {
      const time: GameTime = { day: 1, hour: 15, minute: 0, period: 'afternoon' };
      scheduleManager.setCurrentTime(time);

      const present = scheduleManager.getPresentNPCs();
      const absent = scheduleManager.getAbsentNPCs();

      expect(present.length + absent.length).toBe(4); // 总共4个NPC
    });
  });

  describe('RelationshipManager', () => {
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      relationshipManager = new RelationshipManager();
      relationshipManager.loadPredefinedRelationships(TAVERN_NPC_RELATIONSHIPS);
    });

    it('应正确加载预定义关系', () => {
      const relationships = relationshipManager.getAllRelationships();
      expect(relationships.length).toBe(4);
    });

    it('应能获取 NPC 之间的关系', () => {
      const rel = relationshipManager.getRelationship('bard-elara', 'barkeep-thomas');
      expect(rel).toBeDefined();
      expect(rel?.type).toBe('colleague');
    });

    it('应能更新好感度', () => {
      const event = relationshipManager.updateAffinity(
        'bard-elara',
        'barkeep-thomas',
        10,
        '帮助对方',
      );
      expect(event).toBeDefined();
      expect(event?.newAffinity).toBe(40); // 原来是30
    });

    it('应能记录社交互动', () => {
      const interaction = relationshipManager.recordInteraction(
        'bard-elara',
        'barkeep-thomas',
        'talk',
        '友好交谈',
        5,
      );
      expect(interaction).toBeDefined();
      expect(interaction.type).toBe('talk');
    });
  });

  describe('EconomyManager', () => {
    let economyManager: EconomyManager;

    beforeEach(() => {
      economyManager = new EconomyManager();
    });

    it('应正确初始化金币', () => {
      expect(economyManager.getPlayerGold()).toBe(100);
    });

    it('应能增加金币', () => {
      const result = economyManager.addGold(50, '测试');
      expect(result).toBe(true);
      expect(economyManager.getPlayerGold()).toBe(150);
    });

    it('应能减少金币', () => {
      const result = economyManager.removeGold(30, '测试');
      expect(result).toBe(true);
      expect(economyManager.getPlayerGold()).toBe(70);
    });

    it('应能购买商品', () => {
      const result = economyManager.buyItem('ale', 2);
      expect(result.success).toBe(true);
      expect(economyManager.getPlayerGold()).toBe(90); // 100 - 5*2
    });

    it('应能给小费', () => {
      const result = economyManager.giveTip('npc-1', '托马斯', 10);
      expect(result.success).toBe(true);
      expect(economyManager.getPlayerGold()).toBe(90);
    });

    it('金币不足时应拒绝购买', () => {
      economyManager.setPlayerGold(5);
      const result = economyManager.buyItem('wine', 1);
      expect(result.success).toBe(false);
    });
  });

  describe('EnvironmentManager', () => {
    let environmentManager: EnvironmentManager;

    beforeEach(() => {
      environmentManager = new EnvironmentManager();
    });

    it('应正确初始化天气', () => {
      const weather = environmentManager.getCurrentWeather();
      expect(weather).toBeDefined();
      expect(weather.type).toBe('sunny');
    });

    it('应能改变天气', () => {
      environmentManager.setWeather('rainy');
      const weather = environmentManager.getCurrentWeather();
      expect(weather.type).toBe('rainy');
    });

    it('应能随机化天气', () => {
      const weatherType = environmentManager.randomizeWeather();
      expect(['sunny', 'rainy', 'cloudy', 'foggy', 'stormy', 'snowy']).toContain(weatherType);
    });

    it('应能获取可交互物体', () => {
      const objects = environmentManager.getAllObjects();
      expect(objects.length).toBeGreaterThan(0);
    });

    it('应能使用物体', () => {
      // 使用一个冷却时间较短的物体，或者等待冷却
      environmentManager.setTurn(100); // 使用较大的回合数避免冷却问题
      const result = environmentManager.useObject('bookshelf', 'read_book', 'player-1');
      if (!result.success) {
        console.log('Cannot use object:', result.message);
      }
      expect(result.success).toBe(true);
      expect(result.effects).toBeDefined();
    });

    it('应能获取环境描述', () => {
      const time: GameTime = { day: 1, hour: 12, minute: 0, period: 'noon' };
      const description = environmentManager.getEnvironmentDescription(time);
      expect(description).toContain('天气');
    });

    it('应能计算心情影响', () => {
      const time: GameTime = { day: 1, hour: 12, minute: 0, period: 'noon' };
      const moodEffect = environmentManager.getMoodEffect(time);
      expect(typeof moodEffect).toBe('number');
    });
  });

  describe('功能集成', () => {
    it('所有管理器应能独立工作', () => {
      const scheduleManager = new ScheduleManager();
      const relationshipManager = new RelationshipManager();
      const economyManager = new EconomyManager();
      const environmentManager = new EnvironmentManager();

      // 验证所有管理器都能正常实例化
      expect(scheduleManager).toBeDefined();
      expect(relationshipManager).toBeDefined();
      expect(economyManager).toBeDefined();
      expect(environmentManager).toBeDefined();
    });
  });
});
