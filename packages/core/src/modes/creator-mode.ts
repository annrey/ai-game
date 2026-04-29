/**
 * 创世模式 (Creator Mode)
 * 面向用户的创造模式，允许玩家创建自己的世界和角色
 * 并在这个自定义世界中进行冒险
 */

import { GameEngine } from '../engine/game-engine.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { GameConfig } from '@openclaw/shared-types';

const MODE_CONFIG: GameConfig = {
  mode: 'creator-mode',
  theme: 'creator',
  enableCombat: true,
  enableSave: true,
  maxTurns: 5000,
  difficulty: 'normal',
  memoryMaxContextChars: 4000,
  autoWorldTick: true,
  idleTimeout: 300000,
  enabledAgents: ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'],
  maxHistoryTurns: 50,
  logging: {
    enabled: true,
    level: 'info',
  },
  autoSaveInterval: 300000,
};

export interface CreatorWorldSettings {
  worldName: string;
  genre: string;
  tone: string;
  conflict: string;
  worldRules: string;
  magicSystem: string;
  technologyLevel: string;
  factions: string;
  notableLocations: string;
  worldHistory: string;
}

export interface CreatorCharacterSettings {
  playerName: string;
  playerRole: string;
  playerBackground: string;
  appearance: string;
  personality: string;
  goals: string;
  skills: string;
  equipment: string;
  statsPreset: 'balanced' | 'warrior' | 'mage' | 'rogue' | 'custom';
  customStats?: {
    strength: number;
    agility: number;
    intelligence: number;
    charisma: number;
    endurance: number;
    luck: number;
  };
}

export interface CreatorStartSettings {
  location: string;
  weather: string;
  locationDescription: string;
  startingNPCs: string;
  openingScene: string;
  timeOfDay: string;
}

export interface CreatorPreset {
  name: string;
  description: string;
  world: Partial<CreatorWorldSettings>;
  character: Partial<CreatorCharacterSettings>;
  start: Partial<CreatorStartSettings>;
}

export function createCreatorMode(
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

  return engine;
}

/**
 * 使用创世设置初始化世界
 */
export function bootstrapCreatorWorld(
  engine: GameEngine,
  world: CreatorWorldSettings,
  character: CreatorCharacterSettings,
  start: CreatorStartSettings,
): void {
  const location = start.location?.trim() || `${world.worldName?.trim() || '新世界'}·起点`;
  const locationDescription = start.locationDescription?.trim()
    || start.openingScene?.trim()
    || '你站在一片未知的土地上，周围充满了可能性。';

  const stats = getStatsForPreset(character.statsPreset, character.customStats);

  engine.bootstrapWorld({
    worldName: world.worldName,
    genre: world.genre,
    tone: world.tone,
    conflict: world.conflict,
    location,
    locationDescription,
    weather: start.weather || '晴朗',
    playerName: character.playerName,
    playerRole: character.playerRole,
    playerBackground: character.playerBackground,
  });

  const ruleBook = buildCreatorRuleBook(world, character, stats);
  engine.setRuleBook(ruleBook);
}

function getStatsForPreset(
  preset: string,
  custom?: CreatorCharacterSettings['customStats'],
): Record<string, number> {
  const presets: Record<string, Record<string, number>> = {
    balanced: { strength: 12, agility: 12, intelligence: 12, charisma: 12, endurance: 12, luck: 12 },
    warrior: { strength: 16, agility: 10, intelligence: 8, charisma: 10, endurance: 14, luck: 10 },
    mage: { strength: 8, agility: 10, intelligence: 16, charisma: 12, endurance: 8, luck: 12 },
    rogue: { strength: 10, agility: 16, intelligence: 12, charisma: 10, endurance: 10, luck: 14 },
    custom: custom || { strength: 12, agility: 12, intelligence: 12, charisma: 12, endurance: 12, luck: 12 },
  };
  return presets[preset] || presets.balanced;
}

