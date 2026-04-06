/**
 * OpenAI 风格 API Provider
 * 兼容 OpenAI / DeepSeek / Moonshot / 任何 OpenAI 兼容接口
 */

import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo, ProviderConfig } from '../types/provider.js';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';
  readonly type: ProviderConfig['type'] = 'openai';

  private client: OpenAI;

  constructor(config: {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
  }) {
    super(config.defaultModel ?? 'gpt-4o');
    this.client = new OpenAI({
      apiKey: config.apiKey || 'not-provided',
      baseURL: config.baseURL || 'https://api.openai.com/v1',
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.getModel(options),
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.name ? { name: m.name } : {}),
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stop,
        ...(options?.responseFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? '',
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: choice?.finish_reason ?? undefined,
      };
    });
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.getModel(options),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { content: delta, done: false };
      }
    }
    yield { content: '', done: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const list = await this.client.models.list();
      const models: ModelInfo[] = [];
      for await (const model of list) {
        models.push({
          id: model.id,
          name: model.id,
          provider: this.name,
        });
      }
      return models;
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
