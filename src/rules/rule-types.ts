/**
 * 增强型规则系统类型定义
 * 基于 SillyTavern 经验 + 语义理解升级
 */

/** 规则分层类型 */
export type RuleLayer = 'physics' | 'society' | 'narrative' | 'custom';

/** 规则优先级 */
export type RulePriority = 'hard' | 'soft' | 'suggestion';

/** 规则节点 - 支持规则图谱 */
export interface RuleNode {
  /** 唯一标识 */
  id: string;
  /** 规则内容 */
  content: string;
  /** 所属层级 */
  layer: RuleLayer;
  /** 优先级 */
  priority: RulePriority;
  /** 语义意图描述（用于场景匹配） */
  intent: string;
  /** 触发关键词（兼容 SillyTavern 风格） */
  keywords?: string[];
  /** 父规则 - 继承 */
  parentRules?: string[];
  /** 冲突规则 */
  conflictsWith?: string[];
  /** 依赖规则 */
  dependsOn?: string[];
  /** 覆盖规则 */
  overrides?: string[];
  /** 是否常驻上下文 */
  constant?: boolean;
  /** Token 预算权重（越大越优先保留） */
  tokenWeight?: number;
  /** 元数据 */
  metadata?: {
    /** 规则来源 */
    source?: string;
    /** 创建时间 */
    createdAt?: Date;
    /** 版本 */
    version?: string;
  };
}

/** 规则图谱 */
export interface RuleGraph {
  nodes: Map<string, RuleNode>;
  edges: Array<{
    from: string;
    to: string;
    type: 'inherits' | 'conflicts' | 'depends' | 'overrides';
  }>;
}

/** 场景上下文 */
export interface SceneContext {
  /** 当前场景描述 */
  description: string;
  /** 涉及的角色 */
  characters?: string[];
  /** 地点 */
  location?: string;
  /** 事件类型 */
  eventType?: string;
  /** 情绪基调 */
  mood?: string;
  /** 用户输入 */
  userInput?: string;
  /** 历史摘要 */
  historySummary?: string;
}

/** 规则匹配结果 */
export interface RuleMatch {
  rule: RuleNode;
  /** 匹配分数 0-1 */
  score: number;
  /** 匹配原因 */
  reason: 'keyword' | 'semantic' | 'constant' | 'dependency';
  /** 匹配的关键词（如果是关键词匹配） */
  matchedKeywords?: string[];
}

/** 规则组装配置 */
export interface RuleAssemblyConfig {
  /** 最大 Token 预算 */
  maxTokens: number;
  /** 是否启用冲突检测 */
  detectConflicts: boolean;
  /** 是否自动解决冲突 */
  autoResolveConflicts: boolean;
  /** 最少规则数 */
  minRules: number;
  /** 最多规则数 */
  maxRules: number;
}

/** 规则验证结果 */
export interface RuleValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 违规的规则 */
  violations: Array<{
    rule: RuleNode;
    violation: string;
    severity: 'error' | 'warning';
  }>;
  /** 检测到的冲突 */
  conflicts: Array<{
    ruleA: RuleNode;
    ruleB: RuleNode;
    conflictType: 'direct' | 'inheritance' | 'dependency';
    description: string;
  }>;
}

/** 规则效果预测结果 */
export interface RulePrediction {
  /** 预测的场景影响 */
  sceneImpact: string;
  /** 对 AI 生成的引导方向 */
  generationBias: string;
  /** 可能触发的其他规则 */
  triggeredRules: string[];
  /** 置信度 */
  confidence: number;
}

/** 世界规则集合 */
export interface WorldRules {
  /** 物理法则层 - 不可违背的基础规则 */
  physics: RuleNode[];
  /** 社会规则层 - 可演变的社会结构 */
  society: RuleNode[];
  /** 叙事规则层 - 故事发展的约束与引导 */
  narrative: RuleNode[];
  /** 用户自定义层 - 创作者设定的特殊规则 */
  custom: RuleNode[];
}

/** 规则引擎配置 */
export interface RuleEngineConfig {
  /** 默认规则组装配置 */
  defaultAssemblyConfig: RuleAssemblyConfig;
  /** 是否启用语义匹配 */
  enableSemanticMatch: boolean;
  /** 语义匹配阈值 */
  semanticThreshold: number;
  /** 关键词匹配权重 */
  keywordWeight: number;
  /** 语义匹配权重 */
  semanticWeight: number;
}
