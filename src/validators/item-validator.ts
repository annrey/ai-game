import type { Item } from '../types/economy.js';
import type { ItemGenerationContext, ItemValidationRules, ValidationResult, ItemGenerator } from '../types/validator.js';

const DEFAULT_ITEM_RULES: ItemValidationRules = {
  minNameLength: 2,
  maxNameLength: 50,
  minDescriptionLength: 5,
  maxDescriptionLength: 500,
  minPrice: 1,
  maxPrice: 10000,
  maxStack: 999,
  allowedTypes: ['drink', 'food', 'misc', 'service'],
  maxEffects: 5,
};

export class ItemValidator implements ItemGenerator {
  private rules: ItemValidationRules;

  constructor(rules?: Partial<ItemValidationRules>) {
    this.rules = { ...DEFAULT_ITEM_RULES, ...rules };
  }

  validateItem(item: Item): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!item.name || item.name.trim().length === 0) {
      errors.push('物品名称不能为空');
    } else {
      if (item.name.length < this.rules.minNameLength) {
        errors.push(`物品名称长度不能少于 ${this.rules.minNameLength} 个字符`);
      }
      if (item.name.length > this.rules.maxNameLength) {
        errors.push(`物品名称长度不能超过 ${this.rules.maxNameLength} 个字符`);
      }
    }

    if (!item.description || item.description.trim().length === 0) {
      errors.push('物品描述不能为空');
    } else {
      if (item.description.length < this.rules.minDescriptionLength) {
        errors.push(`物品描述长度不能少于 ${this.rules.minDescriptionLength} 个字符`);
      }
      if (item.description.length > this.rules.maxDescriptionLength) {
        errors.push(`物品描述长度不能超过 ${this.rules.maxDescriptionLength} 个字符`);
      }
    }

    if (!this.rules.allowedTypes.includes(item.type)) {
      errors.push(`物品类型必须是 ${this.rules.allowedTypes.join(', ')} 之一`);
    }

    if (item.price < this.rules.minPrice) {
      errors.push(`物品价格不能低于 ${this.rules.minPrice}`);
    }
    if (item.price > this.rules.maxPrice) {
      errors.push(`物品价格不能超过 ${this.rules.maxPrice}`);
    }

    if (item.stock !== -1 && item.stock < 0) {
      errors.push('物品库存必须为非负数或 -1（表示无限）');
    }

    if (item.effects && item.effects.length > this.rules.maxEffects) {
      errors.push(`物品效果数量不能超过 ${this.rules.maxEffects} 个`);
    }

    if (item.effects) {
      const validEffectTypes = ['heal', 'mana', 'stamina', 'mood'];
      for (let i = 0; i < item.effects.length; i++) {
        const effect = item.effects[i];
        if (!validEffectTypes.includes(effect.type)) {
          errors.push(`第 ${i + 1} 个效果类型必须是 ${validEffectTypes.join(', ')} 之一`);
        }
        if (effect.value <= 0) {
          errors.push(`第 ${i + 1} 个效果值必须为正数`);
        }
        if (effect.value > 1000) {
          warnings.push(`第 ${i + 1} 个效果值 ${effect.value} 可能过高，建议检查平衡性`);
        }
      }
    }

    if (item.price > 5000) {
      warnings.push(`物品价格 ${item.price} 较高，可能影响经济平衡`);
    }

    if (!item.id || item.id.trim().length === 0) {
      errors.push('物品 ID 不能为空');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async generateItem(context: ItemGenerationContext): Promise<Item> {
    const {
      itemType = 'misc',
      rarity = 'common',
      playerLevel = 1,
      reason = 'discovery',
    } = context;

    const itemTemplates = this.getItemTemplates(itemType);
    const template = itemTemplates[Math.floor(Math.random() * itemTemplates.length)];

    const rarityMultiplier = this.getRarityMultiplier(rarity);
    const levelBonus = Math.min(playerLevel * 0.05, 1.5);
    const finalMultiplier = rarityMultiplier * (1 + levelBonus);

    const price = Math.floor(template.basePrice * finalMultiplier);
    const effects = this.scaleEffects(template.effects, finalMultiplier);

    const item: Item = {
      id: this.generateItemId(),
      name: this.generateName(template, rarity),
      description: this.generateDescription(template, context),
      type: itemType,
      price,
      stock: reason === 'purchase' ? Math.floor(template.baseStock * finalMultiplier) : -1,
      buyable: reason === 'purchase',
      sellable: reason === 'reward' || reason === 'discovery',
      effects: effects.length > 0 ? effects : undefined,
      icon: template.icon,
    };

    const validation = this.validateItem(item);
    if (!validation.valid) {
      throw new Error(`生成的物品未通过验证：${validation.errors.join(', ')}`);
    }

    return item;
  }

  private getItemTemplates(itemType: string) {
    const templates: Array<{
      baseName: string;
      basePrice: number;
      baseStock: number;
      effects: Array<{ type: 'heal' | 'mana' | 'stamina' | 'mood'; value: number }>;
      icon: string;
      namePrefixes: string[];
      descriptions: string[];
    }> = [];

    if (itemType === 'drink') {
      templates.push(
        {
          baseName: '饮品',
          basePrice: 10,
          baseStock: 50,
          effects: [{ type: 'mood', value: 5 }],
          icon: '🍺',
          namePrefixes: ['香醇', '清爽', '浓郁', '冰镇', '特制'],
          descriptions: [
            '一款受欢迎的饮品，能让人心情愉悦。',
            '经过精心调制的饮品，口感独特。',
            '当地人喜爱的饮品，有着特殊的风味。',
          ],
        },
        {
          baseName: '果汁',
          basePrice: 8,
          baseStock: 60,
          effects: [{ type: 'stamina', value: 5 }],
          icon: '🧃',
          namePrefixes: ['新鲜', '纯天然', '现榨', '冰爽', '香甜'],
          descriptions: [
            '用新鲜水果榨取的果汁，富含营养。',
            '清爽解渴的天然饮品。',
            '充满活力的健康饮品。',
          ],
        },
        {
          baseName: '药酒',
          basePrice: 25,
          baseStock: 30,
          effects: [
            { type: 'heal', value: 10 },
            { type: 'stamina', value: 5 },
          ],
          icon: '🍶',
          namePrefixes: ['秘制', '古老配方', '珍贵', '特效', '珍稀'],
          descriptions: [
            '采用珍贵药材泡制的药酒，有恢复体力的功效。',
            '传承已久的秘制药酒，效果显著。',
            '专为冒险者准备的恢复药酒。',
          ],
        }
      );
    } else if (itemType === 'food') {
      templates.push(
        {
          baseName: '食物',
          basePrice: 15,
          baseStock: 40,
          effects: [{ type: 'heal', value: 15 }],
          icon: '🍲',
          namePrefixes: ['热腾腾', '美味', '丰盛', '家常', '招牌'],
          descriptions: [
            '一份热腾腾的食物，能恢复大量体力。',
            '用心烹制的美味佳肴。',
            '当地特色的美食，令人回味无穷。',
          ],
        },
        {
          baseName: '面包',
          basePrice: 5,
          baseStock: 80,
          effects: [{ type: 'heal', value: 8 }],
          icon: '🍞',
          namePrefixes: ['新鲜出炉', '松软', '全麦', '香脆', '手工'],
          descriptions: [
            '刚出炉的新鲜面包，香气扑鼻。',
            '简单却美味的充饥食物。',
            '旅行者必备的口粮。',
          ],
        },
        {
          baseName: '大餐',
          basePrice: 50,
          baseStock: 20,
          effects: [
            { type: 'heal', value: 50 },
            { type: 'mood', value: 20 },
          ],
          icon: '🍗',
          namePrefixes: ['豪华', '盛宴', '丰盛', '节日', '庆典'],
          descriptions: [
            '一顿丰盛的大餐，能完全恢复体力并让人心情愉悦。',
            '为特殊场合准备的豪华料理。',
            '令人满足的盛宴。',
          ],
        }
      );
    } else if (itemType === 'misc') {
      templates.push(
        {
          baseName: '小饰品',
          basePrice: 20,
          baseStock: 30,
          effects: [{ type: 'mood', value: 10 }],
          icon: '📿',
          namePrefixes: ['精致', '独特', '手工', '幸运', '纪念'],
          descriptions: [
            '一个精美的小饰品，能带来好心情。',
            '具有特殊意义的小物件。',
            '让人爱不释手的精致工艺品。',
          ],
        },
        {
          baseName: '书籍',
          basePrice: 30,
          baseStock: 25,
          effects: [{ type: 'mood', value: 15 }],
          icon: '📚',
          namePrefixes: ['古老', '神秘', '珍贵', '稀有', '经典'],
          descriptions: [
            '一本记载着有趣知识的书籍。',
            '充满智慧的古老典籍。',
            '值得一读的好书。',
          ],
        },
        {
          baseName: '工具',
          basePrice: 35,
          baseStock: 35,
          effects: [{ type: 'stamina', value: 10 }],
          icon: '🔧',
          namePrefixes: ['实用', '耐用', '专业', '便携', '多功能'],
          descriptions: [
            '一件实用的工具，能在冒险中派上用场。',
            '质量可靠的必需品。',
            '旅行者的好帮手。',
          ],
        }
      );
    } else {
      templates.push(
        {
          baseName: '杂项物品',
          basePrice: 10,
          baseStock: 50,
          effects: [],
          icon: '📦',
          namePrefixes: ['普通', '神秘', '未知', '特殊', '罕见'],
          descriptions: [
            '一件用途不明的物品，也许会有用。',
            '看起来有点特别的物品。',
            '不知道从哪里来的东西。',
          ],
        }
      );
    }

    return templates;
  }

  private getRarityMultiplier(rarity: string): number {
    return {
      common: 1.0,
      uncommon: 1.5,
      rare: 2.5,
      epic: 5.0,
      legendary: 10.0,
    }[rarity] || 1.0;
  }

  private scaleEffects(
    effects: Array<{ type: 'heal' | 'mana' | 'stamina' | 'mood'; value: number }>,
    multiplier: number
  ): Array<{ type: 'heal' | 'mana' | 'stamina' | 'mood'; value: number }> {
    return effects.map((effect) => ({
      type: effect.type,
      value: Math.floor(effect.value * multiplier),
    }));
  }

  private generateName(template: any, rarity: string): string {
    const prefix = template.namePrefixes[Math.floor(Math.random() * template.namePrefixes.length)];
    const rarityPrefixes: Record<string, string> = {
      common: '',
      uncommon: '上等 ',
      rare: '稀有 ',
      epic: '史诗 ',
      legendary: '传说 ',
    };
    const rarityPrefix = rarityPrefixes[rarity] || '';
    return `${rarityPrefix}${prefix}${template.baseName}`;
  }

  private generateDescription(template: any, context: ItemGenerationContext): string {
    const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
    if (context.reason === 'reward') {
      return `${description} 作为奖励获得的特殊物品。`;
    } else if (context.reason === 'discovery') {
      return `${description} 偶然发现的有趣物品。`;
    } else if (context.reason === 'gift') {
      return `${description} 他人赠送的礼物。`;
    }
    return description;
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
