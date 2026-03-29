/**
 * World-Keeper — 世界观守护者
 * 维护设定一致性，提供世界背景细节
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest } from '../types/agent.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'world-keeper',
  name: '世界观守护者',
  description: '当需要确认世界观设定、历史背景、地理信息、魔法规则或设定一致性时使用。',
  systemPrompt: `你是世界观守护者（World-Keeper），负责维护游戏世界的设定一致性。

你的核心职责：
1. 确保所有叙事内容符合世界观设定
2. 提供符合背景的细节描写（地理、文化、历史、魔法等）
3. 拒绝或修正违背设定的内容
4. 在不破坏设定的前提下，合理扩展世界细节

工作准则：
- 基于已有设定进行回答，不随意编造与设定矛盾的内容
- 当被问到未定义的细节时，给出合理推演并标注"推演"
- 回复以结构化信息为主，供 Narrator 整合使用
- 简洁明了，控制在 100-200 字

回复格式：
【设定确认】符合/不符合/需要补充
【细节】相关世界观细节
【建议】对叙事的建议（如有）`,
  temperature: 0.5,
};

export class WorldKeeper extends BaseAgent {
  private worldLore: string[] = [];

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
  }

  /** 加载世界观资料 */
  loadLore(lore: string[]): void {
    this.worldLore = lore;
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = this.config.systemPrompt;
    if (this.worldLore.length > 0) {
      prompt += `\n\n===== 世界设定资料 =====\n${this.worldLore.join('\n\n')}`;
    }
    return prompt;
  }
}
