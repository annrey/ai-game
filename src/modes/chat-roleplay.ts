/**
 * AI 聊天角色扮演模式
 * 轻量级角色扮演对话，AI 扮演多种角色
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '../types/game.js';

const MODE_CONFIG: GameConfig = {
  mode: 'chat-roleplay',
  theme: 'roleplay',
  enableCombat: false,
  enableSave: true,
  maxTurns: 1000,
  difficulty: 'normal',
  memoryMaxContextChars: 2000,
  autoWorldTick: false,
  idleTimeout: 300000,
  enabledAgents: ['narrator', 'npc-director'],
  maxHistoryTurns: 60,
  logging: {
    enabled: false,
    level: 'info',
  },
  autoSaveInterval: 300000,
};

export function createChatRoleplay(
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
 * 预设角色模板
 */
export const RoleplayTemplates = {
  detective: {
    name: '侦探推理',
    description: '你是一名侦探，正在调查一起神秘案件。与各种证人和嫌疑人对话，找出真相。',
    characters: [
      { name: '管家阿福', role: '忠诚但知道秘密的老管家' },
      { name: '小姐爱丽丝', role: '看似无辜但行为可疑的千金' },
      { name: '园丁老张', role: '沉默寡言但观察力惊人的园丁' },
    ],
  },
  tavern: {
    name: '酒馆奇谈',
    description: '你走进一家异世界的酒馆，这里聚集了各种各样的旅人。每个人都有自己的故事。',
    characters: [
      { name: '吟游诗人・银弦', role: '四处旅行收集故事的精灵诗人' },
      { name: '赏金猎人・铁拳', role: '沉默寡言的矮人战士' },
      { name: '神秘商人・面纱', role: '贩卖奇特道具的蒙面商人' },
    ],
  },
  office: {
    name: '职场风云',
    description: '你是一家科技公司的新员工，需要处理各种职场关系和工作挑战。',
    characters: [
      { name: '张总', role: '严厉但公正的部门总监' },
      { name: '小林', role: '热心但八卦的同事' },
      { name: 'Kevin', role: '技术大牛但社交恐惧的程序员' },
    ],
  },
};
