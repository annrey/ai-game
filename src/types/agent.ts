/**
 * 代理（Agent）接口类型定义
 */

import type { ChatMessage, ChatOptions, ChatResponse } from './provider.js';

/** 代理角色 */
export type AgentRole =
  | 'narrator'
  | 'world-keeper'
  | 'npc-director'
  | 'rule-arbiter'
  | 'drama-curator';

/** 代理配置 */
export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  /** 使用的 provider 类型（覆盖默认） */
  providerType?: string;
  /** 使用的模型（覆盖默认） */
  model?: string;
  /** 默认温度 */
  temperature?: number;
}

/** 代理请求 */
export interface AgentRequest {
  /** 请求来源 */
  from: AgentRole | 'player';
  /** 请求内容 */
  content: string;
  /** 附带的上下文 */
  context?: Record<string, unknown>;
  /** 对话历史 */
  history?: ChatMessage[];
}

/** 代理响应 */
export interface AgentResponse {
  /** 响应来源 */
  from: AgentRole;
  /** 响应内容 */
  content: string;
  /** 思维链 */
  chainOfThought?: ChainOfThought;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** token 使用量 */
  usage?: ChatResponse['usage'];
  /** 错误信息（如果处理过程中发生错误） */
  error?: {
    /** 错误类型 */
    type: string;
    /** 错误消息 */
    message: string;
    /** 发生错误的代理角色 */
    agentRole?: string;
  };
}

/** 思维链步骤类型 */
export type CoTStepType = 'observation' | 'analysis' | 'reasoning' | 'decision' | 'action';

/** 思维链步骤 */
export interface CoTStep {
  /** 步骤类型 */
  step: CoTStepType;
  /** 步骤标题 */
  title: string;
  /** 步骤内容 */
  content: string;
  /** 思考耗时（毫秒） */
  duration?: number;
}

/** 思维链 */
export interface ChainOfThought {
  /** 思维链 ID */
  id: string;
  /** AI 代理角色 */
  agentRole: AgentRole;
  /** 时间戳 */
  timestamp: number;
  /** 思维步骤 */
  steps: CoTStep[];
  /** 思维链摘要 */
  summary: string;
}

/** 代理接口 */
export interface GameAgent {
  readonly role: AgentRole;
  readonly name: string;
  readonly config: AgentConfig;

  /** 处理请求 */
  process(request: AgentRequest): Promise<AgentResponse>;

  /** 流式处理 */
  processStream(request: AgentRequest): AsyncIterable<string>;

  /** 重置上下文 */
  reset(): void;
}
