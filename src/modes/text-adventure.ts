/**
 * 文字冒险 / 互动小说模式
 * 经典互动小说，AI 驱动叙事分支
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '../types/game.js';

const MODE_CONFIG: GameConfig = {
  mode: 'text-adventure',
  theme: 'fantasy',
  enableCombat: true,
  enableSave: true,
  maxTurns: 1000,
  difficulty: 'normal',
  memoryMaxContextChars: 2000,
  autoWorldTick: true,
  idleTimeout: 300000,
  enabledAgents: ['narrator', 'world-keeper', 'rule-arbiter', 'drama-curator'],
  maxHistoryTurns: 30,
  logging: {
    enabled: true,
    level: 'info',
  },
  autoSaveInterval: 300000,
};

export function createTextAdventure(
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

/**
 * 快速启动文字冒险
 */
export async function quickStartAdventure(
  providerFactory: ProviderFactory,
  dataPath: string,
): Promise<{ engine: GameEngine; intro: string }> {
  const engine = createTextAdventure(providerFactory, dataPath);

  // 生成开场白
  const intro = await engine.processTurn(
    '（游戏开始）请为我描述开场场景，设定一个引人入胜的冒险起点。',
  );

  return { engine, intro: intro.narrative };
}
