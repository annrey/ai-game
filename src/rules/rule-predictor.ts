/**
 * 规则效果预测器
 * 让创作者在设定规则时预览效果
 */

import type { AIProvider } from '../types/provider.js';
import type { RuleNode, RulePrediction, SceneContext } from './rule-types.js';

export interface PredictionRequest {
  /** 要测试的规则 */
  rule: RuleNode;
  /** 测试场景 */
  testScene: SceneContext;
  /** 对比基准（无此规则时的生成） */
  baseline?: string;
}

export interface PredictionResult {
  /** 预测结果 */
  prediction: RulePrediction;
  /** 示例生成（模拟） */
  exampleGeneration: string;
  /** 建议 */
  suggestions: string[];
  /** 潜在问题 */
  potentialIssues: string[];
}

/**
 * 规则效果预测器
 * 帮助创作者理解规则的影响
 */
export class RulePredictor {
  private provider?: AIProvider;
  private model?: string;

  constructor(provider?: AIProvider, model?: string) {
    this.provider = provider;
    this.model = model;
  }

  /**
   * 预测规则效果
   * 使用启发式方法 + AI 辅助
   */
  async predict(request: PredictionRequest): Promise<PredictionResult> {
    const { rule, testScene } = request;

    // 1. 启发式分析
    const heuristicPrediction = this.heuristicPredict(rule, testScene);

    // 2. AI 增强分析（如果有 provider）
    let aiPrediction: Partial<RulePrediction> = {};
    if (this.provider) {
      aiPrediction = await this.aiAssistPredict(rule, testScene);
    }

    // 3. 合并结果
    const prediction: RulePrediction = {
      sceneImpact: aiPrediction.sceneImpact || heuristicPrediction.sceneImpact,
      generationBias: aiPrediction.generationBias || heuristicPrediction.generationBias,
      triggeredRules: heuristicPrediction.triggeredRules,
      confidence: heuristicPrediction.confidence,
    };

    // 4. 生成示例
    const exampleGeneration = await this.generateExample(rule, testScene);

    // 5. 生成建议
    const suggestions = this.generateSuggestions(rule, prediction);

    // 6. 检测潜在问题
    const potentialIssues = this.detectIssues(rule, prediction);

    return {
      prediction,
      exampleGeneration,
      suggestions,
      potentialIssues,
    };
  }

  /**
   * 启发式预测
   * 基于规则特征快速分析
   */
  private heuristicPredict(rule: RuleNode, scene: SceneContext): RulePrediction {
    const impacts: string[] = [];
    const biases: string[] = [];
    const triggered: string[] = [];
    let confidence = 0.7;

    // 分析规则内容关键词
    const content = rule.content.toLowerCase();

    // 场景影响分析
    if (content.includes('禁止') || content.includes('不能') || content.includes('无法')) {
      impacts.push('限制某些行为或事件的发生');
      biases.push('AI 会避免生成被禁止的内容');
      confidence += 0.1;
    }

    if (content.includes('必须') || content.includes('一定') || content.includes('总是')) {
      impacts.push('强制某些元素出现在场景中');
      biases.push('AI 会优先包含强制性元素');
      confidence += 0.1;
    }

    if (content.includes('魔法') || content.includes('超自然')) {
      impacts.push('改变世界的物理/逻辑约束');
      biases.push('AI 会将超自然因素纳入因果推理');
      triggered.push('magic-system');
    }

    if (content.includes('社会') || content.includes('阶级') || content.includes('文化')) {
      impacts.push('影响角色行为和互动模式');
      biases.push('AI 会让角色遵循社会规范');
      triggered.push('social-norms');
    }

    // 优先级影响
    if (rule.priority === 'hard') {
      impacts.push('这是一条硬性约束，几乎不会被打破');
      confidence += 0.1;
    } else if (rule.priority === 'suggestion') {
      impacts.push('这是一条建议，AI 可能会根据上下文灵活处理');
      confidence -= 0.1;
    }

    // 层级影响
    const layerImpacts: Record<string, string> = {
      physics: '影响世界的基础运作方式',
      society: '影响角色关系和群体行为',
      narrative: '影响故事节奏和结构',
      custom: '体现创作者的独特设定',
    };

    if (layerImpacts[rule.layer]) {
      impacts.push(layerImpacts[rule.layer]);
    }

    return {
      sceneImpact: impacts.join('；') || '对场景影响较小',
      generationBias: biases.join('；') || '对生成方向影响中性',
      triggeredRules: triggered,
      confidence: Math.min(confidence, 1.0),
    };
  }

