# 任务和物品系统使用指南

## 📖 简介

任务和物品系统是 AI 说书人委员会的核心游戏机制之一。本指南详细介绍如何使用任务验证器（QuestValidator）和物品验证器（ItemValidator）来生成和验证游戏中的任务和物品。

## 🎯 核心组件

### 1. QuestValidator（任务验证器）

负责任务的验证和动态生成，确保所有任务都符合游戏规则和平衡性要求。

### 2. ItemValidator（物品验证器）

负责物品的验证和动态生成，确保所有物品都符合经济系统和游戏平衡性要求。

## 📝 任务系统

### 任务数据结构

```typescript
interface Quest {
  /** 任务唯一标识符 */
  id: string;
  /** 任务模板 ID */
  questId: string;
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 任务状态 */
  status: 'active' | 'completed' | 'failed';
  /** 任务目标列表 */
  objectives?: string[];
}
```

### 任务验证规则

默认规则配置：

```typescript
const DEFAULT_QUEST_RULES = {
  minTitleLength: 3,      // 最小标题长度
  maxTitleLength: 100,    // 最大标题长度
  minDescriptionLength: 10,  // 最小描述长度
  maxDescriptionLength: 1000, // 最大描述长度
  minObjectives: 1,       // 最小目标数量
  maxObjectives: 10,      // 最大目标数量
  requireObjectives: true, // 是否必须有目标
  maxGoldReward: 10000,   // 最大金币奖励
  maxExpReward: 5000,     // 最大经验奖励
};
```

### 使用示例

#### 创建任务验证器

```typescript
import { QuestValidator } from './validators/quest-validator.js';

// 使用默认规则
const validator = new QuestValidator();

// 使用自定义规则
const customValidator = new QuestValidator({
  minTitleLength: 5,
  maxTitleLength: 50,
  minObjectives: 2,
});
```

#### 验证任务

```typescript
const quest: Quest = {
  id: 'quest_001',
  questId: 'main_story_001',
  title: '王国的危机',
  description: '王国面临着前所未有的危机，需要勇敢的英雄挺身而出。',
  status: 'active',
  objectives: ['收集危机情报', '制定应对方案', '执行救援行动'],
};

const result = validator.validateQuest(quest);

if (result.valid) {
  console.log('任务验证通过 ✅');
} else {
  console.log('任务验证失败 ❌');
  console.log('错误:', result.errors);
  console.log('警告:', result.warnings);
}
```

#### 生成任务

```typescript
import type { QuestGenerationContext } from './types/validator.js';

const context: QuestGenerationContext = {
  playerLevel: 5,
  currentLocation: '王城',
  relatedNPC: '国王',
  plotType: 'story',    // 'story' | 'side' | 'daily'
  difficulty: 'medium', // 'easy' | 'medium' | 'hard'
};

const quest = await validator.generateQuest(context);
console.log('生成的任务:', quest);
```

### 任务类型

#### 1. 主线任务（story）

推动主要剧情发展的任务，通常与世界观和核心故事相关。

```typescript
const storyQuest = await validator.generateQuest({
  plotType: 'story',
  playerLevel: 10,
  currentLocation: '王城',
  relatedNPC: '国王',
  difficulty: 'hard',
});

// 示例输出：
// 标题："王国的危机"
// 描述："王国面临着前所未有的危机，需要勇敢的英雄挺身而出。"
// 目标：["收集王国的危机情报", "制定应对方案", "执行救援行动"]
```

#### 2. 支线任务（side）

可选的额外任务，提供额外的奖励和背景故事。

```typescript
const sideQuest = await validator.generateQuest({
  plotType: 'side',
  playerLevel: 5,
  currentLocation: '酒馆',
  relatedNPC: '酒馆老板',
  difficulty: 'easy',
});

// 示例输出：
// 标题："帮助酒馆老板"
// 描述："酒馆老板遇到了麻烦，希望你能伸出援手。"
// 目标：["与酒馆老板交谈了解情况", "帮助解决问题", "获得感谢"]
```

#### 3. 日常任务（daily）

可重复完成的简单任务，提供稳定的奖励来源。

```typescript
const dailyQuest = await validator.generateQuest({
  plotType: 'daily',
  playerLevel: 1,
  difficulty: 'easy',
});

// 示例输出：
// 标题："日常委托"
// 描述："一些日常的小委托，完成后可以获得报酬。"
// 目标：["接受委托", "完成委托内容", "领取报酬"]
```

## 🎒 物品系统

### 物品数据结构

