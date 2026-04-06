/**
 * 验证器类型定义
 */

import type { Quest } from '../types/scene.js';
import type { Item } from '../types/economy.js';

/** 验证结果 */
export interface ValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 验证错误信息 */
  errors: string[];
  /** 验证警告信息 */
  warnings: string[];
}

/** 任务验证规则 */
export interface QuestValidationRules {
  /** 最小标题长度 */
  minTitleLength: number;
  /** 最大标题长度 */
  maxTitleLength: number;
  /** 最小描述长度 */
  minDescriptionLength: number;
  /** 最大描述长度 */
  maxDescriptionLength: number;
  /** 最小目标数量 */
  minObjectives: number;
  /** 最大目标数量 */
  maxObjectives: number;
  /** 是否必须有目标 */
  requireObjectives: boolean;
  /** 最大奖励金币 */
  maxGoldReward: number;
  /** 最大经验奖励 */
  maxExpReward: number;
}

/** 物品验证规则 */
export interface ItemValidationRules {
  /** 最小名称长度 */
  minNameLength: number;
  /** 最大名称长度 */
  maxNameLength: number;
  /** 最小描述长度 */
  minDescriptionLength: number;
  /** 最大描述长度 */
  maxDescriptionLength: number;
  /** 最小价格 */
  minPrice: number;
  /** 最大价格 */
  maxPrice: number;
  /** 最大堆叠数量 */
  maxStack: number;
  /** 允许的物品类型 */
  allowedTypes: string[];
  /** 最大效果数量 */
  maxEffects: number;
}

/** 任务生成器接口 */
export interface QuestGenerator {
  /** 生成任务 */
  generateQuest(context: QuestGenerationContext): Promise<Quest>;
  /** 验证任务 */
  validateQuest(quest: Quest): ValidationResult;
}

/** 任务生成上下文 */
export interface QuestGenerationContext {
  /** 玩家等级 */
  playerLevel?: number;
  /** 当前地点 */
  currentLocation?: string;
  /** 相关 NPC */
  relatedNPC?: string;
  /** 剧情类型 */
  plotType?: 'story' | 'side' | 'daily' | 'random';
  /** 难度等级 */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** 事件类型 */
  eventType?: string;
  /** NPC 性格 */
  npcPersonality?: string;
  /** NPC 目标 */
  npcGoals?: string[];
  /** 请求类型 */
  requestType?: string;
  /** 目标 */
  target?: string;
  /** 关系变化 */
  relationshipChange?: number;
  /** 原因 */
  reason?: string;
  /** 剧情名称 */
  plotName?: string;
  /** 剧情描述 */
  plotDescription?: string;
  /** 剧情状态 */
  plotStatus?: string;
  /** 是否为高潮 */
  isClimax?: boolean;
  /** 转折描述 */
  twist?: string;
}

/** 物品生成器接口 */
export interface ItemGenerator {
  /** 生成物品 */
  generateItem(context: ItemGenerationContext): Promise<Item>;
  /** 验证物品 */
  validateItem(item: Item): ValidationResult;
}

/** 物品生成上下文 */
export interface ItemGenerationContext {
  /** 物品类型 */
  itemType?: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc';
  /** 稀有度 */
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** 玩家等级 */
  playerLevel?: number;
  /** 生成原因 */
  reason?: 'reward' | 'discovery' | 'gift' | 'purchase';
  /** 相关任务 */
  relatedQuest?: string;
}
