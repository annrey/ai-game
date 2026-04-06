/**
 * AI 对战 / 策略游戏模式
 * AI 作为对手或队友参与策略对抗
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '../types/game.js';
import type { AgentRequest, AgentResponse } from '../types/agent.js';
import { BaseAgent } from '../agents/base-agent.js';
import type { AIProvider } from '../types/provider.js';

const MODE_CONFIG: GameConfig = {
  mode: 'ai-battle',
  theme: 'strategy',
  enableCombat: true,
  enableSave: true,
  maxTurns: 1000,
  difficulty: 'normal',
  memoryMaxContextChars: 2000,
  autoWorldTick: false,
  idleTimeout: 300000,
  enabledAgents: ['narrator', 'rule-arbiter'],
  maxHistoryTurns: 50,
  logging: {
    enabled: true,
    level: 'info',
  },
  autoSaveInterval: 300000,
};

/**
 * AI 对手代理 — 策略游戏中的AI对手
 */
class AIOpponent extends BaseAgent {
  constructor(provider: AIProvider, model?: string) {
    super(
      {
        role: 'npc-director', // 复用角色位
        name: 'AI对手',
        description: '策略游戏中的AI对手，根据局势做出最优决策',
        systemPrompt: `你是一个策略游戏中的AI对手。

你的职责：
1. 分析当前局势，做出合理的策略决策
2. 选择最优行动，但不要过于完美（保持游戏趣味性）
3. 偶尔做出大胆的冒险决策，增加不可预测性
4. 以角色身份解释自己的行动

回复格式：
【决策】：你选择的行动
【理由】：为什么做这个决策（角色视角）
【嘲讽/鼓励】：给对手的一句话`,
        temperature: 0.6,
      },
      provider,
      model,
    );
  }
}

export function createAIBattle(
  providerFactory: ProviderFactory,
  dataPath: string,
  configOverride?: Partial<GameConfig>,
): GameEngine {
  const config = { ...MODE_CONFIG, ...configOverride };
  return new GameEngine({
    config,
    providerFactory,
    dataPath,
  });
}