function buildCreatorRuleBook(
  world: CreatorWorldSettings,
  character: CreatorCharacterSettings,
  stats: Record<string, number>,
): string {
  const sections: string[] = [];

  sections.push(`[创世模式：${world.worldName}]`);
  sections.push('');

  sections.push('【世界设定】');
  sections.push(`题材：${world.genre || '未指定'}`);
  sections.push(`氛围：${world.tone || '未指定'}`);
  sections.push(`核心冲突：${world.conflict || '未指定'}`);
  if (world.magicSystem?.trim()) sections.push(`魔法体系：${world.magicSystem}`);
  if (world.technologyLevel?.trim()) sections.push(`科技水平：${world.technologyLevel}`);
  if (world.factions?.trim()) sections.push(`势力派系：${world.factions}`);
  if (world.notableLocations?.trim()) sections.push(`重要地点：${world.notableLocations}`);
  if (world.worldHistory?.trim()) sections.push(`世界历史：${world.worldHistory}`);

  sections.push('');
  sections.push('【角色设定】');
  sections.push(`姓名：${character.playerName || '冒险者'}`);
  sections.push(`职业：${character.playerRole || '旅者'}`);
  if (character.appearance?.trim()) sections.push(`外貌：${character.appearance}`);
  if (character.personality?.trim()) sections.push(`性格：${character.personality}`);
  if (character.goals?.trim()) sections.push(`目标：${character.goals}`);
  if (character.skills?.trim()) sections.push(`技能：${character.skills}`);
  if (character.equipment?.trim()) sections.push(`装备：${character.equipment}`);

  sections.push('');
  sections.push('【属性值】');
  Object.entries(stats).forEach(([key, value]) => {
    sections.push(`  ${key}: ${value}`);
  });

  if (world.worldRules?.trim()) {
    sections.push('');
    sections.push('【自定义规则】');
    sections.push(world.worldRules);
  }

  sections.push('');
  sections.push('【创世模式特殊规则】');
  sections.push('1. 这个世界完全由玩家创造，所有设定都应尊重创世时的设定。');
  sections.push('2. NPC 的行为和对话应符合世界的题材和氛围。');
  sections.push('3. 剧情发展应围绕核心冲突展开。');
  sections.push('4. 角色的背景故事应被纳入叙事考量。');
  sections.push('5. 世界应随着玩家的行动而演化，保持动态和沉浸感。');

  return sections.join('\n');
}

/**
 * 预设创世模板
 */
