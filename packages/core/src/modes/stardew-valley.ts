/**
 * 星露谷沙盒模拟模式
 * 种田、社交、挖矿、钓鱼的悠闲生活
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '@openclaw/shared-types';

const MODE_CONFIG: GameConfig = {
  mode: 'stardew-valley',
  theme: 'farming-sandbox',
  enableCombat: true, // 矿井中可能有战斗
  enableSave: true,
  maxTurns: 5000,
  difficulty: 'easy',
  memoryMaxContextChars: 3000,
  autoWorldTick: true,
  idleTimeout: 60000, // 农场生活时间流逝更快
  enabledAgents: ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'],
  maxHistoryTurns: 50,
  logging: {
    enabled: true,
    level: 'info',
  },
  autoSaveInterval: 300000,
};

export function createStardewValley(
  providerFactory: ProviderFactory,
  dataPath: string,
  configOverride?: Partial<GameConfig>,
): GameEngine {
  const config = { ...MODE_CONFIG, ...configOverride };
  const engine = new GameEngine({
    config,
    providerFactory,
    dataPath,
  });

  // 初始设置特定的农场规则
  const farmingRules = `
[特殊世界规则：星露谷模拟]
1. 核心玩法：玩家拥有一片荒废的农场，可以通过清理杂草、种下种子、浇水来获得农作物。
2. 时间系统：分为春、夏、秋、冬四季，每个季节有独特的作物和节日。时间流逝非常重要，每天晚上需要睡觉休息恢复体力。
3. 经济系统：玩家可以将收获的农作物、钓到的鱼、挖到的矿石卖给商店（如皮埃尔的杂货店）换取金币。
4. 社交系统：小镇（鹈鹕镇）上有很多NPC，玩家可以与他们交谈、送礼，提升好感度。
5. 挖矿系统：矿井中分为多层，包含石头、矿石和怪物。
6. 玩家初始状态：刚继承爷爷的农场，身上只有几包防风草种子和基础农具（锄头、水壶、斧头、十字镐、镰刀）。
`;
  engine.setRuleBook(farmingRules);

  return engine;
}

/**
 * 预设星露谷世界模板
 */
export const StardewTemplates = {
  farm: {
    name: '鹈鹕镇',
    location: '破旧的农场',
    description: '一片杂草丛生、布满石头和树枝的荒废农场。旁边是一座简陋的小木屋，这是你继承的遗产。微风吹过，带来泥土的芬芳。',
    npcs: [
      { id: 'robin', name: '罗宾', disposition: 'friendly' as const, currentActivity: '在帮你修理木屋的屋顶' },
      { id: 'lewis', name: '刘易斯镇长', disposition: 'friendly' as const, currentActivity: '在门口欢迎你的到来' },
    ],
  },
  town: {
    name: '鹈鹕镇',
    location: '小镇广场',
    description: '宁静祥和的鹈鹕镇中心，中心有一个布告栏，旁边是皮埃尔的杂货店和星之落滴酒馆。',
    npcs: [
      { id: 'pierre', name: '皮埃尔', disposition: 'neutral' as const, currentActivity: '在杂货店柜台后整理种子' },
      { id: 'abigail', name: '阿比盖尔', disposition: 'neutral' as const, currentActivity: '在广场边缘闲逛' },
      { id: 'gus', name: '格斯', disposition: 'friendly' as const, currentActivity: '在酒馆里擦拭玻璃杯' },
    ],
  },
  beach: {
    name: '鹈鹕镇',
    location: '阳光沙滩',
    description: '海浪拍打着金色的沙滩，空气中弥漫着咸咸的海水味。码头尽头坐着一个孤独的身影。',
    npcs: [
      { id: 'willy', name: '威利', disposition: 'friendly' as const, currentActivity: '在码头钓鱼' },
      { id: 'elliott', name: '艾利欧特', disposition: 'neutral' as const, currentActivity: '在海边的小屋前沉思' },
    ],
  }
};
