import { EventBus } from './event-bus.js';
import { SceneManager } from './scene-manager.js';
import { ItemValidator } from '../validators/item-validator.js';
import type { Item, ItemType } from '@openclaw/shared-types';
import type { ItemGenerationContext } from '@openclaw/shared-types';

export interface ItemManagerOptions {
  eventBus: EventBus;
  sceneManager: SceneManager;
}

export class ItemManager {
  private eventBus: EventBus;
  private sceneManager: SceneManager;
  private itemValidator: ItemValidator;

  constructor(options: ItemManagerOptions) {
    this.eventBus = options.eventBus;
    this.sceneManager = options.sceneManager;
    this.itemValidator = new ItemValidator();
  }

  /** 获取物品验证器 */
  getItemValidator(): ItemValidator {
    return this.itemValidator;
  }

  /** 创建物品 */
  createItem(item: Item, addToInventory: boolean = true): {
    success: boolean;
    message: string;
    item?: Item;
  } {
    const validation = this.itemValidator.validateItem(item);
    if (!validation.valid) {
      return {
        success: false,
        message: `物品验证失败：${validation.errors.join(', ')}`,
      };
    }

    if (validation.warnings.length > 0) {
      console.warn('[ItemValidator] 警告:', validation.warnings.join(', '));
    }

    if (addToInventory) {
      this.sceneManager.updateInventoryItem({
        name: item.name,
        action: 'add',
        quantity: 1,
        description: item.description,
      });
      // 注意：AchievementManager 会监听 turn_ended 来检查物品成就，不需要在这里手动调用 updateItemProgress
      // 如果想要立刻通知成就系统，也可以 emit 一个 ITEM_ADDED_TO_INVENTORY 事件
    }

    this.eventBus.emit('item:created', { item, reason: 'system' }, 'engine');

    return {
      success: true,
      message: `成功创建物品：${item.name}`,
      item,
    };
  }

  /** 从任务奖励生成物品 */
  async generateItemFromReward(context: {
    questId?: string;
    playerLevel?: number;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemType?: ItemType;
  }): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'reward',
        relatedQuest: context.questId,
      } as ItemGenerationContext);

      const result = this.createItem(item, true);
      
      if (result.success) {
        this.eventBus.emit('item:reward', { item, questId: context.questId }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成任务奖励物品失败：${errorMessage}`,
      };
    }
  }

  /** 从探索发现生成物品 */
  async generateItemFromDiscovery(context: {
    location?: string;
    playerLevel?: number;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemType?: ItemType;
  }): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'discovery',
      } as ItemGenerationContext);

      const result = this.createItem(item, true);

      if (result.success) {
        this.eventBus.emit('item:discovered', { item, location: context.location }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成探索发现物品失败：${errorMessage}`,
      };
    }
  }

  /** 从 NPC 赠与生成物品 */
  async generateItemFromGift(
    npcId: string,
    npcName: string,
    context: {
      playerLevel?: number;
      rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
      itemType?: ItemType;
    }
  ): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'gift',
      } as ItemGenerationContext);

      const result = this.createItem(item, true);

      if (result.success) {
        this.eventBus.emit('item:gift', { item, npcId, npcName }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成 NPC 赠与物品失败：${errorMessage}`,
      };
    }
  }
}
