/**
 * 任务验证器（QuestValidator）单元测试
 * 测试任务验证和生成功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuestValidator } from '../quest-validator.js';
import type { Quest } from '../../types/scene.js';
import type { QuestGenerationContext, ValidationResult } from '../../types/validator.js';

describe('QuestValidator', () => {
  let validator: QuestValidator;

  beforeEach(() => {
    validator = new QuestValidator();
  });

  describe('validateQuest - 任务验证', () => {
    it('应验证通过一个合法的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'main_story_001',
        title: '王国的危机',
        description: '王国面临着前所未有的危机，需要勇敢的英雄挺身而出。',
        status: 'active',
        objectives: ['收集危机情报', '制定应对方案', '执行救援行动'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('应拒绝空标题的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '',
        description: '测试描述',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务标题不能为空');
    });

    it('应拒绝标题过短的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: 'AB', // 少于 3 个字符
        description: '测试描述',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务标题长度不能少于 3 个字符');
    });

    it('应拒绝标题过长的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: 'A'.repeat(101), // 超过 100 个字符
        description: '测试描述',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务标题长度不能超过 100 个字符');
    });

    it('应拒绝空描述的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务描述不能为空');
    });

    it('应拒绝描述过短的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '短描述', // 少于 10 个字符
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务描述长度不能少于 10 个字符');
    });

    it('应拒绝描述过长的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: 'A'.repeat(1001), // 超过 1000 个字符
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务描述长度不能超过 1000 个字符');
    });

    it('应拒绝没有目标的任务（当 requireObjectives 为 true 时）', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: [], // 空目标数组
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务必须包含目标');
    });

    it('应拒绝目标数量过少的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: [], // 少于 1 个目标
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务必须包含目标');
    });

    it('应拒绝目标数量过多的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: Array(11).fill('目标'), // 超过 10 个目标
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务目标数量不能超过 10 个');
    });

    it('应拒绝无效状态的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'invalid_status' as any, // 无效状态
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务状态必须是 active, completed, failed 之一');
    });

    it('应拒绝 ID 格式不合法的任务', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test@#$%', // 包含非法字符
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务 ID 格式不合法，只能包含字母、数字、下划线和连字符');
    });

    it('应拒绝空 ID 的任务', () => {
      const quest: Quest = {
        id: '',
        questId: 'test_001',
        title: '测试任务',
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: ['目标 1'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务唯一标识符不能为空');
    });

    it('应接受所有字段都合法的任务', () => {
      const quest: Quest = {
        id: 'quest_12345',
        questId: 'main_story_001',
        title: '勇者的试炼',
        description: '传说中存在一个古老的试炼，只有真正的勇者才能完成。你需要通过三个考验来证明自己的实力。',
        status: 'active',
        objectives: ['通过力量考验', '通过智慧考验', '通过勇气考验'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('generateQuest - 任务生成', () => {
    it('应生成一个主线任务（story 类型）', async () => {
      const context: QuestGenerationContext = {
        playerLevel: 5,
        currentLocation: '王城',
        relatedNPC: '国王',
        plotType: 'story',
        difficulty: 'medium',
      };

      const quest = await validator.generateQuest(context);

      expect(quest).toBeDefined();
      expect(quest.id).toBeDefined();
      expect(quest.questId).toBeDefined();
      expect(quest.title).toBeDefined();
      expect(quest.description).toBeDefined();
      expect(quest.status).toBe('active');
      expect(quest.objectives).toBeDefined();
      expect(quest.objectives!.length).toBeGreaterThan(0);
    });

    it('应生成一个支线任务（side 类型）', async () => {
      const context: QuestGenerationContext = {
        playerLevel: 3,
        currentLocation: '酒馆',
        relatedNPC: '酒馆老板',
        plotType: 'side',
        difficulty: 'easy',
      };

      const quest = await validator.generateQuest(context);

      expect(quest).toBeDefined();
      expect(quest.id).toBeDefined();
      expect(quest.questId).toContain('side');
      expect(quest.title).toBeDefined();
      expect(quest.description).toBeDefined();
      expect(quest.status).toBe('active');
      expect(quest.objectives!.length).toBeGreaterThan(0);
    });

    it('应生成一个日常任务（daily 类型）', async () => {
      const context: QuestGenerationContext = {
        playerLevel: 1,
        currentLocation: '村庄',
        plotType: 'daily',
        difficulty: 'easy',
      };

      const quest = await validator.generateQuest(context);

      expect(quest).toBeDefined();
      expect(quest.id).toBeDefined();
      expect(quest.questId).toBeDefined();
      expect(quest.status).toBe('active');
    });

    it('应根据难度调整奖励', async () => {
      const easyContext: QuestGenerationContext = {
        playerLevel: 1,
        plotType: 'story',
        difficulty: 'easy',
      };

      const hardContext: QuestGenerationContext = {
        playerLevel: 10,
        plotType: 'story',
        difficulty: 'hard',
      };

      const easyQuest = await validator.generateQuest(easyContext);
      const hardQuest = await validator.generateQuest(hardContext);

      expect(easyQuest).toBeDefined();
      expect(hardQuest).toBeDefined();
    });

    it('应生成通过验证的任务', async () => {
      const context: QuestGenerationContext = {
        playerLevel: 5,
        currentLocation: '魔法塔',
        relatedNPC: '大法师',
        plotType: 'story',
        difficulty: 'hard',
      };

      const quest = await validator.generateQuest(context);

      // 生成的任务应该通过验证
      const validation = validator.validateQuest(quest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应使用默认值当上下文参数缺失时', async () => {
      const context: QuestGenerationContext = {};

      const quest = await validator.generateQuest(context);

      expect(quest).toBeDefined();
      expect(quest.status).toBe('active');
      expect(quest.objectives).toBeDefined();
    });

    it('应为不同地点生成不同的任务描述', async () => {
      const forestContext: QuestGenerationContext = {
        currentLocation: '幽暗森林',
        relatedNPC: '森林守护者',
        plotType: 'story',
      };

      const desertContext: QuestGenerationContext = {
        currentLocation: '炽热沙漠',
        relatedNPC: '沙漠商人',
        plotType: 'story',
      };

      const forestQuest = await validator.generateQuest(forestContext);
      const desertQuest = await validator.generateQuest(desertContext);

      // 验证任务生成成功
      expect(forestQuest).toBeDefined();
      expect(desertQuest).toBeDefined();
      expect(forestQuest.id).toBeDefined();
      expect(desertQuest.id).toBeDefined();
      expect(forestQuest.status).toBe('active');
      expect(desertQuest.status).toBe('active');
      
      // 验证任务通过验证
      const forestValidation = validator.validateQuest(forestQuest);
      const desertValidation = validator.validateQuest(desertQuest);
      expect(forestValidation.valid).toBe(true);
      expect(desertValidation.valid).toBe(true);
    });

    it('应为不同 NPC 生成不同的任务内容', async () => {
      const kingContext: QuestGenerationContext = {
        relatedNPC: '国王',
        plotType: 'story',
      };

      const merchantContext: QuestGenerationContext = {
        relatedNPC: '商人',
        plotType: 'side',
      };

      const kingQuest = await validator.generateQuest(kingContext);
      const merchantQuest = await validator.generateQuest(merchantContext);

      expect(kingQuest).toBeDefined();
      expect(merchantQuest).toBeDefined();
    });
  });

  describe('自定义验证规则', () => {
    it('应使用自定义规则进行验证', () => {
      const customValidator = new QuestValidator({
        minTitleLength: 5,
        maxTitleLength: 50,
        minDescriptionLength: 20,
        minObjectives: 2,
      });

      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '短标题', // 满足默认规则但不满足自定义规则（5 个字符）
        description: '这是一个测试任务描述',
        status: 'active',
        objectives: ['目标 1'], // 只有 1 个目标，不满足自定义规则
      };

      const result = customValidator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('任务目标数量不能少于 2 个');
    });

    it('应允许更严格的规则', () => {
      const strictValidator = new QuestValidator({
        minTitleLength: 10,
        minDescriptionLength: 50,
        maxObjectives: 5,
      });

      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '短标题',
        description: '短描述',
        status: 'active',
        objectives: ['目标 1', '目标 2', '目标 3', '目标 4', '目标 5', '目标 6'], // 6 个目标
      };

      const result = strictValidator.validateQuest(quest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应处理特殊字符', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '特殊@#$字符任务',
        description: '这是一个包含特殊字符的任务描述！@#￥%……',
        status: 'active',
        objectives: ['目标 1！@#', '目标 2￥%'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(true);
    });

    it('应处理 Unicode 字符', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: '🎮 游戏任务',
        description: '这是一个包含 emoji 的任务描述 🌟✨🎉',
        status: 'active',
        objectives: ['收集 💎', '击败 👹'],
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(true);
    });

    it('应处理极长但合法的内容', () => {
      const quest: Quest = {
        id: 'quest_001',
        questId: 'test_001',
        title: 'A'.repeat(100), // 正好 100 个字符
        description: 'A'.repeat(1000), // 正好 1000 个字符
        status: 'active',
        objectives: Array(10).fill('目标'), // 正好 10 个目标
      };

      const result = validator.validateQuest(quest);

      expect(result.valid).toBe(true);
    });
  });
});
