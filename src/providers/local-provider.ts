/**
 * 通用本地 AI Provider
 * 兼容 llama.cpp server / vLLM / LM Studio / 任何 OpenAI 兼容本地服务
 */

import { BaseProvider } from './base-provider.js';
import { retryWithBackoff, retryWithBackoffStream, type RetryOptions } from '../utils/retry.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo, ProviderConfig } from '../types/provider.js';

export class LocalProvider extends BaseProvider {
  readonly name: string;
  readonly type: ProviderConfig['type'];

  private endpoint: string;
  private apiKey?: string;
  private retryOptions: RetryOptions;

  constructor(config?: {
    endpoint?: string;
    apiKey?: string;
    defaultModel?: string;
    name?: string;
    type?: ProviderConfig['type'];
    retryOptions?: RetryOptions;
  }) {
    super(config?.defaultModel || 'local-model');
    this.endpoint = (config?.endpoint || 'http://localhost:1234/v1').replace(/\/$/, '');
    this.apiKey = config?.apiKey;
    this.name = config?.name || 'LocalAI';
    this.type = config?.type || 'local';
    this.retryOptions = config?.retryOptions ?? {
      maxRetries: 3,
      baseDelay: 1000,
      onRetry: (attempt, maxRetries, delay, error) => {
        console.log(
          `[${this.name}] Retry ${attempt}/${maxRetries} after ${delay}ms due to: ${error.message}`
        );
      },
    };
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return retryWithBackoff(async () => {
      const model = options?.model || this.defaultModel;
      
      const body = {
        model,
        messages,
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Local AI error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as any;
      
      // 尝试匹配响应中的内容字段 (兼容 response 或 content 字段)
      const content = data.response || data.content || data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model || model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
        finishReason: data.choices?.[0]?.finish_reason,
      };
    }, this.retryOptions);
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const makeStream = async function* (this: LocalProvider): AsyncIterable<StreamChunk> {
      const model = options?.model || this.defaultModel;

      const body = {
        model,
        messages,
        stream: true,
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Local AI stream error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // 处理可能没有 data: 前缀的 JSON 块
          let dataStr = trimmed;
          if (trimmed.startsWith('data: ')) {
            dataStr = trimmed.slice(6);
          }
          
          if (dataStr === '[DONE]') {
            yield { content: '', done: true };
            return;
          }
          try {
            const parsed = JSON.parse(dataStr);
            // 尝试匹配可能的内容字段
            const delta = parsed.response || parsed.content || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text;
            if (delta) {
              yield { content: delta, done: false };
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
      yield { content: '', done: true };
    }.bind(this);

    yield* retryWithBackoffStream(makeStream, this.retryOptions);
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.endpoint}/models`, { headers });
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.data ?? []).map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: this.name,
      }));
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.endpoint}/models`, { method: 'GET', headers });
      return res.ok;
    } catch {
      return false;
    }
  }
}