```typescript
interface Item {
  /** 物品唯一标识符 */
  id: string;
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description: string;
  /** 物品类型 */
  type: ItemType; // 'drink' | 'food' | 'misc' | 'service'
  /** 价格 */
  price: number;
  /** 库存数量（-1 表示无限） */
  stock: number;
  /** 是否可购买 */
  buyable: boolean;
  /** 是否可出售 */
  sellable: boolean;
  /** 效果列表 */
  effects?: {
    type: 'heal' | 'mana' | 'stamina' | 'mood';
    value: number;
  }[];
  /** 图标 */
  icon?: string;
}
```

### 物品验证规则

默认规则配置：

```typescript
const DEFAULT_ITEM_RULES = {
  minNameLength: 2,        // 最小名称长度
  maxNameLength: 50,       // 最大名称长度
  minDescriptionLength: 5, // 最小描述长度
  maxDescriptionLength: 500, // 最大描述长度
  minPrice: 1,             // 最小价格
  maxPrice: 10000,         // 最大价格
  maxStack: 999,           // 最大堆叠数量
  allowedTypes: ['drink', 'food', 'misc', 'service'], // 允许的类型
  maxEffects: 5,           // 最大效果数量
};
```

### 使用示例

#### 创建物品验证器

```typescript
import { ItemValidator } from './validators/item-validator.js';

// 使用默认规则
const validator = new ItemValidator();

// 使用自定义规则
const customValidator = new ItemValidator({
  maxPrice: 5000,
  maxEffects: 3,
  allowedTypes: ['drink', 'food'], // 只允许饮品和食物
});
```

#### 验证物品

```typescript
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

if (result.valid) {
  console.log('物品验证通过 ✅');
} else {
  console.log('物品验证失败 ❌');
  console.log('错误:', result.errors);
  console.log('警告:', result.warnings);
}
```

#### 生成物品

```typescript
import type { ItemGenerationContext } from './types/validator.js';

const context: ItemGenerationContext = {
  itemType: 'drink',     // 'drink' | 'food' | 'misc'
  rarity: 'common',      // 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  playerLevel: 5,
  reason: 'purchase',    // 'reward' | 'discovery' | 'gift' | 'purchase'
};

const item = await validator.generateItem(context);
console.log('生成的物品:', item);
```

### 物品类型

#### 1. 饮品（drink）

提供恢复或增益效果的液体类物品。

```typescript
const drink = await validator.generateItem({
  itemType: 'drink',
  rarity: 'common',
  reason: 'purchase',
});

// 示例输出：
// 名称："香醇麦酒"
// 类型：drink
// 价格：10
// 效果：[{ type: 'mood', value: 5 }]
// 图标：🍺
```

#### 2. 食物（food）

提供恢复效果的食物类物品。

```typescript
const food = await validator.generateItem({
  itemType: 'food',
  rarity: 'uncommon',
  reason: 'reward',
});

// 示例输出：
// 名称："热腾腾炖肉"
// 类型：food
// 价格：15
// 效果：[{ type: 'heal', value: 20 }, { type: 'stamina', value: 10 }]
// 图标：🍲
```

#### 3. 杂项（misc）

其他类型的物品，如工具、书籍、饰品等。

```typescript
const misc = await validator.generateItem({
  itemType: 'misc',
  rarity: 'rare',
  reason: 'discovery',
});

// 示例输出：
// 名称："精致小饰品"
// 类型：misc
// 价格：20
// 效果：[{ type: 'mood', value: 10 }]
// 图标：📿
```

### 稀有度系统

物品稀有度影响价格和效果强度：

| 稀有度 | 价格倍率 | 说明 |
|--------|----------|------|
| common（普通） | 1.0x | 常见物品 |
| uncommon（优秀） | 1.5x | 较不常见 |
| rare（稀有） | 2.5x | 罕见物品 |
| epic（史诗） | 5.0x | 非常罕见 |
| legendary（传说） | 10.0x | 极其罕见 |

```typescript
// 生成不同稀有度的物品
const commonItem = await validator.generateItem({
  itemType: 'weapon',
  rarity: 'common',
});

const legendaryItem = await validator.generateItem({
  itemType: 'weapon',
  rarity: 'legendary',
});

console.log('普通物品价格:', commonItem.price);
console.log('传说物品价格:', legendaryItem.price); // 约是普通物品的 10 倍
```

### 效果类型

物品可以提供以下效果：

- **heal** - 恢复生命值
- **mana** - 恢复魔法值
- **stamina** - 恢复体力值
- **mood** - 改善心情

```typescript
const potion: Item = {
  id: 'potion_001',
  name: '万能药水',
  description: '一种神奇的药水，有多种效果',
  type: 'misc',
  price: 500,
  stock: -1,
  buyable: true,
  sellable: false,
  effects: [
    { type: 'heal', value: 50 },    // 恢复 50 点生命
    { type: 'mana', value: 30 },    // 恢复 30 点魔法
    { type: 'stamina', value: 20 }, // 恢复 20 点体力
    { type: 'mood', value: 10 },    // 改善 10 点心情
  ],
};
```

