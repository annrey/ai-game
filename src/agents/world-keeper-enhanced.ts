/**
 * World-Keeper Enhanced — 增强版世界观守护者
 * 集成语义规则匹配和动态上下文组装
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse } from '../types/agent.js';
import { RuleEngine } from '../rules/rule-engine.js';
import type { WorldRules, SceneContext, RuleNode } from '../rules/rule-types.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'world-keeper',
  name: '世界观守护者',
  description: '维护世界设定一致性，基于语义场景匹配相关规则',
  systemPrompt: `你是世界观守护者（World-Keeper），负责维护游戏世界的设定一致性。

你的核心职责：
1. 基于当前场景智能匹配和应用相关世界规则
2. 确保所有叙事内容符合世界观设定
3. 提供符合背景的细节描写（地理、文化、历史、魔法等）
4. 检测并指出潜在的设定冲突

工作准则：
- 优先应用【物理法则】和【硬性规则】
- 根据场景语义动态选择相关规则
- 当被问到未定义的细节时，基于已有规则合理推演并标注"推演"
- 发现规则冲突时明确指出并建议解决方案
- 简洁明了，控制在 100-200 字

回复格式：
【设定确认】符合/不符合/需要补充/存在冲突
【应用规则】列出本场景触发的关键规则
【细节】相关世界观细节
【建议】对叙事的建议（如有）`,
  temperature: 0.5,
};

export interface WorldKeeperContext {
  /** 当前场景描述 */
  sceneDescription: string;
  /** 地点 */
  location?: string;
  /** 涉及角色 */
  characters?: string[];
  /** 事件类型 */
  eventType?: string;
  /** 情绪基调 */
  mood?: string;
}

export class WorldKeeperEnhanced extends BaseAgent {
  private ruleEngine: RuleEngine;
  private worldLore: string[] = [];

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
    this.ruleEngine = new RuleEngine({
      enableSemanticMatch: true,
      semanticThreshold: 0.5,
    });
  }

  /** 加载世界规则（新接口） */
  loadWorldRules(rules: WorldRules): void {
    this.ruleEngine.loadWorldRules(rules);
  }

  /** 加载世界观资料（兼容旧接口） */
  loadLore(lore: string[]): void {
    this.worldLore = lore;
  }

  /** 添加单条规则 */
  addRule(rule: RuleNode): void {
    this.ruleEngine.addRule(rule);
  }

  /**
   * 分析场景并返回匹配的规则
   */
  analyzeScene(context: WorldKeeperContext): {
    matchedRules: Array<{ rule: RuleNode; score: number; reason: string }>;
    assembledContext: string;
  } {
    const sceneContext: SceneContext = {
      description: context.sceneDescription,
      location: context.location,
      characters: context.characters,
      eventType: context.eventType,
      mood: context.mood,
    };

    // 1. 匹配规则
    const matches = this.ruleEngine.matchRules(sceneContext);

    // 2. 组装上下文
    const assembledContext = this.ruleEngine.assembleRules(matches, {
      maxTokens: 1500,
      detectConflicts: true,
      autoResolveConflicts: true,
      minRules: 2,
      maxRules: 8,
    });

    return {
      matchedRules: matches.slice(0, 5).map(m => ({
        rule: m.rule,
        score: m.score,
        reason: m.reason,
      })),
      assembledContext,
    };
  }

  /**
   * 处理请求（增强版）
   */
  async processEnhanced(
    request: AgentRequest,
    sceneContext: WorldKeeperContext,
  ): Promise<AgentResponse> {
    // 1. 分析场景获取相关规则
    const { matchedRules, assembledContext } = this.analyzeScene(sceneContext);

    // 2. 构建增强的系统提示
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      request,
      assembledContext,
      matchedRules,
    );

    // 3. 调用 AI
    const messages = [
      { role: 'system' as const, content: enhancedSystemPrompt },
      ...(request.history || []),
      { role: 'user' as const, content: request.content },
    ];

    const response = await this.provider.chat(messages, {
      temperature: this.config.temperature,
      maxTokens: 500,
    });

    return {
      from: this.config.role,
      content: response.content,
      metadata: {
        matchedRules: matchedRules.map(r => r.rule.id),
        ruleScores: matchedRules.map(r => r.score),
      },
      usage: response.usage,
    };
  }

  /**
   * 检测规则冲突
   */
  detectConflicts(): ReturnType<RuleEngine['validateRules']> {
    const allRules = this.ruleEngine.getAllRules();
    return this.ruleEngine.validateRules(allRules);
  }

  /**
   * 获取规则图谱信息
   */
  getRuleGraphInfo(): {
    totalRules: number;
    layerDistribution: Record<string, number>;
    conflicts: number;
  } {
    const allRules = this.ruleEngine.getAllRules();
    const validation = this.detectConflicts();

    const layerDistribution: Record<string, number> = {};
    for (const rule of allRules) {
      layerDistribution[rule.layer] = (layerDistribution[rule.layer] || 0) + 1;
    }

    return {
      totalRules: allRules.length,
      layerDistribution,
      conflicts: validation.conflicts.length,
    };
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    // 基础实现，保持兼容性
    let prompt = this.config.systemPrompt;
    if (this.worldLore.length > 0) {
      prompt += `\n\n===== 世界设定资料 =====\n${this.worldLore.join('\n\n')}`;
    }
    return prompt;
  }

  /**
   * 构建增强的系统提示
   */
  private buildEnhancedSystemPrompt(
    request: AgentRequest,
    assembledRules: string,
    matchedRules: Array<{ rule: RuleNode; score: number; reason: string }>,
  ): string {
    const parts: string[] = [this.config.systemPrompt];

    // 1. 添加传统 lore（兼容旧数据）
    if (this.worldLore.length > 0) {
      parts.push('===== 世界背景资料 =====');
      parts.push(...this.worldLore.slice(0, 3)); // 限制数量
      parts.push('');
    }

    // 2. 添加动态组装的规则
    if (assembledRules) {
      parts.push('===== 当前场景适用规则 =====');
      parts.push(assembledRules);
      parts.push('');
    }

    // 3. 添加匹配信息（帮助调试）
    parts.push('===== 规则匹配详情 =====');
    for (const { rule, score, reason } of matchedRules.slice(0, 3)) {
      parts.push(`- ${rule.id} [${rule.layer}] 匹配度: ${(score * 100).toFixed(1)}% (${reason})`);
    }
    parts.push('');

    return parts.join('\n');
  }
}
