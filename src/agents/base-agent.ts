/**
 * 代理基类
 * 所有 AI 说书人继承此类
 */

import type { AIProvider, ChatMessage, ChatOptions } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse, AgentRole, GameAgent, ChainOfThought, CoTStep } from '../types/agent.js';
import { HISTORY, TEMPERATURE } from '../constants.js';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent implements GameAgent {
  readonly role: AgentRole;
  readonly name: string;
  readonly config: AgentConfig;

  protected provider: AIProvider;
  protected model?: string;
  protected history: ChatMessage[] = [];
  protected maxHistory: number = HISTORY.AGENT_MAX_HISTORY;

  constructor(config: AgentConfig, provider: AIProvider, model?: string) {
    this.role = config.role;
    this.name = config.name;
    this.config = config;
    this.provider = provider;
    this.model = model;
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const messages = this.buildMessages(request);

    const options: ChatOptions = {
      model: this.model,
      temperature: this.config.temperature ?? TEMPERATURE.DEFAULT,
    };

    const response = await this.provider.chat(messages, options);
    const endTime = Date.now();

    // 提取思维链
    const chainOfThought = this.extractChainOfThought(response.content, startTime, endTime);

    // 记录到历史
    this.history.push(
      { role: 'user', content: request.content },
      { role: 'assistant', content: response.content },
    );

    // 裁剪历史
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2);
    }

    return {
      from: this.role,
      content: response.content,
      chainOfThought,
      usage: response.usage,
      metadata: this.extractMetadata(response.content),
    };
  }

  async *processStream(request: AgentRequest): AsyncIterable<string> {
    const messages = this.buildMessages(request);
    const options: ChatOptions = {
      model: this.model,
      temperature: this.config.temperature ?? TEMPERATURE.DEFAULT,
    };

    let full = '';
    for await (const chunk of this.provider.stream(messages, options)) {
      if (chunk.content) {
        full += chunk.content;
        yield chunk.content;
      }
    }

    this.history.push(
      { role: 'user', content: request.content },
      { role: 'assistant', content: full },
    );
  }

  reset(): void {
    this.history = [];
  }

  setMaxHistoryTurns(maxTurns: number): void {
    const v = Math.max(1, Math.min(Math.floor(maxTurns), HISTORY.AGENT_MAX_HISTORY_TURNS));
    this.maxHistory = v;
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2);
    }
  }

  protected buildMessages(request: AgentRequest): ChatMessage[] {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: this.buildSystemPrompt(request),
    };

    const contextMessages: ChatMessage[] = [];

    // 加入上下文
    if (request.context) {
      contextMessages.push({
        role: 'system',
        content: `当前场景上下文:\n${JSON.stringify(request.context, null, 2)}`,
      });
    }

    // 拼接历史 + 当前请求
    const userMessage: ChatMessage = {
      role: 'user',
      content: request.content,
      name: request.from === 'player' ? 'player' : request.from,
    };

    return [
      systemMessage,
      ...contextMessages,
      ...this.history.slice(-this.maxHistory * 2),
      ...(request.history ?? []),
      userMessage,
    ];
  }

  /** 子类可覆盖以增强系统提示词 */
  protected buildSystemPrompt(request: AgentRequest): string {
    return this.config.systemPrompt;
  }

  /** 子类可覆盖以提取结构化元数据 */
  protected extractMetadata(_content: string): Record<string, unknown> | undefined {
    return undefined;
  }

  /**
   * 从响应中提取思维链
   * @param content AI 响应内容
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  protected extractChainOfThought(content: string, startTime: number, endTime: number): ChainOfThought {
    const totalDuration = endTime - startTime;
    
    // 尝试从内容中解析思维链（使用标记）
    const steps: CoTStep[] = [];
    
    // 定义思维链标记
    const markers = {
      observation: ['【观察】', '[Observation]', '## Observation', '观察：'],
      analysis: ['【分析】', '[Analysis]', '## Analysis', '分析：'],
      reasoning: ['【推理】', '[Reasoning]', '## Reasoning', '推理：'],
      decision: ['【决策】', '[Decision]', '## Decision', '决策：'],
      action: ['【行动】', '[Action]', '## Action', '行动：'],
    };

    // 提取每个步骤
    const stepTypes: Array<CoTStep['step']> = ['observation', 'analysis', 'reasoning', 'decision', 'action'];
    const stepTitles = {
      observation: '👁️ 观察',
      analysis: '🧠 分析',
      reasoning: '💭 推理',
      decision: '✅ 决策',
      action: '🎯 行动',
    };

    stepTypes.forEach((stepType, index) => {
      const stepMarkers = markers[stepType];
      let stepContent = '';
      
      // 查找标记
      for (const marker of stepMarkers) {
        const markerIndex = content.indexOf(marker);
        if (markerIndex !== -1) {
          // 提取从标记开始到下一个标记或结尾的内容
          const startIdx = markerIndex + marker.length;
          let endIdx = content.length;
          
          // 查找下一个标记
          for (const nextMarker of Object.values(markers).flat()) {
            const nextIdx = content.indexOf(nextMarker, startIdx);
            if (nextIdx !== -1 && nextIdx < endIdx) {
              endIdx = nextIdx;
            }
          }
          
          stepContent = content.substring(startIdx, endIdx).trim();
          break;
        }
      }
      
      if (stepContent) {
        steps.push({
          step: stepType,
          title: stepTitles[stepType],
          content: stepContent,
          duration: Math.floor(totalDuration / stepTypes.length),
        });
      }
    });

    // 如果没有找到标记化的思维链，生成一个简化的版本
    if (steps.length === 0) {
      steps.push({
        step: 'observation',
        title: '👁️ 观察',
        content: `收到请求：${content.substring(0, 100)}...`,
        duration: Math.floor(totalDuration * 0.2),
      });
      steps.push({
        step: 'analysis',
        title: '🧠 分析',
        content: '分析请求内容和上下文...',
        duration: Math.floor(totalDuration * 0.2),
      });
      steps.push({
        step: 'reasoning',
        title: '💭 推理',
        content: '基于知识和规则进行推理...',
        duration: Math.floor(totalDuration * 0.2),
      });
      steps.push({
        step: 'decision',
        title: '✅ 决策',
        content: '决定最佳响应方式...',
        duration: Math.floor(totalDuration * 0.2),
      });
      steps.push({
        step: 'action',
        title: '🎯 行动',
        content: '生成并发送响应',
        duration: Math.floor(totalDuration * 0.2),
      });
    }

    // 生成摘要
    const summary = this.generateChainOfThoughtSummary(steps);

    return {
      id: uuidv4(),
      agentRole: this.role,
      timestamp: endTime,
      steps,
      summary,
    };
  }

  /**
   * 生成思维链摘要
   */
  private generateChainOfThoughtSummary(steps: CoTStep[]): string {
    if (steps.length === 0) return '无思维链';
    
    const keySteps = steps.slice(0, 2);
    return keySteps.map(s => `${s.title}: ${s.content.substring(0, 50)}...`).join(' | ');
  }

  /**
   * 构建思维链提示词
   * 用于引导 AI 生成结构化的思维链
   */
  protected buildChainOfThoughtPrompt(): string {
    return `
请按照以下结构生成你的思考过程：

【观察】
描述你观察到的当前情境、玩家输入的关键信息、相关的上下文等。

【分析】
分析情境的重要性、玩家的真实意图、可能的影响因素等。

【推理】
基于你的知识和规则，推理出可能的结果、因果关系、逻辑链条等。

【决策】
基于推理结果，决定最佳的响应方式、行动方案等。

【行动】
描述你将采取的具体行动或生成的响应内容。

这种结构化的思考过程有助于提高响应的质量和一致性。
`;
  }
}