## 🎮 实际应用场景

### 1. NPC 对话后生成任务

```typescript
// 玩家与 NPC 交谈后
const questContext: QuestGenerationContext = {
  playerLevel: player.level,
  currentLocation: player.location,
  relatedNPC: npc.name,
  plotType: determinePlotType(npc), // 根据 NPC 类型决定
  difficulty: calculateDifficulty(player.level, npc.level),
  npcPersonality: npc.personality,
  npcGoals: npc.goals,
};

const quest = await questValidator.generateQuest(questContext);

// 将任务添加到玩家状态
player.quests.push(quest);

// 叙述任务接取过程
console.log(`${npc.name}说道："${quest.description}"`);
console.log(`【新任务】${quest.title}`);
quest.objectives?.forEach((obj, i) => {
  console.log(`  ${i + 1}. ${obj}`);
});
```

### 2. 战斗胜利后生成奖励物品

```typescript
// 战斗胜利后
const itemContext: ItemGenerationContext = {
  itemType: 'misc',
  rarity: calculateRarity(enemy.rarity), // 根据敌人稀有度
  playerLevel: player.level,
  reason: 'reward',
  relatedQuest: currentQuest?.id,
};

const rewardItem = await itemValidator.generateItem(itemContext);

// 添加到物品栏
player.inventory.push({
  id: rewardItem.id,
  name: rewardItem.name,
  quantity: 1,
  type: rewardItem.type,
});

console.log(`获得奖励：${rewardItem.icon} ${rewardItem.name}`);
console.log(rewardItem.description);
```

### 3. 商店购物系统

```typescript
// 生成商店商品列表
const shopItems: Item[] = [];

for (let i = 0; i < 5; i++) {
  const item = await itemValidator.generateItem({
    itemType: ['drink', 'food', 'misc'][Math.floor(Math.random() * 3)] as ItemType,
    rarity: ['common', 'uncommon', 'rare'][Math.floor(Math.random() * 3)] as any,
    reason: 'purchase',
  });
  shopItems.push(item);
}

// 显示商店界面
console.log('=== 商店商品 ===');
shopItems.forEach((item, index) => {
  console.log(`${index + 1}. ${item.icon} ${item.name} - ${item.price}金币`);
  console.log(`   ${item.description}`);
});

// 玩家购买
const selectedItem = shopItems[choiceIndex];
if (player.gold >= selectedItem.price) {
  player.gold -= selectedItem.price;
  player.inventory.push({
    id: selectedItem.id,
    name: selectedItem.name,
    quantity: 1,
    type: selectedItem.type,
  });
  console.log(`购买了 ${selectedItem.name}`);
} else {
  console.log('金币不足！');
}
```

### 4. 探索发现物品

```typescript
// 玩家探索时发现物品
const discoveryContext: ItemGenerationContext = {
  itemType: 'misc',
  rarity: 'uncommon',
  reason: 'discovery',
};

const discoveredItem = await itemValidator.generateItem(discoveryContext);

console.log(`你在探索中发现了一个${discoveredItem.icon} ${discoveredItem.name}！`);
console.log(discoveredItem.description);
```

## 🔍 验证错误处理

### 处理验证失败

```typescript
try {
  const quest = await questValidator.generateQuest(context);
  const validation = questValidator.validateQuest(quest);
  
  if (!validation.valid) {
    console.error('生成的任务未通过验证:', validation.errors);
    // 可以尝试重新生成或使用备用任务
    const fallbackQuest = createFallbackQuest();
    return fallbackQuest;
  }
  
  return quest;
} catch (error) {
  console.error('生成任务时出错:', error);
  // 返回默认任务
  return createDefaultQuest();
}
```

### 自定义错误处理

```typescript
class QuestGenerationError extends Error {
  constructor(public errors: string[]) {
    super(`任务生成失败：${errors.join(', ')}`);
  }
}

async function safeGenerateQuest(
  validator: QuestValidator,
  context: QuestGenerationContext,
  maxRetries = 3
): Promise<Quest> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const quest = await validator.generateQuest(context);
      const validation = validator.validateQuest(quest);
      
      if (validation.valid) {
        return quest;
      }
      
      console.warn(`第${i + 1}次生成的任务未通过验证:`, validation.errors);
    } catch (error) {
      console.warn(`第${i + 1}次生成失败:`, error);
    }
  }
  
  throw new QuestGenerationError(['多次尝试后仍无法生成有效任务']);
}
```

## 📊 平衡性调整

### 调整任务奖励

```typescript
// 根据玩家等级调整奖励
function calculateQuestReward(baseReward: number, playerLevel: number): number {
  const levelMultiplier = 1 + (playerLevel - 1) * 0.1;
  return Math.floor(baseReward * levelMultiplier);
}

// 根据难度调整奖励
const difficultyMultipliers = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.5,
};

const finalReward = calculateQuestReward(100, player.level) * difficultyMultipliers[difficulty];
```