  /**
   * AI 辅助预测
   * 使用 AI 深入分析规则效果
   */
  private async aiAssistPredict(rule: RuleNode, scene: SceneContext): Promise<Partial<RulePrediction>> {
    if (!this.provider) {
      return {};
    }

    const prompt = `请分析以下游戏规则对场景的影响：

【规则】
${rule.content}

【规则意图】
${rule.intent}

【测试场景】
${scene.description}
${scene.userInput ? `【用户输入】${scene.userInput}` : ''}

请分析：
1. 这条规则会如何改变上述场景？
2. 它会对 AI 的生成方向产生什么引导？

用简洁的中文回答。`;

    try {
      const response = await this.provider.chat([
        { role: 'system', content: '你是游戏规则分析专家，擅长预测规则对叙事的影响。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.7, maxTokens: 500 });

      // 解析 AI 回复
      const content = response.content;
      const lines = content.split('\n');

      let sceneImpact = '';
      let generationBias = '';

      for (const line of lines) {
        if (line.includes('场景') || line.includes('改变')) {
          sceneImpact = line.replace(/^[^：]*[：:]/, '').trim();
        }
        if (line.includes('生成') || line.includes('引导') || line.includes('方向')) {
          generationBias = line.replace(/^[^：]*[：:]/, '').trim();
        }
      }

      return {
        sceneImpact: sceneImpact || content.slice(0, 100),
        generationBias: generationBias || '参见场景影响分析',
      };
    } catch {
      return {};
    }
  }

  /**
   * 生成示例
   * 展示规则应用前后的对比
   */
  private async generateExample(rule: RuleNode, scene: SceneContext): Promise<string> {
    if (!this.provider) {
      return '（需要 AI Provider 才能生成示例）';
    }

    const prompt = `场景：${scene.description}
${scene.userInput ? `玩家输入：${scene.userInput}` : ''}

请根据以下规则生成一段叙事：
规则：${rule.content}

生成 2-3 句话的叙事内容。`;

    try {
      const response = await this.provider.chat([
        { role: 'system', content: '你是叙事生成专家。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.8, maxTokens: 300 });

      return response.content;
    } catch {
      return '（示例生成失败）';
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(rule: RuleNode, prediction: RulePrediction): string[] {
    const suggestions: string[] = [];

    // 基于优先级的建议
    if (rule.priority === 'hard' && !rule.content.includes('例外')) {
      suggestions.push('硬性规则建议添加"例外条款"，避免绝对化导致叙事僵化');
    }

    if (rule.priority === 'soft' && rule.layer === 'physics') {
      suggestions.push('物理法则层建议使用 hard 优先级，确保世界一致性');
    }

    // 基于内容的建议
    if (rule.content.length < 20) {
      suggestions.push('规则描述较短，建议补充具体场景示例');
    }

    if (!rule.intent || rule.intent.length < 10) {
      suggestions.push('建议完善"意图"描述，帮助系统进行语义匹配');
    }

    if (!rule.keywords || rule.keywords.length === 0) {
      suggestions.push('建议添加关键词，提高规则触发准确率');
    }

    // 基于预测的建议
    if (prediction.confidence < 0.6) {
      suggestions.push('规则效果预测置信度较低，建议通过实际测试验证');
    }

    if (prediction.triggeredRules.length > 3) {
      suggestions.push('此规则可能触发较多其他规则，注意组合效果');
    }

    return suggestions;
  }

  /**
   * 检测潜在问题
   */
  private detectIssues(rule: RuleNode, prediction: RulePrediction): string[] {
    const issues: string[] = [];
    const content = rule.content.toLowerCase();

    // 检测矛盾表述
    const contradictions = [
      { a: '必须', b: '禁止' },
      { a: '总是', b: '从不' },
      { a: '所有人', b: '没有人' },
    ];

    for (const { a, b } of contradictions) {
      if (content.includes(a) && content.includes(b)) {
        issues.push(`规则中同时包含"${a}"和"${b}"，可能存在逻辑矛盾`);
      }
    }

    // 检测过于宽泛
    if (content.includes('所有') || content.includes('任何') || content.includes('一切')) {
      issues.push('使用"所有/任何/一切"等绝对化词汇可能导致规则过于严苛');
    }

    // 检测模糊表述
    const vagueWords = ['适当', '合理', '必要时', '可能', '也许'];
    for (const word of vagueWords) {
      if (content.includes(word)) {
        issues.push(`包含模糊词汇"${word}"，AI 理解可能存在偏差`);
        break;
      }
    }

    // 检测冲突风险
    if (rule.conflictsWith && rule.conflictsWith.length > 2) {
      issues.push('此规则与多条其他规则冲突，建议重新审视设计');
    }

    return issues;
  }

  /**
   * 批量对比多条规则
   */
  async compareRules(rules: RuleNode[], testScene: SceneContext): Promise<Array<PredictionResult & { rule: RuleNode }>> {
    const results = [];

    for (const rule of rules) {
      const prediction = await this.predict({ rule, testScene });
      results.push({ ...prediction, rule });
    }

    return results;
  }
}
