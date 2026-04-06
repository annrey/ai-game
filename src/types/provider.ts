/**
 * AI Provider 接口类型定义
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  /** JSON mode */
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  provider: string;
}

export interface ProviderConfig {
  type: 'openai' | 'ollama' | 'local' | 'lmstudio' | 'jan';
  baseURL?: string;
  apiKey?: string;
  host?: string;
  endpoint?: string;
  defaultModel?: string;
}

/**
 * AI Provider 统一接口
 */
export interface AIProvider {
  readonly name: string;
  readonly type: ProviderConfig['type'];

  /** 单轮对话 */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /** 流式输出 */
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  /** 列出可用模型 */
  listModels(): Promise<ModelInfo[]>;

  /** 检测服务是否可用 */
  isAvailable(): Promise<boolean>;
}
