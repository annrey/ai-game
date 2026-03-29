/**
 * 规则引擎 - 核心规则管理
 * 实现规则图谱、语义匹配、冲突检测
 */

import type {
  RuleNode,
  RuleGraph,
  SceneContext,
  RuleMatch,
  RuleAssemblyConfig,
  RuleValidationResult,
  RuleEngineConfig,
  WorldRules,
} from './rule-types.js';

/** 默认引擎配置 */
const DEFAULT_CONFIG: RuleEngineConfig = {
  defaultAssemblyConfig: {
    maxTokens: 2000,
    detectConflicts: true,
    autoResolveConflicts: true,
    minRules: 3,
    maxRules: 10,
  },
  enableSemanticMatch: true,
  semanticThreshold: 0.6,
  keywordWeight: 0.4,
  semanticWeight: 0.6,
};

export class RuleEngine {
  private graph: RuleGraph = { nodes: new Map(), edges: [] };
  private config: RuleEngineConfig;

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 加载世界规则 */
  loadWorldRules(rules: WorldRules): void {
    // 清空现有规则
    this.graph = { nodes: new Map(), edges: [] };

    // 添加所有层级的规则
    const allRules = [
      ...rules.physics.map(r => ({ ...r, layer: 'physics' as const })),
      ...rules.society.map(r => ({ ...r, layer: 'society' as const })),
      ...rules.narrative.map(r => ({ ...r, layer: 'narrative' as const })),
      ...rules.custom.map(r => ({ ...r, layer: 'custom' as const })),
    ];

    for (const rule of allRules) {
      this.addRule(rule);
    }
  }

  /** 添加单条规则 */
  addRule(rule: RuleNode): void {
    this.graph.nodes.set(rule.id, rule);

    // 建立关系边
    const relations = [
      { keys: rule.parentRules, type: 'inherits' as const },
      { keys: rule.conflictsWith, type: 'conflicts' as const },
      { keys: rule.dependsOn, type: 'depends' as const },
      { keys: rule.overrides, type: 'overrides' as const },
    ];

    for (const { keys, type } of relations) {
      if (keys) {
        for (const targetId of keys) {
          this.graph.edges.push({ from: rule.id, to: targetId, type });
        }
      }
    }
  }

  /** 根据场景匹配相关规则 */
  matchRules(context: SceneContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const rule of this.graph.nodes.values()) {
      const match = this.calculateMatchScore(rule, context);
      if (match.score > 0) {
        matches.push(match);
      }
    }

