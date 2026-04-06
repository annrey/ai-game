/**
 * 物品验证器（ItemValidator）单元测试
 * 测试物品验证和生成功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ItemValidator } from '../item-validator.js';
import type { Item } from '../../types/economy.js';
import type { ItemGenerationContext, ValidationResult } from '../../types/validator.js';

describe('ItemValidator', () => {
  let validator: ItemValidator;

  beforeEach(() => {
    validator = new ItemValidator();
  });

  describe('validateItem - 物品验证', () => {
    it('应验证通过一个合法的饮品', () => {
      const item: Item = {
        id: 'item_001',
        name: '香醇麦酒',
        description: '酒馆招牌麦酒，醇厚香甜',
        type: 'drink',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [{ type: 'mood', value: 5 }],
        icon: '🍺',
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应验证通过一个合法的食物', () => {
      const item: Item = {
        id: 'item_002',
        name: '热腾腾炖肉',
        description: '热腾腾的炖肉，能恢复体力',
        type: 'food',
        price: 15,
        stock: 50,
        buyable: true,
        sellable: false,
        effects: [
          { type: 'heal', value: 20 },
          { type: 'stamina', value: 10 },
        ],
        icon: '🍲',
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝空名称的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '',
        description: '测试描述',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品名称不能为空');
    });

    it('应拒绝名称过短的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: 'A', // 少于 2 个字符
        description: '测试描述',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品名称长度不能少于 2 个字符');
    });

    it('应拒绝名称过长的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: 'A'.repeat(51), // 超过 50 个字符
        description: '测试描述',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品名称长度不能超过 50 个字符');
    });

    it('应拒绝空描述的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品描述不能为空');
    });

    it('应拒绝描述过短的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '短', // 少于 5 个字符
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品描述长度不能少于 5 个字符');
    });

    it('应拒绝描述过长的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: 'A'.repeat(501), // 超过 500 个字符
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品描述长度不能超过 500 个字符');
    });

    it('应拒绝无效类型的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'invalid_type' as any,
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品类型必须是 drink, food, misc, service 之一');
    });

    it('应拒绝价格过低的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 0, // 低于最小价格 1
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品价格不能低于 1');
    });

    it('应拒绝价格过高的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10001, // 超过最大价格 10000
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品价格不能超过 10000');
    });

    it('应拒绝负库存（除了 -1）的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -5, // 无效库存
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品库存必须为非负数或 -1（表示无限）');
    });

    it('应接受 -1 库存（表示无限）', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1, // 无限库存
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
    });

    it('应拒绝效果数量过多的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: Array(6).fill({ type: 'heal', value: 10 }), // 超过 5 个效果
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品效果数量不能超过 5 个');
    });

    it('应拒绝无效效果类型的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [{ type: 'invalid_effect' as any, value: 10 }],
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('第 1 个效果类型必须是 heal, mana, stamina, mood 之一');
    });

    it('应拒绝效果值为 0 或负数的物品', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [{ type: 'heal', value: 0 }],
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('第 1 个效果值必须为正数');
    });

    it('应为高效果值生成警告', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [{ type: 'heal', value: 1001 }], // 超过 1000
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('第 1 个效果值 1001 可能过高，建议检查平衡性');
    });

    it('应为高价格生成警告', () => {
      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 5001, // 超过 5000
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('物品价格 5001 较高，可能影响经济平衡');
    });

    it('应拒绝空 ID 的物品', () => {
      const item: Item = {
        id: '',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品 ID 不能为空');
    });
  });

  describe('generateItem - 物品生成', () => {
    it('应生成一个饮品（drink 类型）', async () => {
      const context: ItemGenerationContext = {
        itemType: 'drink',
        rarity: 'common',
        playerLevel: 1,
        reason: 'purchase',
      };

      const item = await validator.generateItem(context);

      expect(item).toBeDefined();
      expect(item.type).toBe('drink');
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.price).toBeGreaterThan(0);
    });

    it('应生成一个食物（food 类型）', async () => {
      const context: ItemGenerationContext = {
        itemType: 'food',
        rarity: 'uncommon',
        playerLevel: 5,
        reason: 'reward',
      };

      const item = await validator.generateItem(context);

      expect(item).toBeDefined();
      expect(item.type).toBe('food');
      expect(item.name).toBeDefined();
      expect(item.description).toBeDefined();
    });

    it('应生成一个杂项物品（misc 类型）', async () => {
      const context: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'rare',
        playerLevel: 10,
        reason: 'discovery',
      };

      const item = await validator.generateItem(context);

      expect(item).toBeDefined();
      expect(item.type).toBe('misc');
      expect(item.id).toBeDefined();
    });

    it('应根据稀有度调整价格', async () => {
      const commonContext: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'common',
        playerLevel: 1,
      };

      const legendaryContext: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'legendary',
        playerLevel: 1,
      };

      const commonItem = await validator.generateItem(commonContext);
      const legendaryItem = await validator.generateItem(legendaryContext);

      expect(commonItem.price).toBeLessThan(legendaryItem.price);
    });

    it('应根据玩家等级调整物品属性', async () => {
      const lowLevelContext: ItemGenerationContext = {
        itemType: 'food',
        rarity: 'common',
        playerLevel: 1,
      };

      const highLevelContext: ItemGenerationContext = {
        itemType: 'food',
        rarity: 'common',
        playerLevel: 20,
      };

      const lowLevelItem = await validator.generateItem(lowLevelContext);
      const highLevelItem = await validator.generateItem(highLevelContext);

      expect(lowLevelItem).toBeDefined();
      expect(highLevelItem).toBeDefined();
    });

    it('应为不同原因生成不同的描述', async () => {
      const rewardContext: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'common',
        reason: 'reward',
      };

      const discoveryContext: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'common',
        reason: 'discovery',
      };

      const giftContext: ItemGenerationContext = {
        itemType: 'misc',
        rarity: 'common',
        reason: 'gift',
      };

      const rewardItem = await validator.generateItem(rewardContext);
      const discoveryItem = await validator.generateItem(discoveryContext);
      const giftItem = await validator.generateItem(giftContext);

      expect(rewardItem.description).toContain('作为奖励');
      expect(discoveryItem.description).toContain('偶然发现');
      expect(giftItem.description).toContain('礼物');
    });

    it('应生成通过验证的物品', async () => {
      const context: ItemGenerationContext = {
        itemType: 'drink',
        rarity: 'epic',
        playerLevel: 10,
        reason: 'purchase',
      };

      const item = await validator.generateItem(context);

      const validation = validator.validateItem(item);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应使用默认值当上下文参数缺失时', async () => {
      const context: ItemGenerationContext = {};

      const item = await validator.generateItem(context);

      expect(item).toBeDefined();
      expect(item.type).toBe('misc'); // 默认类型
      expect(item.price).toBeGreaterThan(0);
    });

    it('应为不同物品类型生成不同的模板', async () => {
      const drinkItem = await validator.generateItem({ itemType: 'drink' });
      const foodItem = await validator.generateItem({ itemType: 'food' });
      const miscItem = await validator.generateItem({ itemType: 'misc' });

      expect(drinkItem.type).toBe('drink');
      expect(foodItem.type).toBe('food');
      expect(miscItem.type).toBe('misc');
    });
  });

  describe('自定义验证规则', () => {
    it('应使用自定义规则进行验证', () => {
      const customValidator = new ItemValidator({
        minNameLength: 5,
        maxNameLength: 30,
        minPrice: 5,
        maxPrice: 5000,
      });

      const item: Item = {
        id: 'item_001',
        name: '短名', // 少于 5 个字符
        description: '这是一个测试物品描述',
        type: 'misc',
        price: 3, // 低于自定义最小价格
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = customValidator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('物品名称长度不能少于 5 个字符');
      expect(result.errors).toContain('物品价格不能低于 5');
    });

    it('应允许更严格的规则', () => {
      const strictValidator = new ItemValidator({
        maxPrice: 100,
        maxEffects: 2,
        allowedTypes: ['drink'], // 只允许饮品
      });

      const item: Item = {
        id: 'item_001',
        name: '测试物品',
        description: '这是一个测试物品',
        type: 'food', // 不允许的类型
        price: 150, // 超过自定义最大价格
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [
          { type: 'heal', value: 10 },
          { type: 'mana', value: 5 },
          { type: 'stamina', value: 3 },
        ], // 超过 2 个效果
      };

      const result = strictValidator.validateItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应处理特殊字符', () => {
      const item: Item = {
        id: 'item_001',
        name: '特殊@#$物品',
        description: '这是一个包含特殊字符的物品！@#￥%……',
        type: 'misc',
        price: 10,
        stock: -1,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
    });

    it('应处理 Unicode 字符和 emoji', () => {
      const item: Item = {
        id: 'item_001',
        name: '🍺 传说麦酒',
        description: '✨神奇的饮品，能带来好运🌟',
        type: 'drink',
        price: 100,
        stock: -1,
        buyable: true,
        sellable: false,
        icon: '🍺✨',
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
    });

    it('应处理极长但合法的内容', () => {
      const item: Item = {
        id: 'item_001',
        name: 'A'.repeat(50), // 正好 50 个字符
        description: 'A'.repeat(500), // 正好 500 个字符
        type: 'misc',
        price: 10000, // 正好最大价格
        stock: 999,
        buyable: true,
        sellable: false,
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
    });

    it('应处理多个效果', () => {
      const item: Item = {
        id: 'item_001',
        name: '万能药水',
        description: '一种神奇的药水，有多种效果',
        type: 'misc',
        price: 500,
        stock: -1,
        buyable: true,
        sellable: false,
        effects: [
          { type: 'heal', value: 50 },
          { type: 'mana', value: 30 },
          { type: 'stamina', value: 20 },
          { type: 'mood', value: 10 },
        ],
      };

      const result = validator.validateItem(item);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
