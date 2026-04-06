/**
 * 经济系统管理器
 * 管理货币、商品、交易和小费
 */

import type {
  Item,
  Transaction,
  Shop,
  EconomyConfig,
  EconomyStats,
  ItemType,
} from '../types/economy.js';
import { TAVERN_ITEMS, DEFAULT_ECONOMY_CONFIG } from '../types/economy.js';
import { ItemValidator } from '../validators/item-validator.js';
import type { ItemGenerationContext } from '../types/validator.js';

export class EconomyManager {
  private items = new Map<string, Item>();
  private transactions: Transaction[] = [];
  private config: EconomyConfig;
  private playerGold: number;
  private playerInventory: Item[] = [];
  private itemValidator: ItemValidator;

  constructor(config: Partial<EconomyConfig> = {}) {
    this.config = { ...DEFAULT_ECONOMY_CONFIG, ...config };
    this.playerGold = this.config.startingGold;
    this.itemValidator = new ItemValidator();
    this.loadItems(TAVERN_ITEMS);
  }

  /** 加载商品 */
  loadItems(items: Item[]): void {
    for (const item of items) {
      this.items.set(item.id, { ...item });
    }
  }

  /** 获取玩家金币 */
  getPlayerGold(): number {
    return this.playerGold;
  }

  /** 设置玩家金币 */
  setPlayerGold(amount: number): void {
    this.playerGold = Math.max(0, Math.min(this.config.maxGold, amount));
  }

  /** 增加金币 */
  addGold(amount: number, reason: string, source: string = 'system'): boolean {
    if (amount <= 0) return false;

    const newAmount = this.playerGold + amount;
    if (newAmount > this.config.maxGold) {
      return false;
    }

    this.playerGold = newAmount;

    if (this.config.enableTransactionLog) {
      this.recordTransaction({
        id: `trans-${Date.now()}`,
        type: 'game_win',
        amount,
        description: reason,
        timestamp: Date.now(),
        participants: {
          from: source,
          to: 'player',
        },
      });
    }

    return true;
  }

  /** 减少金币 */
  removeGold(amount: number, reason: string, destination: string = 'system'): boolean {
    if (amount <= 0) return false;
    if (this.playerGold < amount) return false;

    this.playerGold -= amount;

    if (this.config.enableTransactionLog) {
      this.recordTransaction({
        id: `trans-${Date.now()}`,
        type: 'game_loss',
        amount: -amount,
        description: reason,
        timestamp: Date.now(),
        participants: {
          from: 'player',
          to: destination,
        },
      });
    }

    return true;
  }

  /** 购买商品 */
  buyItem(itemId: string, quantity: number = 1): {
    success: boolean;
    message: string;
    item?: Item;
    totalCost?: number;
  } {
    const item = this.items.get(itemId);
    if (!item) {
      return { success: false, message: '商品不存在' };
    }

    if (!item.buyable) {
      return { success: false, message: '该商品不可购买' };
    }

    if (item.stock !== -1 && item.stock < quantity) {
      return { success: false, message: '库存不足' };
    }

    const totalCost = item.price * quantity;
    if (this.playerGold < totalCost) {
      return { success: false, message: '金币不足' };
    }

    // 扣除金币
    this.playerGold -= totalCost;

    // 减少库存
    if (item.stock !== -1) {
      item.stock -= quantity;
    }

    // 添加到玩家库存
    for (let i = 0; i < quantity; i++) {
      this.playerInventory.push({ ...item });
    }

    // 记录交易
    if (this.config.enableTransactionLog) {
      this.recordTransaction({
        id: `trans-${Date.now()}`,
        type: 'buy',
        amount: -totalCost,
        itemId,
        description: `购买 ${quantity} 个 ${item.name}`,
        timestamp: Date.now(),
        participants: {
          from: 'player',
          to: itemId,
        },
      });
    }

    return {
      success: true,
      message: `成功购买 ${quantity} 个 ${item.name}，花费 ${totalCost} 金币`,
      item,
      totalCost,
    };
  }

