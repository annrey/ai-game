/**
 * 通用本地 AI Provider
 * 兼容 llama.cpp server / vLLM / LM Studio / 任何 OpenAI 兼容本地服务
 */

import { BaseProvider } from './base-provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo, ProviderConfig } from '../types/provider.js';

export class LocalProvider extends BaseProvider {
  readonly name: string;
  readonly type: ProviderConfig['type'] = 'local';

  private endpoint: string;

  constructor(config?: {
    endpoint?: string;
    defaultModel?: string;
    name?: string;
  }) {
    super(config?.defaultModel ?? 'local-model');
    this.endpoint = (config?.endpoint ?? 'http://localhost:1234/v1').replace(/\/$/, '');
    this.name = config?.name ?? 'LocalAI';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        model: this.getModel(options),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        stream: false,
      };
      if (options?.maxTokens) body.max_tokens = options.maxTokens;
      if (options?.topP) body.top_p = options.topP;
      if (options?.stop) body.stop = options.stop;
      if (options?.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Local AI error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content ?? '',
        model: data.model ?? this.defaultModel,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
        finishReason: choice?.finish_reason,
      };
    });
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.getModel(options),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };
    if (options?.maxTokens) body.max_tokens = options.maxTokens;
    if (options?.topP) body.top_p = options.topP;
    if (options?.stop) body.stop = options.stop;

    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { content: delta, done: false };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
    yield { content: '', done: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.endpoint}/models`);
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
      const res = await fetch(`${this.endpoint}/models`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