    // 按分数排序
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }

  /** 计算规则与场景的匹配分数 */
  private calculateMatchScore(rule: RuleNode, context: SceneContext): RuleMatch {
    let keywordScore = 0;
    let semanticScore = 0;
    let reason: RuleMatch['reason'] = 'semantic';
    let matchedKeywords: string[] = [];

    // 1. 常驻规则直接满分
    if (rule.constant) {
      return {
        rule,
        score: 1.0,
        reason: 'constant',
      };
    }

    // 2. 关键词匹配（SillyTavern 风格）
    if (rule.keywords && rule.keywords.length > 0) {
      const textToMatch = [
        context.description,
        context.userInput,
        context.location,
        context.eventType,
        ...(context.characters || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      for (const keyword of rule.keywords) {
        if (textToMatch.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }

      keywordScore = matchedKeywords.length / rule.keywords.length;
      if (keywordScore > 0) {
        reason = 'keyword';
      }
    }

    // 3. 语义意图匹配（简化版 - 基于关键词相似度）
    // 实际项目中可以使用向量嵌入
    if (this.config.enableSemanticMatch && rule.intent) {
      semanticScore = this.calculateSemanticSimilarity(rule.intent, context);
    }

    // 4. 加权总分
    const totalScore =
      keywordScore * this.config.keywordWeight +
      semanticScore * this.config.semanticWeight;

    return {
      rule,
      score: Math.min(totalScore, 1.0),
      reason,
      matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
    };
  }

  /** 计算语义相似度（简化实现） */
  private calculateSemanticSimilarity(intent: string, context: SceneContext): number {
    // 简化版：基于关键词重叠度
    // 实际项目应该使用向量嵌入
    const intentWords = intent.toLowerCase().split(/\s+/);
    const contextText = [
      context.description,
      context.userInput,
      context.eventType,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let matchCount = 0;
    for (const word of intentWords) {
      if (word.length > 2 && contextText.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / Math.max(intentWords.length, 1);
  }

  /** 组装规则上下文 */
  assembleRules(matches: RuleMatch[], config?: Partial<RuleAssemblyConfig>): string {
    const assemblyConfig = { ...this.config.defaultAssemblyConfig, ...config };

    // 1. 冲突检测
    if (assemblyConfig.detectConflicts) {
      const validation = this.validateRules(matches.map(m => m.rule));
      if (validation.conflicts.length > 0 && assemblyConfig.autoResolveConflicts) {
        matches = this.resolveConflicts(matches, validation.conflicts);
      }
    }

    // 2. 选择规则（考虑 token 预算）
    const selectedRules = this.selectRulesByBudget(matches, assemblyConfig);

    // 3. 按层级排序生成文本
    const layerOrder: Array<keyof WorldRules> = ['physics', 'society', 'narrative', 'custom'];
    const grouped = new Map<string, RuleMatch[]>();

    for (const match of selectedRules) {
      const layer = match.rule.layer;
      if (!grouped.has(layer)) {
        grouped.set(layer, []);
      }
      grouped.get(layer)!.push(match);
    }

    // 4. 生成规则文本
    const parts: string[] = [];
    for (const layer of layerOrder) {
      const layerMatches = grouped.get(layer);
      if (layerMatches && layerMatches.length > 0) {
        parts.push(`【${this.getLayerName(layer)}】`);
        for (const match of layerMatches) {
          const priorityMark = match.rule.priority === 'hard' ? '[硬]' : match.rule.priority === 'soft' ? '[软]' : '[建议]';
          parts.push(`${priorityMark} ${match.rule.content}`);
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /** 根据 Token 预算选择规则 */
  private selectRulesByBudget(matches: RuleMatch[], config: RuleAssemblyConfig): RuleMatch[] {
    // 简化版：按分数和权重排序后选择
    // 实际项目应该估算 token 数

    // 先按分数排序
    const sorted = [...matches].sort((a, b) => {
      // 考虑 tokenWeight
      const scoreA = a.score * (a.rule.tokenWeight || 1);
      const scoreB = b.score * (b.rule.tokenWeight || 1);
      return scoreB - scoreA;
    });

    // 选择前 N 个
    return sorted.slice(0, config.maxRules);
  }

  /** 冲突解决 */
  private resolveConflicts(matches: RuleMatch[], conflicts: RuleValidationResult['conflicts']): RuleMatch[] {
    const toRemove = new Set<string>();

    for (const conflict of conflicts) {
      // 优先级策略：custom > narrative > society > physics
      const priorityOrder = ['custom', 'narrative', 'society', 'physics'];
      const idxA = priorityOrder.indexOf(conflict.ruleA.layer);
      const idxB = priorityOrder.indexOf(conflict.ruleB.layer);

      // 保留优先级高的（索引小的）
      if (idxA < idxB) {
        toRemove.add(conflict.ruleB.id);
      } else {
        toRemove.add(conflict.ruleA.id);
      }
    }

    return matches.filter(m => !toRemove.has(m.rule.id));
  }

  /** 验证规则集合 */
  validateRules(rules: RuleNode[]): RuleValidationResult {
    const violations: RuleValidationResult['violations'] = [];
    const conflicts: RuleValidationResult['conflicts'] = [];

    // 1. 检查依赖是否满足
    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          if (!rules.find(r => r.id === depId) && !this.graph.nodes.has(depId)) {
            violations.push({
              rule,
              violation: `依赖规则 ${depId} 不存在`,
              severity: 'error',
            });
          }
        }
      }
    }

    // 2. 检测直接冲突
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];

        // 检查显式冲突
        if (ruleA.conflictsWith?.includes(ruleB.id) || ruleB.conflictsWith?.includes(ruleA.id)) {
          conflicts.push({
            ruleA,
            ruleB,
            conflictType: 'direct',
            description: `${ruleA.id} 与 ${ruleB.id} 存在显式冲突`,
          });
        }

        // 检查继承冲突
        if (ruleA.parentRules?.some(pid => ruleB.overrides?.includes(pid))) {
          conflicts.push({
            ruleA,
            ruleB,
            conflictType: 'inheritance',
            description: `${ruleB.id} 覆盖了 ${ruleA.id} 继承的规则`,
          });
        }
      }
    }

    return {
      valid: violations.length === 0 && conflicts.length === 0,
      violations,
      conflicts,
    };
  }

  /** 获取规则 */
  getRule(id: string): RuleNode | undefined {
    return this.graph.nodes.get(id);
  }

  /** 获取所有规则 */
  getAllRules(): RuleNode[] {
    return Array.from(this.graph.nodes.values());
  }

  /** 获取层级中文名 */
  private getLayerName(layer: string): string {
    const names: Record<string, string> = {
      physics: '物理法则',
      society: '社会规则',
      narrative: '叙事规则',
      custom: '自定义规则',
    };
    return names[layer] || layer;
  }
}
