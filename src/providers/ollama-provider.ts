/**
 * Ollama 本地 Provider
 * 连接 Ollama 本地推理服务
 */

import { Ollama } from 'ollama';
import { BaseProvider } from './base-provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo, ProviderConfig } from '../types/provider.js';

export class OllamaProvider extends BaseProvider {
  readonly name = 'Ollama';
  readonly type: ProviderConfig['type'] = 'ollama';

  private client: Ollama;

  constructor(config?: {
    host?: string;
    defaultModel?: string;
  }) {
    super(config?.defaultModel ?? process.env.OLLAMA_MODEL ?? 'llama3.2');
    this.client = new Ollama({
      host: config?.host ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const response = await this.client.chat({
        model: this.getModel(options),
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP,
          stop: options?.stop,
          num_predict: options?.maxTokens,
        },
        ...(options?.responseFormat === 'json' ? { format: 'json' } : {}),
      });

      return {
        content: response.message.content,
        model: response.model,
        usage: {
          promptTokens: response.prompt_eval_count ?? 0,
          completionTokens: response.eval_count ?? 0,
          totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
        },
        finishReason: response.done ? 'stop' : undefined,
      };
    });
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const response = await this.client.chat({
      model: this.getModel(options),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
        stop: options?.stop,
        num_predict: options?.maxTokens,
      },
      stream: true,
    });

    for await (const chunk of response) {
      yield {
        content: chunk.message.content,
        done: chunk.done,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const list = await this.client.list();
      return list.models.map(m => ({
        id: m.name,
        name: m.name,
        provider: this.name,
      }));
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }
}
