/**
 * 代理基类
 * 所有 AI 说书人继承此类
 */

import type { AIProvider, ChatMessage, ChatOptions } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse, AgentRole, GameAgent, ChainOfThought } from '../types/agent.js';
import { HISTORY, TEMPERATURE } from '../constants.js';
import { extractChainOfThought as parseChainOfThought } from '../utils/chain-of-thought.js';

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
    return parseChainOfThought(content, this.role, startTime, endTime);
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
