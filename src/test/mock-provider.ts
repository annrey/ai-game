/**
 * MockProvider — 模拟 AI Provider
 * 用于测试中替代真实 AI 后端，返回预设响应
 */

import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
} from '../types/provider.js';

export class MockProvider implements AIProvider {
  readonly name: string;
  readonly type: ProviderConfig['type'];

  /** 预设的响应队列，按顺序消费 */
  responses: string[] = [];

  /** 记录所有 chat 调用的参数 */
  chatCalls: { messages: ChatMessage[]; options?: ChatOptions }[] = [];

  /** 记录所有 stream 调用的参数 */
  streamCalls: { messages: ChatMessage[]; options?: ChatOptions }[] = [];

  /** 模拟的可用性状态 */
  available = true;

  /** 模拟的模型列表 */
  models: ModelInfo[] = [
    { id: 'mock-model', name: 'Mock Model', provider: 'mock', contextLength: 4096 },
  ];

  /** 如果设置，chat() 将抛出此错误 */
  errorToThrow?: Error;

  constructor(name = 'mock', type: ProviderConfig['type'] = 'ollama') {
    this.name = name;
    this.type = type;
  }

  /** 添加预设响应 */
  addResponse(...responses: string[]): this {
    this.responses.push(...responses);
    return this;
  }

  /** 设置让 chat() 抛出错误 */
  setError(error: Error): this {
    this.errorToThrow = error;
    return this;
  }

  /** 重置所有记录 */
  reset(): void {
    this.responses = [];
    this.chatCalls = [];
    this.streamCalls = [];
    this.errorToThrow = undefined;
    this.available = true;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    this.chatCalls.push({ messages, options });

    if (this.errorToThrow) {
      throw this.errorToThrow;
    }

    const content = this.responses.shift() ?? '默认模拟响应';

    return {
      content,
      model: options?.model ?? 'mock-model',
      usage: {
        promptTokens: messages.reduce((sum, m) => sum + m.content.length, 0),
        completionTokens: content.length,
        totalTokens: messages.reduce((sum, m) => sum + m.content.length, 0) + content.length,
      },
    };
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    this.streamCalls.push({ messages, options });

    if (this.errorToThrow) {
      throw this.errorToThrow;
    }

    const content = this.responses.shift() ?? '默认模拟响应';

    // 模拟逐字符流式输出
    for (let i = 0; i < content.length; i++) {
      yield {
        content: content[i],
        done: i === content.length - 1,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.models;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}
