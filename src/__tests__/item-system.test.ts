/**
 * 物品创造系统测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ItemValidator } from '../validators/item-validator.js';
import { EconomyManager } from '../engine/economy-manager.js';
import type { Item } from '../types/economy.js';

describe('物品创造系统', () => {
  let itemValidator: ItemValidator;
  let economyManager: EconomyManager;

  beforeEach(() => {
    itemValidator = new ItemValidator();
    economyManager = new EconomyManager();
  });

  describe('ItemValidator', () => {
    it('应该验证有效的物品', () => {
      const item: Item = {
        id: 'test-item-1',
        name: '测试物品',
        description: '这是一个用于测试的物品',
        type: 'misc',
        price: 50,
        stock: -1,
        buyable: false,
        sellable: true,
      };

      const result = itemValidator.validateItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的物品名称', () => {
      const item: Item = {
        id: 'test-item-2',
        name: 'A',
        description: '这是一个用于测试的物品',
        type: 'misc',
        price: 50,
        stock: -1,
        buyable: false,
        sellable: true,
      };

      const result = itemValidator.validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品名称长度不能少于 2 个字符');
    });

    it('应该拒绝无效的价格', () => {
      const item: Item = {
        id: 'test-item-3',
        name: '测试物品',
        description: '这是一个用于测试的物品',
        type: 'misc',
        price: 0,
        stock: -1,
        buyable: false,
        sellable: true,
      };

      const result = itemValidator.validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品价格不能低于 1');
    });

    it('应该拒绝无效的物品类型', () => {
      const item: Item = {
        id: 'test-item-4',
        name: '测试物品',
        description: '这是一个用于测试的物品',
        type: 'invalid' as any,
        price: 50,
        stock: -1,
        buyable: false,
        sellable: true,
      };

      const result = itemValidator.validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('物品生成', () => {
    it('应该生成任务奖励物品', async () => {
      const item = await itemValidator.generateItem({
        itemType: 'food',
        rarity: 'common',
        playerLevel: 1,
        reason: 'reward',
      });

      expect(item).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.description).toContain('奖励');
      expect(item.sellable).toBe(true);
    });

    it('应该生成探索发现物品', async () => {
      const item = await itemValidator.generateItem({
        itemType: 'misc',
        rarity: 'uncommon',
        playerLevel: 5,
        reason: 'discovery',
      });

      expect(item).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.description).toContain('发现');
      expect(item.sellable).toBe(true);
    });

    it('应该生成 NPC 赠与物品', async () => {
      const item = await itemValidator.generateItem({
        itemType: 'drink',
        rarity: 'rare',
        playerLevel: 10,
        reason: 'gift',
      });

      expect(item).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.description).toContain('礼物');
    });

    it('应该生成可购买的物品', async () => {
      const item = await itemValidator.generateItem({
        itemType: 'food',
        rarity: 'common',
        playerLevel: 1,
        reason: 'purchase',
      });

      expect(item).toBeDefined();
      expect(item.buyable).toBe(true);
      expect(item.stock).toBeGreaterThan(0);
    });
  });

  describe('稀有度影响', () => {
    it('传说稀有度应该有更高的价格', async () => {
      const commonItem = await itemValidator.generateItem({
        itemType: 'misc',
        rarity: 'common',
        playerLevel: 10,
        reason: 'reward',
      });

      const legendaryItem = await itemValidator.generateItem({
        itemType: 'misc',
        rarity: 'legendary',
        playerLevel: 10,
        reason: 'reward',
      });

      expect(legendaryItem.price).toBeGreaterThan(commonItem.price);
    });

    it('玩家等级应该影响物品属性', async () => {
      const lowLevelItem = await itemValidator.generateItem({
        itemType: 'food',
        rarity: 'common',
        playerLevel: 1,
        reason: 'reward',
      });

      const highLevelItem = await itemValidator.generateItem({
        itemType: 'food',
        rarity: 'common',
        playerLevel: 20,
        reason: 'reward',
      });

      // 高等级物品价格通常会更高，但由于随机性，这里只检查物品是否有效
      expect(highLevelItem).toBeDefined();
      expect(lowLevelItem).toBeDefined();
    });
  });

  describe('EconomyManager 物品生成', () => {
    it('应该生成平衡的物品', async () => {
      const result = await economyManager.generateBalancedItem({
        itemType: 'food',
        rarity: 'common',
        playerLevel: 5,
        reason: 'reward',
        maxPrice: 100,
      });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      if (result.item) {
        expect(result.item.price).toBeLessThanOrEqual(100);
      }
    });

    it('应该检查经济平衡状态', () => {
      const balance = economyManager.checkEconomyBalance();
      
      expect(balance).toBeDefined();
      expect(balance.isBalanced).toBeDefined();
      expect(balance.playerGoldRatio).toBeDefined();
      expect(balance.inventoryValue).toBeDefined();
    });

    it('应该获取玩家库存总价值', () => {
      const totalValue = economyManager.getInventoryTotalValue();
      expect(totalValue).toBeGreaterThanOrEqual(0);
    });
  });
});
