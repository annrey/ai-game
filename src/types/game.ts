/**
 * 游戏全局类型定义
 */

import type { AgentRole } from './agent.js';

/** 游戏模式 */
export type GameMode = 'text-adventure' | 'ai-battle' | 'npc-sandbox' | 'chat-roleplay';

/** 游戏模式中文名 */
export const GameModeNames: Record<GameMode, string> = {
  'text-adventure': '文字冒险 / 互动小说',
  'ai-battle': 'AI 对战 / 策略游戏',
  'npc-sandbox': 'AI NPC 沙盒',
  'chat-roleplay': 'AI 聊天角色扮演',
};

/** 游戏配置 */
export interface GameConfig {
  mode: GameMode;
  language: string;
  /** 启用的代理列表 */
  enabledAgents: AgentRole[];
  /** 是否启用流式输出 */
  streaming: boolean;
  /** 是否保存日志 */
  logging: boolean;
  /** 最大历史轮数 */
  maxHistoryTurns: number;
}

/** 游戏事件 */
export interface GameEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  source: AgentRole | 'engine' | 'player';
}

/** 存档数据 */
export interface SaveData {
  id: string;
  name: string;
  mode: GameMode;
  createdAt: string;
  updatedAt: string;
  sceneState: unknown;
  history: unknown[];
  metadata: Record<string, unknown>;
}

export { type SceneState, type GameTime, type EnvironmentState, type NPCState, type Action, type Resolution, type PlotPoint } from './scene.js';
export { type AgentRole, type AgentConfig, type AgentRequest, type AgentResponse, type GameAgent } from './agent.js';
export { type AIProvider, type ChatMessage, type ChatOptions, type ChatResponse, type StreamChunk, type ModelInfo, type ProviderConfig } from './provider.js';
