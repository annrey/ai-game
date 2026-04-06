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
} from '../types/economy.js';
import { TAVERN_ITEMS, DEFAULT_ECONOMY_CONFIG } from '../types/economy.js';

export class EconomyManager {
  private items = new Map<string, Item>();
  private transactions: Transaction[] = [];
  private config: EconomyConfig;
  private playerGold: number;
  private playerInventory: Item[] = [];

  constructor(config: Partial<EconomyConfig> = {}) {
    this.config = { ...DEFAULT_ECONOMY_CONFIG, ...config };
    this.playerGold = this.config.startingGold;
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
}
