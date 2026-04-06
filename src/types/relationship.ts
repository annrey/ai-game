/**
 * NPC 关系网络类型定义
 * 用于管理 NPC 之间的关系和社交互动
 */

/** 关系类型 */
export type RelationshipType = 'friend' | 'enemy' | 'neutral' | 'family' | 'colleague' | 'rival';

/** 关系状态 */
export type RelationshipStatus = 'close' | 'friendly' | 'neutral' | 'strained' | 'hostile';

/** NPC 关系 */
export interface NPCRelationship {
  /** 关系ID */
  id: string;
  /** NPC A ID */
  npcAId: string;
  /** NPC A 名称 */
  npcAName: string;
  /** NPC B ID */
  npcBId: string;
  /** NPC B 名称 */
  npcBName: string;
  /** 关系类型 */
  type: RelationshipType;
  /** 关系状态 */
  status: RelationshipStatus;
  /** 好感度（-100 到 100，0 为中立） */
  affinity: number;
  /** 关系描述 */
  description: string;
  /** 共同历史 */
  sharedHistory: string[];
  /** 最后互动时间 */
  lastInteraction: number;
}

/** 关系变化事件 */
export interface RelationshipChangeEvent {
  /** 关系ID */
  relationshipId: string;
  /** 涉及的NPC */
  npcIds: [string, string];
  /** 变化前的好感度 */
  oldAffinity: number;
  /** 变化后的好感度 */
  newAffinity: number;
  /** 变化原因 */
  reason: string;
  /** 变化时间 */
  timestamp: number;
}

/** 社交互动 */
export interface SocialInteraction {
  /** 互动ID */
  id: string;
  /** 发起者ID */
  initiatorId: string;
  /** 接收者ID */
  receiverId: string;
  /** 互动类型 */
  type: 'greet' | 'talk' | 'argue' | 'help' | 'insult' | 'gift' | 'trade';
  /** 互动内容 */
  content: string;
  /** 对关系的影响 */
  affinityChange: number;
  /** 互动时间 */
  timestamp: number;
}

/** 关系网络配置 */
export interface RelationshipNetworkConfig {
  /** 最大关系数 */
  maxRelationships: number;
  /** 好感度变化阈值（超过此值改变关系状态） */
  affinityThreshold: number;
  /** 关系衰减率（每回合） */
  decayRate: number;
  /** 是否启用关系历史 */
  enableHistory: boolean;
}

/** 关系网络统计 */
export interface RelationshipNetworkStats {
  /** 总关系数 */
  totalRelationships: number;
  /** 友好关系数 */
  friendlyCount: number;
  /** 敌对关系数 */
  hostileCount: number;
  /** 中立关系数 */
  neutralCount: number;
  /** 最活跃的NPC */
  mostActiveNPC: string | null;
}

/** 预定义的酒馆 NPC 关系 */
export const TAVERN_NPC_RELATIONSHIPS: NPCRelationship[] = [
  {
    id: 'rel-bard-barkeep',
    npcAId: 'bard-elara',
    npcAName: '艾拉（吟游诗人）',
    npcBId: 'barkeep-thomas',
    npcBName: '托马斯（酒馆老板）',
    type: 'colleague',
    status: 'friendly',
    affinity: 30,
    description: '艾拉在酒馆表演，托马斯提供场地和食宿，两人关系融洽',
    sharedHistory: ['艾拉在酒馆表演了三年', '托马斯曾在艾拉生病时照顾她'],
    lastInteraction: Date.now(),
  },
  {
    id: 'rel-bard-merchant',
    npcAId: 'bard-elara',
    npcAName: '艾拉（吟游诗人）',
    npcBId: 'merchant-lucas',
    npcBName: '卢卡斯（商人）',
    type: 'friend',
    status: 'friendly',
    affinity: 20,
    description: '卢卡斯经常给艾拉带来远方的故事和材料，艾拉为他编写商队歌谣',
    sharedHistory: ['卢卡斯从东方带回了一把鲁特琴送给艾拉'],
    lastInteraction: Date.now(),
  },
  {
    id: 'rel-barkeep-guard',
    npcAId: 'barkeep-thomas',
    npcAName: '托马斯（酒馆老板）',
    npcBId: 'guard-marcus',
    npcBName: '马库斯（守卫）',
    type: 'colleague',
    status: 'neutral',
    affinity: 10,
    description: '马库斯经常在酒馆吃午餐，托马斯给他优惠，两人保持着礼貌的关系',
    sharedHistory: ['马库斯曾帮助托马斯处理过闹事的醉汉'],
    lastInteraction: Date.now(),
  },
  {
    id: 'rel-merchant-guard',
    npcAId: 'merchant-lucas',
    npcAName: '卢卡斯（商人）',
    npcBId: 'guard-marcus',
    npcBName: '马库斯（守卫）',
    type: 'colleague',
    status: 'strained',
    affinity: -10,
    description: '马库斯怀疑卢卡斯的一些商品来路不明，但一直没有证据',
    sharedHistory: ['马库斯曾三次检查卢卡斯的货物'],
    lastInteraction: Date.now(),
  },
];

/** 关系状态阈值 */
export const RELATIONSHIP_STATUS_THRESHOLDS = {
  close: 60,
  friendly: 20,
  neutral: -20,
  strained: -60,
  hostile: -100,
};

/** 根据好感度获取关系状态 */
export function getRelationshipStatus(affinity: number): RelationshipStatus {
  if (affinity >= RELATIONSHIP_STATUS_THRESHOLDS.close) return 'close';
  if (affinity >= RELATIONSHIP_STATUS_THRESHOLDS.friendly) return 'friendly';
  if (affinity >= RELATIONSHIP_STATUS_THRESHOLDS.neutral) return 'neutral';
  if (affinity >= RELATIONSHIP_STATUS_THRESHOLDS.strained) return 'strained';
  return 'hostile';
}

/** 获取关系状态的显示文本 */
export function getRelationshipStatusText(status: RelationshipStatus): string {
  const texts: Record<RelationshipStatus, string> = {
    close: '亲密',
    friendly: '友好',
    neutral: '中立',
    strained: '紧张',
    hostile: '敌对',
  };
  return texts[status];
}

/** 获取关系类型的显示文本 */
export function getRelationshipTypeText(type: RelationshipType): string {
  const texts: Record<RelationshipType, string> = {
    friend: '朋友',
    enemy: '敌人',
    neutral: '熟人',
    family: '家人',
    colleague: '同事',
    rival: '竞争对手',
  };
  return texts[type];
}
