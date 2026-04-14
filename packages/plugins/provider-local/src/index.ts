import type { ProviderExtension } from '@openclaw/plugin-sdk';
import type { ProviderConfig, ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo } from '@openclaw/shared-types';
import { BaseProvider } from '@openclaw/core';

// Note: we might need to copy or import retry logic.
// For simplicity in this PoC, we will implement a simplified version.

class LocalProvider extends BaseProvider {
  readonly name: string;
  readonly type: string;

  private endpoint: string;
  private apiKey?: string;

  constructor(config: ProviderConfig) {
    super(config.defaultModel || 'local-model');
    this.endpoint = (config.endpoint || 'http://localhost:1234/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.name = config.name || 'LocalAI-Plugin';
    this.type = config.type;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
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
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk> {
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

const extension: ProviderExtension = {
  type: 'provider',
  manifest: {
    id: 'custom-local',
    name: 'Custom Local Provider',
    version: '1.0.0',
    description: 'A custom local AI provider extension example.',
    author: 'OpenClaw',
  },
  createProvider: (config: ProviderConfig) => {
    return new LocalProvider(config);
  },
  activate: () => {
    console.log('Custom Local Provider Extension Activated!');
  },
  deactivate: () => {
    console.log('Custom Local Provider Extension Deactivated!');
  }
};

export default extension;
