/**
 * AI Provider 基类
 * 提供通用的错误处理、重试和日志能力
 */

import type { AIProvider, ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelInfo, ProviderConfig } from '../types/provider.js';

export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly type: ProviderConfig['type'];

  protected defaultModel: string;
  protected maxRetries = 3;
  protected retryDelay = 1000;

  constructor(defaultModel: string) {
    this.defaultModel = defaultModel;
  }

  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  abstract stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract isAvailable(): Promise<boolean>;

  protected getModel(options?: ChatOptions): string {
    return options?.model ?? this.defaultModel;
  }

  protected async withRetry<T>(fn: () => Promise<T>, retries = this.maxRetries): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i < retries) {
          const delay = this.retryDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'info':
        console.log(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
    }
  }
}
