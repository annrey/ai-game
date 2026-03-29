/**
 * Narrator — 主控叙事 AI
 * 接收玩家输入，协调其他代理，整合响应，输出最终叙事
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse, GameAgent } from '../types/agent.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'narrator',
  name: '主叙述者',
  description: '负责整体叙事节奏、玩家交互和协调其他说书人。是整个系统的调度中枢。',
  systemPrompt: `你是一位经验丰富的主叙述者（Narrator），负责协调一场精彩的冒险故事。

你的核心职责：
1. 接收玩家的行动和对话，给出生动、沉浸式的叙事回应
2. 协调其他AI说书人（世界观守护者、NPC导演、规则仲裁者、剧情策划）的工作
3. 整合所有信息，输出流畅统一的叙事文本
4. 维持故事的节奏和张力

叙事风格：
- 第二人称视角（"你看到..."、"你感觉到..."）
- 生动具体的感官描写
- 在行动与对话间保持平衡
- 为玩家留出选择空间，不要替玩家做决定
- 每次回复控制在 200-400 字

协调原则：
- 当涉及世界设定时，参考世界观守护者的意见
- 当涉及 NPC 时，采纳 NPC 导演提供的反应
- 当涉及规则判定时，遵循规则仲裁者的裁决
- 当涉及剧情走向时，考虑剧情策划的建议

永远保持故事的趣味性和一致性。`,
  temperature: 0.8,
};

export class Narrator extends BaseAgent {
  private subAgents = new Map<string, GameAgent>();

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
  }

  /** 注册子代理 */
  registerSubAgent(agent: GameAgent): void {
    this.subAgents.set(agent.role, agent);
  }

  /** 完整的协调处理流程 */
  async orchestrate(playerInput: string, sceneContext: Record<string, unknown>): Promise<{
    narrative: string;
    agentResponses: AgentResponse[];
  }> {
    const agentResponses: AgentResponse[] = [];

    // 第一步：分析玩家输入，决定需要咨询哪些代理
    const analysisRequest: AgentRequest = {
      from: 'player',
      content: `分析以下玩家输入，判断需要咨询哪些专家（返回 JSON 格式）：
角色列表：world-keeper, npc-director, rule-arbiter, drama-curator
玩家输入：${playerInput}
请返回 JSON：{"consult": ["角色名"], "reason": "原因"}`,
      context: sceneContext,
    };

    // 如果有子代理，尝试分析协调
    if (this.subAgents.size > 0) {
      try {
        const analysis = await this.provider.chat(
          this.buildMessages(analysisRequest),
          { model: this.model, temperature: 0.3, responseFormat: 'json' },
        );

        const parsed = JSON.parse(analysis.content);
        const toConsult: string[] = parsed.consult ?? [];

        // 并行咨询相关代理
        const consultPromises = toConsult
          .filter(role => this.subAgents.has(role))
          .map(async role => {
            const agent = this.subAgents.get(role)!;
            const resp = await agent.process({
              from: 'narrator',
              content: playerInput,
              context: sceneContext,
            });
            agentResponses.push(resp);
            return resp;
          });

        await Promise.all(consultPromises);
      } catch {
        // 分析失败时继续，不阻断主流程
      }
    }

    // 第二步：整合所有代理响应，生成最终叙事
    const consultContext = agentResponses.length > 0
      ? `\n\n其他说书人的意见：\n${agentResponses.map(r => `【${r.from}】：${r.content}`).join('\n\n')}`
      : '';

    const narrativeRequest: AgentRequest = {
      from: 'player',
      content: `${playerInput}${consultContext}`,
      context: sceneContext,
    };

    const narrative = await this.process(narrativeRequest);
    return {
      narrative: narrative.content,
      agentResponses,
    };
  }
}
