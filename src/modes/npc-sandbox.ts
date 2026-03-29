/**
 * AI NPC 沙盒模式
 * 开放世界探索，与智能 NPC 自由互动
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '../types/game.js';

const MODE_CONFIG: GameConfig = {
  mode: 'npc-sandbox',
  language: 'zh-CN',
  // 全代理启用 — 沙盒模式需要所有能力
  enabledAgents: ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'],
  streaming: true,
  logging: true,
  maxHistoryTurns: 40,
};

export function createNPCSandbox(
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
 * 预设沙盒世界模板
 */
export const SandboxTemplates = {
  medieval: {
    name: '中世纪奇幻',
    location: '王都・弗洛拉城',
    description: '繁华的王国都城，石板路两旁商铺林立，远处城堡的尖塔在阳光下闪耀。',
    npcs: [
      { id: 'blacksmith', name: '铁匠老约翰', disposition: 'friendly' as const, currentActivity: '在铺子里打铁' },
      { id: 'merchant', name: '行商丽莎', disposition: 'neutral' as const, currentActivity: '在广场摆摊' },
      { id: 'guard', name: '守卫队长马克', disposition: 'neutral' as const, currentActivity: '在城门巡逻' },
    ],
  },
  cyberpunk: {
    name: '赛博朋克',
    location: '新东京・下层区',
    description: '霓虹灯永不熄灭的街区，全息广告在雨中闪烁，空气中弥漫着电子烟和拉面的气味。',
    npcs: [
      { id: 'fixer', name: '掮客小K', disposition: 'neutral' as const, currentActivity: '在酒吧暗角等待客户' },
      { id: 'hacker', name: '骇客Zero', disposition: 'friendly' as const, currentActivity: '在网吧修改代码' },
      { id: 'corp', name: '企业安保・田中', disposition: 'hostile' as const, currentActivity: '在街角监视' },
    ],
  },
  wuxia: {
    name: '武侠江湖',
    location: '长安・醉仙楼',
    description: '江湖人聚集的知名酒楼，二楼包厢传来划拳声，说书先生正讲着昨日武林大会的盛况。',
    npcs: [
      { id: 'innkeeper', name: '掌柜刘婶', disposition: 'friendly' as const, currentActivity: '在柜台算账' },
      { id: 'swordsman', name: '剑客白衣', disposition: 'neutral' as const, currentActivity: '独坐角落饮酒' },
      { id: 'beggar', name: '乞丐老赵', disposition: 'friendly' as const, currentActivity: '在门口晒太阳' },
    ],
  },
};