  /** 给小费 */
  giveTip(npcId: string, npcName: string, amount: number): {
    success: boolean;
    message: string;
  } {
    if (amount < this.config.minTip || amount > this.config.maxTip) {
      return {
        success: false,
        message: `小费金额必须在 ${this.config.minTip} 到 ${this.config.maxTip} 之间`,
      };
    }

    if (this.playerGold < amount) {
      return { success: false, message: '金币不足' };
    }

    this.playerGold -= amount;

    if (this.config.enableTransactionLog) {
      this.recordTransaction({
        id: `trans-${Date.now()}`,
        type: 'tip',
        amount: -amount,
        description: `给 ${npcName} 的小费`,
        timestamp: Date.now(),
        participants: {
          from: 'player',
          to: npcId,
        },
      });
    }

    return {
      success: true,
      message: `你给了 ${npcName} ${amount} 金币的小费`,
    };
  }

  /** 获取所有商品 */
  getAllItems(): Item[] {
    return Array.from(this.items.values());
  }

  /** 获取可购买商品 */
  getBuyableItems(): Item[] {
    return Array.from(this.items.values()).filter(item => item.buyable);
  }

  /** 获取商品详情 */
  getItem(itemId: string): Item | undefined {
    return this.items.get(itemId);
  }

  /** 获取玩家库存 */
  getPlayerInventory(): Item[] {
    return [...this.playerInventory];
  }

  /** 使用物品 */
  useItem(itemId: string): {
    success: boolean;
    message: string;
    effects?: Array<{ type: string; value: number }>;
  } {
    const index = this.playerInventory.findIndex(item => item.id === itemId);
    if (index === -1) {
      return { success: false, message: '物品不在库存中' };
    }

    const item = this.playerInventory[index];

    // 从库存中移除
    this.playerInventory.splice(index, 1);

    return {
      success: true,
      message: `使用了 ${item.name}`,
      effects: item.effects,
    };
  }

  /** 记录交易 */
  private recordTransaction(transaction: Transaction): void {
    this.transactions.push(transaction);

    // 限制交易记录数量
    if (this.transactions.length > 100) {
      this.transactions.shift();
    }
  }

  /** 获取交易历史 */
  getTransactionHistory(limit?: number): Transaction[] {
    if (limit) {
      return this.transactions.slice(-limit);
    }
    return [...this.transactions];
  }

  /** 获取经济统计 */
  getStats(): EconomyStats {
    let totalVolume = 0;
    let buyCount = 0;
    let sellCount = 0;
    let totalTips = 0;
    let gameNetGold = 0;

    for (const trans of this.transactions) {
      totalVolume += Math.abs(trans.amount);

      switch (trans.type) {
        case 'buy':
          buyCount++;
          break;
        case 'sell':
          sellCount++;
          break;
        case 'tip':
          totalTips += Math.abs(trans.amount);
          break;
        case 'game_win':
          gameNetGold += trans.amount;
          break;
        case 'game_loss':
          gameNetGold += trans.amount;
          break;
      }
    }

    return {
      totalTransactions: this.transactions.length,
      totalVolume,
      buyCount,
      sellCount,
      totalTips,
      gameNetGold,
    };
  }

  /** 重置经济系统 */
  reset(): void {
    this.playerGold = this.config.startingGold;
    this.playerInventory = [];
    this.transactions = [];
    this.items.clear();
    this.loadItems(TAVERN_ITEMS);
  }

  // ============ 物品生成与平衡系统 ============

  /**
   * 生成平衡性物品
   * @param context 物品生成上下文
   * @returns 生成的物品
   */
  async generateBalancedItem(context: {
    itemType?: ItemType;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    playerLevel?: number;
    reason?: 'reward' | 'discovery' | 'gift' | 'purchase';
    maxPrice?: number;
  }): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const {
        itemType = 'misc',
        rarity = 'common',
        playerLevel = 1,
        reason = 'reward',
        maxPrice,
      } = context;

      let item = await this.itemValidator.generateItem({
        itemType,
        rarity,
        playerLevel,
        reason,
      } as ItemGenerationContext);

      if (maxPrice && item.price > maxPrice) {
        item = this.adjustItemPrice(item, maxPrice);
      }

      item = this.balanceItemEffects(item, playerLevel);

      const validation = this.itemValidator.validateItem(item);
      if (!validation.valid) {
        return {
          success: false,
          message: `生成的物品未通过平衡性验证：${validation.errors.join(', ')}`,
        };
      }

      if (validation.warnings.length > 0) {
        console.warn('[EconomyManager] 物品平衡性警告:', validation.warnings.join(', '));
      }