### 调整物品价格

```typescript
// 根据稀有度和玩家等级调整价格
function calculateItemPrice(
  basePrice: number,
  rarity: string,
  playerLevel: number
): number {
  const rarityMultipliers: Record<string, number> = {
    common: 1.0,
    uncommon: 1.5,
    rare: 2.5,
    epic: 5.0,
    legendary: 10.0,
  };
  
  const levelBonus = Math.min(playerLevel * 0.05, 1.5);
  const rarityMultiplier = rarityMultipliers[rarity] || 1.0;
  
  return Math.floor(basePrice * rarityMultiplier * (1 + levelBonus));
}
```

## 📚 最佳实践

### 1. 始终验证生成的内容

```typescript
// ✅ 好的做法
const quest = await validator.generateQuest(context);
const validation = validator.validateQuest(quest);
if (!validation.valid) {
  throw new Error(`无效任务：${validation.errors.join(', ')}`);
}

// ❌ 不好的做法
const quest = await validator.generateQuest(context);
// 直接使用，不验证
```

### 2. 提供丰富的上下文

```typescript
// ✅ 好的做法 - 提供完整上下文
const context: QuestGenerationContext = {
  playerLevel: 10,
  currentLocation: '幽暗森林',
  relatedNPC: '精灵女王',
  plotType: 'story',
  difficulty: 'hard',
  eventType: 'rescue',
  npcPersonality: '高贵、智慧、仁慈',
  npcGoals: ['保护森林', '寻找英雄'],
};

// ❌ 不好的做法 - 上下文不足
const context: QuestGenerationContext = {
  plotType: 'story',
};
```

### 3. 使用合适的稀有度

```typescript
// 根据游戏进度选择稀有度
function getItemRarity(gameProgress: number): string {
  if (gameProgress < 0.3) return 'common';
  if (gameProgress < 0.6) return 'uncommon';
  if (gameProgress < 0.8) return 'rare';
  if (gameProgress < 0.95) return 'epic';
  return 'legendary';
}
```

### 4. 缓存生成的内容

```typescript
// 缓存生成的任务模板
const questCache = new Map<string, Quest>();

async function getCachedQuest(key: string, context: QuestGenerationContext): Promise<Quest> {
  if (questCache.has(key)) {
    return questCache.get(key)!;
  }
  
  const quest = await questValidator.generateQuest(context);
  questCache.set(key, quest);
  return quest;
}
```

## 🧪 测试示例

### 任务验证器测试

```typescript
import { describe, it, expect } from 'vitest';
import { QuestValidator } from '../quest-validator.js';

describe('QuestValidator', () => {
  it('应生成并通过验证的任务', async () => {
    const validator = new QuestValidator();
    const context = {
      playerLevel: 5,
      plotType: 'story' as const,
      difficulty: 'medium' as const,
    };
    
    const quest = await validator.generateQuest(context);
    const validation = validator.validateQuest(quest);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
  
  it('应拒绝无效的任务', () => {
    const validator = new QuestValidator();
    const invalidQuest = {
      id: '',
      questId: 'test',
      title: '', // 空标题
      description: '短', // 描述过短
      status: 'active',
      objectives: [], // 无目标
    };
    
    const result = validator.validateQuest(invalidQuest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### 物品验证器测试

```typescript
import { describe, it, expect } from 'vitest';
import { ItemValidator } from '../item-validator.js';

describe('ItemValidator', () => {
  it('应生成并通过验证的物品', async () => {
    const validator = new ItemValidator();
    const context = {
      itemType: 'drink' as const,
      rarity: 'common' as const,
      reason: 'purchase' as const,
    };
    
    const item = await validator.generateItem(context);
    const validation = validator.validateItem(item);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
  
  it('应根据稀有度调整价格', async () => {
    const validator = new ItemValidator();
    
    const commonItem = await validator.generateItem({
      itemType: 'misc',
      rarity: 'common',
    });
    
    const legendaryItem = await validator.generateItem({
      itemType: 'misc',
      rarity: 'legendary',
    });
    
    expect(legendaryItem.price).toBeGreaterThan(commonItem.price);
  });
});
```

## 📚 相关资源

- [QuestValidator 实现](../src/validators/quest-validator.ts) - 查看任务验证器源代码
- [ItemValidator 实现](../src/validators/item-validator.ts) - 查看物品验证器源代码
- [类型定义](../src/types/validator.ts) - 查看完整的类型定义
- [经济系统类型](../src/types/economy.ts) - 查看物品相关类型
- [场景类型](../src/types/scene.ts) - 查看任务相关类型

---

**最后更新：** 2026-04-06
**版本：** 0.1.0
