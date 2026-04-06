/**
 * Narrator — 主控叙事 AI
 * 接收玩家输入，协调其他代理，整合响应，输出最终叙事
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse, GameAgent } from '../types/agent.js';
import { LIMITS, TEMPERATURE } from '../constants.js';

interface AgentTiming {
  role: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
}

function createDefaultConfig(): AgentConfig {
  return {
    role: 'narrator',
    name: '主叙述者',
    description: '负责整体叙事节奏、玩家交互和协调其他说书人。是整个系统的调度中枢。',
    systemPrompt: `你是一位经验丰富的主叙述者（Narrator），负责协调一场精彩的冒险故事。

你的核心职责：
1. 接收玩家的自由自然语言输入，解析玩家的意图和行动
2. 给出生动、沉浸式的叙事回应，根据玩家的输入动态推动游戏进程和场景发展
3. 协调其他AI说书人（世界观守护者、NPC导演、规则仲裁者、剧情策划）的工作
4. 整合所有信息，输出流畅统一的叙事文本
5. 维持故事的节奏和张力

叙事风格与规则：
- 第二人称视角（"你看到..."、"你感觉到..."）
- 生动具体的感官描写
- 在行动与对话间保持平衡
- 支持玩家自然语言对话输入，不要提供固定的选项让玩家选择，而是描述当前情境并等待玩家的自由回复
- 每次回复控制在 ${LIMITS.NARRATIVE_MIN_WORDS}-${LIMITS.NARRATIVE_MAX_WORDS} 字
- 仔细阅读上下文中的 \`inventory\` (物品栏) 和 \`quests\` (任务) 状态。如果玩家试图使用没有的物品，或完成未接取的任务，应在叙事中合理地指出（如"你在背包里摸索了半天，并没有找到钥匙"）。
- 当玩家获得了新物品或新任务，在叙事中明确地描写出来（如"村长递给你一把铁剑"）。
- **特殊指令处理**：如果玩家输入表示"等待时间流逝"或处于"闲置/观察"状态，重点描写周围环境的自然演变（如天色变暗、微风吹过）、NPC 的自发活动，或者抛出一个随机的突发事件，不要强迫玩家立即行动。

协调原则：
- 当涉及世界设定时，参考世界观守护者的意见
- 当涉及 NPC 时，采纳 NPC 导演提供的反应
- 当涉及规则判定时，遵循规则仲裁者的裁决
- 当涉及剧情走向时，考虑剧情策划的建议

永远保持故事的趣味性和一致性。`,
    temperature: TEMPERATURE.NARRATOR,
  };
}

export class Narrator extends BaseAgent {
  private subAgents = new Map<string, GameAgent>();

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...createDefaultConfig(), ...configOverride }, provider, model);
  }

  /** 注册子代理 */
  registerSubAgent(agent: GameAgent): void {
    this.subAgents.set(agent.role, agent);
  }

  /** 完整的协调处理流程 */
  async orchestrate(playerInput: string, sceneContext: Record<string, unknown>): Promise<{
    narrative: string;
    agentResponses: AgentResponse[];
    errors: AgentResponse[];
    performanceMetrics?: {
      totalDuration: number;
      analysisDuration: number;
      parallelExecutionDuration: number;
      agentTimings: AgentTiming[];
    };
  }> {
    const agentResponses: AgentResponse[] = [];
    const errors: AgentResponse[] = [];
    const agentTimings: AgentTiming[] = [];
    const totalStartTime = Date.now();
    let analysisDuration = 0;
    let parallelExecutionDuration = 0;

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
        const analysisStartTime = Date.now();
        const analysis = await this.provider.chat(
          this.buildMessages(analysisRequest),
          { model: this.model, temperature: TEMPERATURE.ANALYSIS, responseFormat: 'json' },
        );
        analysisDuration = Date.now() - analysisStartTime;

        const parsed = JSON.parse(analysis.content);
        const toConsult: string[] = parsed.consult ?? [];

        console.log(`[Narrator] 分析完成，需要咨询 ${toConsult.length} 个代理: ${toConsult.join(', ')}`);

        // 并行咨询相关代理，并捕获单个代理的错误
        const parallelStartTime = Date.now();
        const consultPromises = toConsult
          .filter(role => this.subAgents.has(role))
          .map(async role => {
            const agent = this.subAgents.get(role)!;
            const startTime = Date.now();
            try {
              const resp = await agent.process({
                from: 'narrator',
                content: playerInput,
                context: sceneContext,
              });
              const endTime = Date.now();
              const duration = endTime - startTime;
              agentTimings.push({
                role: agent.role,
                startTime,
                endTime,
                duration,
                success: true,
              });
              console.log(`[Narrator] 代理 ${agent.role} 响应完成，耗时 ${duration}ms`);
              agentResponses.push(resp);
              return resp;
            } catch (agentError) {
              const endTime = Date.now();
              const duration = endTime - startTime;
              agentTimings.push({
                role: agent.role,
                startTime,
                endTime,
                duration,
                success: false,
              });
              const errorInfo: AgentResponse = {
                from: agent.role,
                content: '',
                error: {
                  type: 'AGENT_PROCESS_ERROR',
                  message: agentError instanceof Error ? agentError.message : String(agentError),
                  agentRole: agent.role,
                },
              };
              console.error(`[Narrator] 代理 ${agent.role} 处理失败，耗时 ${duration}ms:`, errorInfo.error?.message);
              errors.push(errorInfo);
              return errorInfo;
            }
          });

        await Promise.all(consultPromises);
        parallelExecutionDuration = Date.now() - parallelStartTime;
        console.log(`[Narrator] 并行执行 ${consultPromises.length} 个代理完成，总耗时 ${parallelExecutionDuration}ms`);
      } catch (analysisError) {
        // 分析失败时记录错误，但不阻断主流程（使用降级策略）
        errors.push({
          from: 'narrator',
          content: '',
          error: {
            type: 'ANALYSIS_ERROR',
            message: analysisError instanceof Error ? analysisError.message : String(analysisError),
          },
        });
        console.error('[Narrator] 分析阶段失败，启用降级策略:', analysisError);

        // 降级策略：当分析失败时，尝试咨询所有可用的子代理
        const fallbackStartTime = Date.now();
        const fallbackPromises = Array.from(this.subAgents.values()).map(async agent => {
          const startTime = Date.now();
          try {
            const resp = await agent.process({
              from: 'narrator',
              content: playerInput,
              context: sceneContext,
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            agentTimings.push({
              role: agent.role,
              startTime,
              endTime,
              duration,
              success: true,
            });
            console.log(`[Narrator] 降级策略 - 代理 ${agent.role} 响应完成，耗时 ${duration}ms`);
            agentResponses.push(resp);
            return resp;
          } catch (agentError) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            agentTimings.push({
              role: agent.role,
              startTime,
              endTime,
              duration,
              success: false,
            });
            const errorInfo: AgentResponse = {
              from: agent.role,
              content: '',
              error: {
                type: 'FALLBACK_AGENT_ERROR',
                message: agentError instanceof Error ? agentError.message : String(agentError),
                agentRole: agent.role,
              },
            };
            console.error(`[Narrator] 降级策略 - 代理 ${agent.role} 处理失败，耗时 ${duration}ms:`, errorInfo.error?.message);
            errors.push(errorInfo);
            return errorInfo;
          }
        });
        await Promise.all(fallbackPromises);
        parallelExecutionDuration = Date.now() - fallbackStartTime;
        console.log(`[Narrator] 降级策略并行执行完成，总耗时 ${parallelExecutionDuration}ms`);
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
    const totalDuration = Date.now() - totalStartTime;

    console.log(`[Narrator] orchestrate 总耗时: ${totalDuration}ms (分析: ${analysisDuration}ms, 并行执行: ${parallelExecutionDuration}ms)`);

    return {
      narrative: narrative.content,
      agentResponses,
      errors,
      performanceMetrics: {
        totalDuration,
        analysisDuration,
        parallelExecutionDuration,
        agentTimings,
      },
    };
  }

  /** 流式协调处理流程 */
  async *orchestrateStream(playerInput: string, sceneContext: Record<string, unknown>): AsyncIterable<{
    type: string;
    [key: string]: any;
    performanceMetrics?: {
      totalDuration: number;
      analysisDuration: number;
      parallelExecutionDuration: number;
      agentTimings: AgentTiming[];
    };
  }> {
    const agentResponses: AgentResponse[] = [];
    const errors: AgentResponse[] = [];
    const agentTimings: AgentTiming[] = [];
    const totalStartTime = Date.now();
    let analysisDuration = 0;
    let parallelExecutionDuration = 0;

    const analysisRequest: AgentRequest = {
      from: 'player',
      content: `分析以下玩家输入，判断需要咨询哪些专家（返回 JSON 格式）：
角色列表：world-keeper, npc-director, rule-arbiter, drama-curator
玩家输入：${playerInput}
请返回 JSON：{"consult": ["角色名"], "reason": "原因"}`,
      context: sceneContext,
    };

    if (this.subAgents.size > 0) {
      try {
        const analysisStartTime = Date.now();
        const analysis = await this.provider.chat(
          this.buildMessages(analysisRequest),
          { model: this.model, temperature: TEMPERATURE.ANALYSIS, responseFormat: 'json' },
        );
        analysisDuration = Date.now() - analysisStartTime;

        const parsed = JSON.parse(analysis.content);
        const toConsult: string[] = parsed.consult ?? [];

        console.log(`[Narrator] Stream 分析完成，需要咨询 ${toConsult.length} 个代理: ${toConsult.join(', ')}`);
        yield { type: 'analysis_complete', consultedAgents: toConsult, analysisDuration };

        // 并行咨询相关代理，并捕获单个代理的错误
        const parallelStartTime = Date.now();
        const consultResults = await Promise.all(
          toConsult
            .filter(role => this.subAgents.has(role))
            .map(async role => {
              const agent = this.subAgents.get(role)!;
              const startTime = Date.now();
              try {
                const resp = await agent.process({
                  from: 'narrator',
                  content: playerInput,
                  context: sceneContext,
                });
                const endTime = Date.now();
                const duration = endTime - startTime;
                agentTimings.push({
                  role: agent.role,
                  startTime,
                  endTime,
                  duration,
                  success: true,
                });
                console.log(`[Narrator] Stream 代理 ${agent.role} 响应完成，耗时 ${duration}ms`);
                return { success: true, resp, duration } as const;
              } catch (agentError) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                agentTimings.push({
                  role: agent.role,
                  startTime,
                  endTime,
                  duration,
                  success: false,
                });
                const errorInfo: AgentResponse = {
                  from: agent.role,
                  content: '',
                  error: {
                    type: 'AGENT_PROCESS_ERROR',
                    message: agentError instanceof Error ? agentError.message : String(agentError),
                    agentRole: agent.role,
                  },
                };
                console.error(`[Narrator] Stream 代理 ${agent.role} 处理失败，耗时 ${duration}ms:`, errorInfo.error?.message);
                return { success: false, errorInfo, duration } as const;
              }
            })
        );
        parallelExecutionDuration = Date.now() - parallelStartTime;
        console.log(`[Narrator] Stream 并行执行 ${consultResults.length} 个代理完成，总耗时 ${parallelExecutionDuration}ms`);

        // 处理结果并 yield 错误
        for (const result of consultResults) {
          if (result.success) {
            agentResponses.push(result.resp);
          } else {
            errors.push(result.errorInfo);
            yield { type: 'error', role: result.errorInfo.from, error: result.errorInfo.error, duration: result.duration };
          }
        }

        // 按顺序输出成功响应的代理结果
        for (const resp of agentResponses) {
           yield { type: 'agent', role: resp.from, content: resp.content };
        }
      } catch (analysisError) {
        // 分析失败时记录错误，但不阻断主流程（使用降级策略）
        const analysisErrorInfo: AgentResponse = {
          from: 'narrator',
          content: '',
          error: {
            type: 'ANALYSIS_ERROR',
            message: analysisError instanceof Error ? analysisError.message : String(analysisError),
          },
        };
        errors.push(analysisErrorInfo);
        console.error('[Narrator] Stream 分析阶段失败，启用降级策略:', analysisError);
        yield { type: 'error', role: 'narrator', error: analysisErrorInfo.error };

        // 降级策略：当分析失败时，尝试咨询所有可用的子代理
        const fallbackStartTime = Date.now();
        const fallbackResults = await Promise.all(
          Array.from(this.subAgents.values()).map(async agent => {
            const startTime = Date.now();
            try {
              const resp = await agent.process({
                from: 'narrator',
                content: playerInput,
                context: sceneContext,
              });
              const endTime = Date.now();
              const duration = endTime - startTime;
              agentTimings.push({
                role: agent.role,
                startTime,
                endTime,
                duration,
                success: true,
              });
              console.log(`[Narrator] Stream 降级策略 - 代理 ${agent.role} 响应完成，耗时 ${duration}ms`);
              return { success: true, resp, duration } as const;
            } catch (agentError) {
              const endTime = Date.now();
              const duration = endTime - startTime;
              agentTimings.push({
                role: agent.role,
                startTime,
                endTime,
                duration,
                success: false,
              });
              const errorInfo: AgentResponse = {
                from: agent.role,
                content: '',
                error: {
                  type: 'FALLBACK_AGENT_ERROR',
                  message: agentError instanceof Error ? agentError.message : String(agentError),
                  agentRole: agent.role,
                },
              };
              console.error(`[Narrator] Stream 降级策略 - 代理 ${agent.role} 处理失败，耗时 ${duration}ms:`, errorInfo.error?.message);
              return { success: false, errorInfo, duration } as const;
            }
          })
        );
        parallelExecutionDuration = Date.now() - fallbackStartTime;
        console.log(`[Narrator] Stream 降级策略并行执行完成，总耗时 ${parallelExecutionDuration}ms`);

        // 处理降级策略结果
        for (const result of fallbackResults) {
          if (result.success) {
            agentResponses.push(result.resp);
          } else {
            errors.push(result.errorInfo);
            yield { type: 'error', role: result.errorInfo.from, error: result.errorInfo.error, duration: result.duration };
          }
        }

        // 输出成功响应的代理结果
        for (const resp of agentResponses) {
          if (!resp.error) {
            yield { type: 'agent', role: resp.from, content: resp.content };
          }
        }
      }
    }

    const consultContext = agentResponses.length > 0
      ? `\n\n其他说书人的意见：\n${agentResponses.map(r => `【${r.from}】：${r.content}`).join('\n\n')}`
      : '';

    const narrativeRequest: AgentRequest = {
      from: 'player',
      content: `${playerInput}${consultContext}`,
      context: sceneContext,
    };

    let full = '';
    for await (const chunk of this.processStream(narrativeRequest)) {
      full += chunk;
      yield { type: 'chunk', content: chunk };
    }

    const totalDuration = Date.now() - totalStartTime;
    console.log(`[Narrator] orchestrateStream 总耗时: ${totalDuration}ms (分析: ${analysisDuration}ms, 并行执行: ${parallelExecutionDuration}ms)`);

    yield {
      type: 'done',
      full,
      agentResponses,
      errors,
      performanceMetrics: {
        totalDuration,
        analysisDuration,
        parallelExecutionDuration,
        agentTimings,
      }
    };
  }
}