export const CreatorPresets: Record<string, CreatorPreset> = {
  'dark-fantasy': {
    name: '暗黑奇幻',
    description: '一个被永恒黑夜笼罩的世界，古老的邪恶正在苏醒',
    world: {
      genre: '暗黑奇幻',
      tone: '阴郁、绝望中带着希望',
      conflict: '远古的暗影之王正在苏醒，世界需要新的英雄',
      magicSystem: '血魔法与灵魂契约，使用魔法需要付出代价',
      technologyLevel: '中世纪，但有古代遗迹中的神秘科技',
      factions: '光明教会、暗影议会、自由佣兵团、古代守护者',
      notableLocations: '永夜城、遗忘森林、龙骨荒原、灵魂之井',
      worldHistory: '千年前，暗影之王被封印。如今封印松动，黑暗再次蔓延。',
    },
    character: {
      playerRole: '被诅咒的战士',
      playerBackground: '你曾是一名荣耀的骑士，但在一次任务中被暗影诅咒。现在你必须在被黑暗吞噬之前找到解除诅咒的方法。',
      statsPreset: 'warrior',
    },
    start: {
      location: '永夜城·破败酒馆',
      weather: '永夜，血月高悬',
      locationDescription: '酒馆的烛光摇曳，窗外传来不祥的嚎叫。一个神秘的陌生人正注视着你...',
      timeOfDay: '深夜',
    },
  },
  'steampunk-city': {
    name: '蒸汽朋克都市',
    description: '齿轮转动的巨型城市，蒸汽与魔法交织的工业革命',
    world: {
      genre: '蒸汽朋克',
      tone: '繁华与腐朽并存，充满机遇与危险',
      conflict: '大企业与地下反抗组织的战争，以及神秘的"齿轮瘟疫"',
      magicSystem: '以太科技——将魔法能量通过机械装置释放',
      technologyLevel: '蒸汽动力与魔法机械并存，有飞艇和差分机',
      factions: '钢铁财团、齿轮兄弟会、以太学者协会、黑市商人联盟',
      notableLocations: '中央齿轮塔、蒸汽港、地下城、以太实验室',
      worldHistory: '工业革命由魔法驱动，城市在百年间膨胀成巨兽。但齿轮瘟疫开始让人们机械化...',
    },
    character: {
      playerRole: '私家侦探',
      playerBackground: '你是一位专门调查超自然案件的侦探，拥有一只机械义眼和一把改装过的以太手枪。',
      statsPreset: 'rogue',
    },
    start: {
      location: '蒸汽港·"生锈齿轮"酒馆',
      weather: '雾霾，偶尔有酸雨',
      locationDescription: '酒馆的蒸汽管道发出嘶嘶声，一个蒙面人塞给你一张写着"齿轮瘟疫真相"的纸条...',
      timeOfDay: '黄昏',
    },
  },
  'xianxia': {
    name: '修仙世界',
    description: '灵气充沛的仙侠世界，追求长生与大道',
    world: {
      genre: '仙侠修真',
      tone: '逍遥自在，弱肉强食',
      conflict: '千年一次的"天劫"即将降临，各大宗门争夺有限的渡劫资源',
      magicSystem: '五行灵气修炼，从炼气到渡劫共九大境界',
      technologyLevel: '古代修仙文明，有飞剑、法宝、洞天福地',
      factions: '太虚宗、魔道联盟、散修联盟、妖族圣殿',
      notableLocations: '昆仑仙山、幽冥深渊、蓬莱仙境、万妖森林',
      worldHistory: '上古时期仙魔大战，天道受损。如今灵气复苏，但天劫也变得更加凶险。',
    },
    character: {
      playerRole: '散修',
      playerBackground: '你没有宗门背景，靠一本偶然得到的残缺功法开始修炼。你的资质平庸，但悟性惊人。',
      statsPreset: 'balanced',
    },
    start: {
      location: '青牛镇·破旧道观',
      weather: '灵气氤氲，彩云缭绕',
      locationDescription: '你在破旧的道观中打坐，突然感受到一股强大的灵气波动从后山传来...',
      timeOfDay: '清晨',
    },
  },
  'post-apocalypse': {
    name: '末日废土',
    description: '文明崩塌后的世界，幸存者们在废墟中挣扎求生',
    world: {
      genre: '末日废土',
      tone: '残酷、荒凉、人性考验',
      conflict: '资源枯竭，变异生物横行，各幸存者营地之间的战争',
      magicSystem: '无魔法，但有辐射导致的变异能力和古代科技遗物',
      technologyLevel: '现代武器与古代高科技遗物并存',
      factions: '钢铁兄弟会、游民部落、净化者、拾荒者联盟',
      notableLocations: '死亡都市、辐射沼泽、避难所72号、天空农场',
      worldHistory: '大灾变发生在50年前，原因不明。文明倒退，但废墟中仍有宝藏。',
    },
    character: {
      playerRole: '拾荒者',
      playerBackground: '你在废墟中长大，靠寻找古代遗物为生。你有一张旧世界地图，标记着一个传说中的"天堂"地点。',
      statsPreset: 'rogue',
    },
    start: {
      location: '废墟·废弃加油站',
      weather: '沙尘暴前的闷热',
      locationDescription: '加油站的废墟中，你的辐射探测器突然发出警报。远处，一群变异生物正在接近...',
      timeOfDay: '正午',
    },
  },
  'cosmic-horror': {
    name: '宇宙恐怖',
    description: '在浩瀚宇宙中，人类只是渺小而无关紧要的尘埃',
    world: {
      genre: '宇宙恐怖/克苏鲁',
      tone: '压抑、不可名状的恐惧、疯狂边缘',
      conflict: '古老的宇宙存在正在苏醒，人类的理智和存在都受到威胁',
      magicSystem: '禁忌知识——了解得越多，理智丧失得越快',
      technologyLevel: '近未来，有星际航行和AI，但面对宇宙存在无能为力',
      factions: '密斯卡托尼克大学、星之子教会、政府特殊部门、独立调查员',
      notableLocations: '阿卡姆镇、拉莱耶遗迹、南极古城、梦境维度',
      worldHistory: '人类只是宇宙中的短暂火花。古老的存在沉睡在深海、地心和异次元中。',
    },
    character: {
      playerRole: '调查员',
      playerBackground: '你是一位专门调查超自然事件的学者。最近，你开始做一些无法解释的梦境...',
      statsPreset: 'mage',
    },
    start: {
      location: '阿卡姆镇·密斯卡托尼克大学图书馆',
      weather: '暴风雨，雷声轰鸣',
      locationDescription: '在整理一批新到的古籍时，你发现了一本用未知语言写成的书。当你触碰它时，书页自动翻到了某一页...',
      timeOfDay: '深夜',
    },
  },
};

/**
 * 快速启动创世模式（使用预设）
 */
export async function quickStartCreatorMode(
  engine: GameEngine,
  presetKey: string,
): Promise<{ success: boolean; message: string }> {
  const preset = CreatorPresets[presetKey];
  if (!preset) {
    return { success: false, message: `未找到预设：${presetKey}` };
  }

  const world: CreatorWorldSettings = {
    worldName: '',
    genre: '',
    tone: '',
    conflict: '',
    worldRules: '',
    magicSystem: '',
    technologyLevel: '',
    factions: '',
    notableLocations: '',
    worldHistory: '',
    ...preset.world,
  };

  const character: CreatorCharacterSettings = {
    playerName: '冒险者',
    playerRole: '',
    playerBackground: '',
    appearance: '',
    personality: '',
    goals: '',
    skills: '',
    equipment: '',
    statsPreset: 'balanced',
    ...preset.character,
  };

  const start: CreatorStartSettings = {
    location: '',
    weather: '',
    locationDescription: '',
    startingNPCs: '',
    openingScene: '',
    timeOfDay: '',
    ...preset.start,
  };

  bootstrapCreatorWorld(engine, world, character, start);

  return {
    success: true,
    message: `已加载创世预设「${preset.name}」：${preset.description}`,
  };
}
