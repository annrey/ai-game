/**
 * Drama-Curator — 剧情策划
 * 管理伏笔、高潮和情感曲线
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest } from '../types/agent.js';
import type { PlotPoint } from '../types/scene.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'drama-curator',
  name: '剧情策划',
  description: '当需要管理剧情节奏、伏笔、高潮或情感曲线时使用。可选启用。',
  systemPrompt: `你是剧情策划（Drama-Curator），负责从宏观层面管理故事的戏剧性。

你的核心职责：
1. 追踪并管理所有剧情线索和伏笔
2. 评估当前叙事的节奏和张力
3. 在合适的时机推动剧情高潮或转折
4. 确保故事有情感深度和戏剧性

工作准则：
- 不直接对玩家说话，而是向 Narrator 提供建议
- 追踪"切赫夫之枪"——已埋下的伏笔必须在合适时机回收
- 监控情感曲线：紧张→释放→紧张的节奏
- 不要急于揭示所有谜团，保持悬念

回复格式：
【节奏评估】：当前叙事节奏（紧张/平稳/低谷/高潮）
【剧情建议】：对下一步叙事的建议
【伏笔状态】：可以激活的伏笔
【情感方向】：建议的情感走向`,
  temperature: 0.7,
};

export class DramaCurator extends BaseAgent {
  private plotArcs: PlotPoint[] = [];

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
  }

  /** 添加剧情点 */
  addPlotPoint(point: PlotPoint): void {
    this.plotArcs.push(point);
  }

  /** 更新剧情状态 */
  updatePlotStatus(id: string, status: PlotPoint['status']): void {
    const plot = this.plotArcs.find(p => p.id === id);
    if (plot) {
      plot.status = status;
    }
  }

  /** 获取当前活跃剧情 */
  getActivePlots(): PlotPoint[] {
    return this.plotArcs.filter(p => p.status === 'active' || p.status === 'foreshadowed');
  }

  /** 评估叙事节奏 */
  async evaluatePacing(
    recentEvents: string[],
    context: Record<string, unknown>,
  ): Promise<string> {
    const request: AgentRequest = {
      from: 'narrator',
      content: `请评估当前叙事节奏并给出建议。\n\n最近发生的事件：\n${recentEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n当前活跃伏笔：\n${this.getActivePlots().map(p => `- ${p.name}（${p.status}）`).join('\n')}`,
      context,
    };

    const response = await this.process(request);
    return response.content;
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = this.config.systemPrompt;
    if (this.plotArcs.length > 0) {
      const arcs = this.plotArcs
        .map(p => `- [${p.status}] ${p.name}：${p.description}`)
        .join('\n');
      prompt += `\n\n===== 剧情弧线总览 =====\n${arcs}`;
    }
    return prompt;
  }
}
