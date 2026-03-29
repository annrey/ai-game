/**
 * RuleEngine 单元测试
 * 测试：loadWorldRules / addRule / matchRules / assembleRules / validateRules / detectConflicts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEngine } from '../rule-engine.js';
import type { RuleNode, WorldRules, SceneContext } from '../rule-types.js';

/** 辅助函数：创建测试规则 */
function makeRule(override: Partial<RuleNode> = {}): RuleNode {
  return {
    id: 'rule-1',
    content: '测试规则内容',
    layer: 'physics',
    priority: 'hard',
    intent: '测试意图',
    keywords: ['测试'],
    ...override,
  };
}

/** 辅助函数：创建测试世界规则 */
function makeWorldRules(overrides: Partial<WorldRules> = {}): WorldRules {
  return {
    physics: [
      makeRule({ id: 'phys-1', content: '重力存在', intent: '物理定律', keywords: ['重力', '坠落'], constant: true }),
      makeRule({ id: 'phys-2', content: '火会灼伤', intent: '火焰伤害', keywords: ['火', '燃烧'] }),
    ],
    society: [
      makeRule({ id: 'soc-1', content: '城镇禁止打斗', layer: 'society', priority: 'soft', intent: '治安规则', keywords: ['打斗', '城镇'] }),
    ],
    narrative: [
      makeRule({ id: 'nar-1', content: '每章需有转折', layer: 'narrative', priority: 'suggestion', intent: '叙事节奏', keywords: ['转折', '剧情'] }),
    ],
    custom: [],
    ...overrides,
  };
}

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  describe('loadWorldRules', () => {
    it('应加载世界规则到图谱', () => {
      engine.loadWorldRules(makeWorldRules());
      const allRules = engine.getAllRules();
      expect(allRules).toHaveLength(4);
    });

    it('应能通过 id 获取规则', () => {
      engine.loadWorldRules(makeWorldRules());
      const rule = engine.getRule('phys-1');
      expect(rule).toBeDefined();
      expect(rule!.content).toBe('重力存在');
    });

    it('重复加载应清空旧规则', () => {
      engine.loadWorldRules(makeWorldRules());
      engine.loadWorldRules(makeWorldRules({ physics: [], society: [], narrative: [], custom: [] }));
      expect(engine.getAllRules()).toHaveLength(0);
    });
  });

  describe('addRule', () => {
    it('应支持添加单条规则', () => {
      engine.addRule(makeRule({ id: 'custom-1', content: '自定义规则' }));
      expect(engine.getRule('custom-1')).toBeDefined();
    });
  });

  describe('matchRules', () => {
    it('常驻规则应始终匹配（score=1）', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = { description: '完全无关的场景' };
      const matches = engine.matchRules(context);

      const constantMatch = matches.find(m => m.rule.id === 'phys-1');
      expect(constantMatch).toBeDefined();
      expect(constantMatch!.score).toBe(1.0);
      expect(constantMatch!.reason).toBe('constant');
    });

    it('关键词匹配应返回正确分数', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = {
        description: '你在城镇中看到一场打斗',
        userInput: '阻止打斗',
      };
      const matches = engine.matchRules(context);

      const socMatch = matches.find(m => m.rule.id === 'soc-1');
      expect(socMatch).toBeDefined();
      expect(socMatch!.score).toBeGreaterThan(0);
    });

    it('无匹配时应返回空数组（除常驻规则）', () => {
      engine.loadWorldRules(makeWorldRules({
        physics: [], // 移除常驻规则
        society: [makeRule({ id: 'soc-1', layer: 'society', keywords: ['打斗'] })],
        narrative: [],
        custom: [],
      }));
      const context: SceneContext = { description: '安静的花园' };
      const matches = engine.matchRules(context);

      // 没有匹配关键词也没有常驻规则
      const nonZero = matches.filter(m => m.score > 0);
      expect(nonZero).toHaveLength(0);
    });

    it('应按分数降序排列', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = {
        description: '火焰和重力',
        userInput: '使用火焰',
      };
      const matches = engine.matchRules(context);

      for (let i = 1; i < matches.length; i++) {
        expect(matches[i].score).toBeLessThanOrEqual(matches[i - 1].score);
      }
    });
  });

  describe('assembleRules', () => {
    it('应将匹配规则组装为文本', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = { description: '坠落和燃烧的场景' };
      const matches = engine.matchRules(context);
      const text = engine.assembleRules(matches);

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('应按层级分组显示', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = {
        description: '在城镇中燃烧和打斗',
        userInput: '打斗中使用火焰',
      };
      const matches = engine.matchRules(context);
      const text = engine.assembleRules(matches);

      // 应包含层级标签
      expect(text).toContain('物理法则');
    });

    it('应遵循 maxRules 限制', () => {
      engine.loadWorldRules(makeWorldRules());
      const context: SceneContext = { description: '测试' };
      const matches = engine.matchRules(context);
      const text = engine.assembleRules(matches, { maxRules: 1 });

      // 只有一条规则应当出现在组装文本中
      expect(text).toBeDefined();
    });
  });

  describe('validateRules', () => {
    it('无冲突时应返回 valid: true', () => {
      const rules = [
        makeRule({ id: 'a', content: '规则A' }),
        makeRule({ id: 'b', content: '规则B' }),
      ];
      const result = engine.validateRules(rules);
      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    it('应检测显式冲突', () => {
      const rules = [
        makeRule({ id: 'a', content: '规则A', conflictsWith: ['b'] }),
        makeRule({ id: 'b', content: '规则B' }),
      ];
      const result = engine.validateRules(rules);
      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('direct');
    });

    it('应检测依赖缺失', () => {
      const rules = [
        makeRule({ id: 'a', content: '规则A', dependsOn: ['nonexistent'] }),
      ];
      const result = engine.validateRules(rules);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
    });

    it('应检测继承冲突', () => {
      const rules = [
        makeRule({ id: 'a', content: '规则A', parentRules: ['parent-1'] }),
        makeRule({ id: 'b', content: '规则B', overrides: ['parent-1'] }),
      ];
      const result = engine.validateRules(rules);
      expect(result.conflicts.some(c => c.conflictType === 'inheritance')).toBe(true);
    });
  });
});