      return {
        success: true,
        message: `成功生成平衡物品：${item.name}`,
        item,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成平衡物品失败：${errorMessage}`,
      };
    }
  }

  /**
   * 调整物品价格以符合经济平衡
   */
  private adjustItemPrice(item: Item, maxPrice: number): Item {
    if (item.price <= maxPrice) {
      return item;
    }

    const adjustedPrice = Math.floor(maxPrice * 0.9);

    if (item.effects && item.effects.length > 0) {
      const scale = adjustedPrice / item.price;
      item.effects = item.effects.map(effect => ({
        type: effect.type,
        value: Math.max(1, Math.floor(effect.value * scale)),
      }));
    }

    return {
      ...item,
      price: adjustedPrice,
    };
  }

  /**
   * 平衡物品效果
   */
  private balanceItemEffects(item: Item, playerLevel: number): Item {
    if (!item.effects || item.effects.length === 0) {
      return item;
    }

    const maxEffectValue = playerLevel * 10;

    const balancedEffects = item.effects.map(effect => {
      let balancedValue = effect.value;

      if (effect.type === 'heal' || effect.type === 'stamina') {
        balancedValue = Math.min(effect.value, maxEffectValue);
      } else if (effect.type === 'mood') {
        balancedValue = Math.min(effect.value, 50);
      } else if (effect.type === 'mana') {
        balancedValue = Math.min(effect.value, maxEffectValue);
      }

      return {
        type: effect.type,
        value: balancedValue,
      };
    });

    return {
      ...item,
      effects: balancedEffects,
    };
  }

  /**
   * 添加物品到商店
   */
  addItemToShop(item: Item, shopId?: string): {
    success: boolean;
    message: string;
  } {
    const validation = this.itemValidator.validateItem(item);
    if (!validation.valid) {
      return {
        success: false,
        message: `物品验证失败：${validation.errors.join(', ')}`,
      };
    }

    if (!item.buyable) {
      return {
        success: false,
        message: '只有可购买的物品才能添加到商店',
      };
    }

    this.items.set(item.id, { ...item });

    return {
      success: true,
      message: `成功将 ${item.name} 添加到商店`,
    };
  }

  /**
   * 从玩家库存出售物品
   */
  sellItem(itemId: string): {
    success: boolean;
    message: string;
    goldEarned?: number;
  } {
    const index = this.playerInventory.findIndex(item => item.id === itemId);
    if (index === -1) {
      return { success: false, message: '物品不在库存中' };
    }

    const item = this.playerInventory[index];

    if (!item.sellable) {
      return { success: false, message: '该物品不可出售' };
    }

    const sellPrice = Math.floor(item.price * 0.5);
    this.playerInventory.splice(index, 1);
    this.playerGold += sellPrice;

    if (this.config.enableTransactionLog) {
      this.recordTransaction({
        id: `trans-${Date.now()}`,
        type: 'sell',
        amount: sellPrice,
        itemId,
        description: `出售 ${item.name}`,
        timestamp: Date.now(),
        participants: {
          from: itemId,
          to: 'player',
        },
      });
    }

    return {
      success: true,
      message: `成功出售 ${item.name}，获得 ${sellPrice} 金币`,
      goldEarned: sellPrice,
    };
  }

  /**
   * 获取玩家库存物品总价值
   */
  getInventoryTotalValue(): number {
    return this.playerInventory.reduce((total, item) => total + item.price, 0);
  }

  /**
   * 检查经济平衡状态
   */
  checkEconomyBalance(): {
    isBalanced: boolean;
    playerGoldRatio: number;
    inventoryValue: number;
    recommendations: string[];
  } {
    const maxGold = this.config.maxGold;
    const playerGoldRatio = this.playerGold / maxGold;
    const inventoryValue = this.getInventoryTotalValue();
    const recommendations: string[] = [];

    let isBalanced = true;

    if (playerGoldRatio > 0.8) {
      isBalanced = false;
      recommendations.push('玩家金币过多，建议增加高价值商品或消费途径');
    } else if (playerGoldRatio < 0.1) {
      isBalanced = false;
      recommendations.push('玩家金币过少，建议增加金币获取途径');
    }

    if (inventoryValue > this.playerGold * 2) {
      recommendations.push('玩家物品价值过高，可能需要平衡物品获取速度');
    }

    return {
      isBalanced,
      playerGoldRatio,
      inventoryValue,
      recommendations,
    };
  }
}
