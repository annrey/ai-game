# OpenClaw Game 改进实施计划

## 文档信息
- **版本**: 1.0
- **日期**: 2026-04-29
- **范围**: 世界物质层（地形/建筑）、文明层（文化）、生物活动层（生物类型）、事件系统（因果链）

---

## 一、总体架构愿景

将 OpenClaw 从「场景叙事引擎」升级为「多层世界模拟引擎」：

```
┌─────────────────────────────────────────────────────────────┐
│                     叙事表现层 (Presentation)                  │
│              Narrator / UI / 流式输出 / 可视化                 │
├─────────────────────────────────────────────────────────────┤
│                      事件因果层 (Event Graph)                  │
│              事件图谱、因果链、连锁反应、历史记录               │
├─────────────────────────────────────────────────────────────┤
│  生物活动层 (Living)  │  文明层 (Civilization)                │
│  人 / 动物 / 怪物     │  文化 / 政治 / 经济 / 宗教             │
│  生态 / 行为 / 演化   │  演进 / 传播 / 冲突 / 融合             │
├─────────────────────────────────────────────────────────────┤
│                    世界物质层 (Material)                       │
│         地形 / 建筑 / 空间拓扑 / 资源分布 / 气候带            │
├─────────────────────────────────────────────────────────────┤
│                     核心引擎 (Core Engine)                     │
│           事件总线 / 规则引擎 / 记忆系统 / AI 代理              │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Phase 1: 世界物质层 — 地形与建筑系统

### 2.1 地形系统 (Terrain System)

#### 目标
建立可扩展的地形类型体系，让地形影响移动、视野、战斗、资源获取。

#### 核心类型定义

```typescript
// packages/shared-types/src/terrain.ts

/** 地形类型 */
export type TerrainType =
  | 'plains'      // 平原
  | 'forest'      // 森林
  | 'mountain'    // 山地
  | 'hill'        // 丘陵
  | 'desert'      // 沙漠
  | 'swamp'       // 沼泽
  | 'river'       // 河流
  | 'lake'        // 湖泊
  | 'coast'       // 海岸
  | 'cave'        // 洞穴
  | 'jungle'      // 丛林
  | 'tundra'      // 苔原
  | 'volcanic'    // 火山
  | 'ruins';      // 废墟

/** 地形属性 */
export interface TerrainProperties {
  /** 移动难度倍率 (1.0 = 正常, 2.0 = 双倍消耗) */
  moveDifficulty: number;
  /** 视野范围倍率 */
  visibilityMultiplier: number;
  /** 隐蔽性 (0-1) */
  concealment: number;
  /** 可采集资源类型 */
  harvestableResources: ResourceType[];
  /** 气候倾向 */
  climateBias: ClimateType;
  /** 危险等级 */
  dangerLevel: number;
  /** 建造难度 */
  buildDifficulty: number;
}

/** 地形实例 */
export interface Terrain {
  id: string;
  type: TerrainType;
  name: string;
  description: string;
  properties: TerrainProperties;
  /** 地形特有效果 */
  effects: TerrainEffect[];
  /** 关联天气倾向 */
  weatherBias: Partial<Record<WeatherType, number>>;
}

/** 地形效果 */
export interface TerrainEffect {
  id: string;
  trigger: 'enter' | 'stay' | 'exit' | 'combat' | 'rest';
  target: 'player' | 'npc' | 'all';
  type: 'health' | 'stamina' | 'mood' | 'visibility' | 'combat_bonus';
  value: number;
  description: string;
}

/** 资源类型 */
export type ResourceType =
  | 'wood' | 'stone' | 'ore' | 'herb' | 'water'
  | 'food' | 'hide' | 'fiber' | 'gem' | 'mana_crystal';
```

#### 地形预设数据

```typescript
// packages/shared-types/src/terrain-presets.ts

export const TERRAIN_PRESETS: Record<TerrainType, Terrain> = {
  plains: {
    id: 'terrain_plains',
    type: 'plains',
    name: '平原',
    description: '一望无际的草原，视野开阔，适合快速移动。',
    properties: {
      moveDifficulty: 1.0,
      visibilityMultiplier: 1.5,
      concealment: 0.1,
      harvestableResources: ['food', 'herb', 'fiber'],
      climateBias: 'temperate',
      dangerLevel: 0.2,
      buildDifficulty: 1.0,
    },
    effects: [
      { id: 'plains_open', trigger: 'combat', target: 'all', type: 'visibility', value: 1, description: '开阔地形，远程攻击获得优势' },
    ],
    weatherBias: { sunny: 0.3, rainy: 0.2, cloudy: 0.3 },
  },
  forest: {
    id: 'terrain_forest',
    type: 'forest',
    name: '森林',
    description: '茂密的树林，提供了良好的隐蔽但限制了视野。',
    properties: {
      moveDifficulty: 1.4,
      visibilityMultiplier: 0.6,
      concealment: 0.7,
      harvestableResources: ['wood', 'herb', 'food', 'hide'],
      climateBias: 'temperate',
      dangerLevel: 0.4,
      buildDifficulty: 1.2,
    },
    effects: [
      { id: 'forest_cover', trigger: 'combat', target: 'all', type: 'combat_bonus', value: -0.2, description: '树木遮挡，远程攻击命中率降低' },
      { id: 'forest_rest', trigger: 'rest', target: 'all', type: 'mood', value: 3, description: '林间休息令人心旷神怡' },
    ],
    weatherBias: { rainy: 0.3, foggy: 0.2, sunny: 0.2 },
  },
  mountain: {
    id: 'terrain_mountain',
    type: 'mountain',
    name: '山地',
    description: '陡峭的山峰，攀登困难但视野极佳。',
    properties: {
      moveDifficulty: 2.2,
      visibilityMultiplier: 2.0,
      concealment: 0.3,
      harvestableResources: ['stone', 'ore', 'gem'],
      climateBias: 'cold',
      dangerLevel: 0.6,
      buildDifficulty: 2.0,
    },
    effects: [
      { id: 'mountain_climb', trigger: 'stay', target: 'all', type: 'stamina', value: -2, description: '攀登消耗额外体力' },
      { id: 'mountain_vantage', trigger: 'combat', target: 'all', type: 'combat_bonus', value: 0.3, description: '高地优势，攻击获得加成' },
    ],
    weatherBias: { snowy: 0.3, stormy: 0.2, foggy: 0.2 },
  },
  // ... 其他地形
};
```

#### 实施文件清单

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `packages/shared-types/src/terrain.ts` | 地形类型定义 | P0 |
| `packages/shared-types/src/terrain-presets.ts` | 地形预设数据 | P0 |
| `packages/core/src/engine/terrain-manager.ts` | 地形管理器 | P0 |
| `packages/core/src/engine/__tests__/terrain-manager.test.ts` | 地形管理器测试 | P1 |

#### 地形管理器接口

```typescript
// packages/core/src/engine/terrain-manager.ts

export class TerrainManager {
  /** 获取指定位置的地形 */
  getTerrainAt(locationId: string): Terrain | undefined;

  /** 计算从A到B的移动消耗 */
  calculateMoveCost(fromLocationId: string, toLocationId: string): number;

  /** 获取地形对战斗的修正 */
  getCombatModifiers(locationId: string): CombatModifier[];

  /** 获取可采集资源 */
  getHarvestableResources(locationId: string): ResourceType[];

  /** 获取地形描述（用于叙事） */
  getTerrainDescription(locationId: string): string;

  /** 注册自定义地形 */
  registerTerrain(terrain: Terrain): void;
}
```

---

### 2.2 建筑/空间系统 (Architecture & Spatial System)

#### 目标
建立建筑结构模型，支持房间、楼层、区域连通性，让建筑成为可探索的空间。

#### 核心类型定义

```typescript
// packages/shared-types/src/architecture.ts

/** 建筑类型 */
export type BuildingType =
  | 'tavern'      // 酒馆
  | 'house'       // 住宅
  | 'shop'        // 商店
  | 'temple'      // 神庙
  | 'castle'      // 城堡
  | 'dungeon'     // 地牢
  | 'tower'       // 塔楼
  | 'cave_system' // 洞穴系统
  | 'ruins'       // 废墟
  | 'camp'        // 营地
  | 'fort'        // 要塞
  | 'mansion';    // 庄园

/** 空间节点（房间/区域） */
export interface SpaceNode {
  id: string;
  name: string;
  description: string;
  /** 所属建筑 */
  buildingId: string;
  /** 空间类型 */
  type: 'room' | 'hall' | 'corridor' | 'courtyard' | 'cellar' | 'tower' | 'cave';
  /** 连通的空间 */
  connections: SpaceConnection[];
  /** 包含的物体 */
  objects: InteractableObject[];
  /** 光照条件 */
  lighting: 'bright' | 'dim' | 'dark' | 'pitch_black';
  /** 容纳人数上限 */
  capacity: number;
  /** 当前在场角色 */
  occupants: string[];
  /** 地形覆盖（用于室外区域） */
  terrainOverride?: TerrainType;
}

/** 空间连接 */
export interface SpaceConnection {
  targetSpaceId: string;
  /** 连接类型 */
  type: 'door' | 'stairs_up' | 'stairs_down' | 'ladder' | 'passage' | 'gate' | 'hidden';
  /** 是否上锁 */
  locked: boolean;
  /** 是否需要钥匙 */
  requiresKey?: string;
  /** 是否隐藏 */
  hidden: boolean;
  /** 通行难度（如坍塌通道） */
  traversalDifficulty: number;
  /** 双向描述 */
  description: string;
}

/** 建筑实例 */
export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  description: string;
  /** 所属区域/地点 */
  locationId: string;
  /** 包含的空间 */
  spaces: Map<string, SpaceNode>;
  /** 入口空间ID */
  entranceSpaceId: string;
  /** 建筑状态 */
  condition: 'intact' | 'damaged' | 'ruined' | 'burned';
  /** 所有者 */
  ownerId?: string;
  /** 派系控制 */
  controllingFactionId?: string;
}

/** 空间路径查找结果 */
export interface SpacePath {
  spaces: string[];
  totalDifficulty: number;
  requiresKeys: string[];
  hasHiddenPaths: boolean;
}
```

#### 建筑预设：酒馆（扩展现有）

```typescript
// packages/shared-types/src/building-presets.ts

export const TAVERN_BUILDING: Building = {
  id: 'building_tavern_main',
  type: 'tavern',
  name: '银酒杯酒馆',
  description: '镇上最受欢迎的酒馆，木质结构的二层建筑。',
  locationId: 'town_center',
  entranceSpaceId: 'tavern_main_hall',
  condition: 'intact',
  spaces: new Map([
    ['tavern_main_hall', {
      id: 'tavern_main_hall',
      name: '酒馆大厅',
      description: '温暖的火光映照着木质桌椅，空气中弥漫着麦酒和烤肉的香气。',
      buildingId: 'building_tavern_main',
      type: 'hall',
      lighting: 'dim',
      capacity: 20,
      occupants: [],
      objects: [
        { id: 'fireplace', name: '壁炉', type: 'furniture', icon: '🔥' },
        { id: 'piano', name: '旧钢琴', type: 'instrument', icon: '🎹' },
        { id: 'bar_counter', name: '吧台', type: 'furniture', icon: '🍺' },
      ],
      connections: [
        { targetSpaceId: 'tavern_private_room', type: 'door', locked: false, hidden: false, traversalDifficulty: 1, description: '一扇通往私人包厢的门' },
        { targetSpaceId: 'tavern_kitchen', type: 'door', locked: false, hidden: false, traversalDifficulty: 1, description: '通往厨房的门' },
        { targetSpaceId: 'tavern_stairs_up', type: 'stairs_up', locked: false, hidden: false, traversalDifficulty: 1, description: '通往二楼的楼梯' },
        { targetSpaceId: 'tavern_cellar', type: 'stairs_down', locked: true, requiresKey: 'tavern_cellar_key', hidden: false, traversalDifficulty: 1, description: '通往地窖的活板门' },
      ],
    }],
    ['tavern_private_room', {
      id: 'tavern_private_room',
      name: '私人包厢',
      description: '安静的包厢，适合密谈。',
      buildingId: 'building_tavern_main',
      type: 'room',
      lighting: 'dim',
      capacity: 6,
      occupants: [],
      objects: [],
      connections: [
        { targetSpaceId: 'tavern_main_hall', type: 'door', locked: false, hidden: false, traversalDifficulty: 1, description: '回到大厅' },
      ],
    }],
    ['tavern_kitchen', {
      id: 'tavern_kitchen',
      name: '厨房',
      description: '热气腾腾的厨房，厨师们忙碌着。',
      buildingId: 'building_tavern_main',
      type: 'room',
      lighting: 'bright',
      capacity: 5,
      occupants: [],
      objects: [],
      connections: [
        { targetSpaceId: 'tavern_main_hall', type: 'door', locked: false, hidden: false, traversalDifficulty: 1, description: '回到大厅' },
      ],
    }],
    ['tavern_stairs_up', {
      id: 'tavern_stairs_up',
      name: '二楼走廊',
      description: '狭窄的走廊，两侧是客房。',
      buildingId: 'building_tavern_main',
      type: 'corridor',
      lighting: 'dim',
      capacity: 4,
      occupants: [],
      connections: [
        { targetSpaceId: 'tavern_main_hall', type: 'stairs_down', locked: false, hidden: false, traversalDifficulty: 1, description: '回到一楼' },
        { targetSpaceId: 'tavern_room_1', type: 'door', locked: true, requiresKey: 'room_1_key', hidden: false, traversalDifficulty: 1, description: '客房1号' },
        { targetSpaceId: 'tavern_room_2', type: 'door', locked: true, requiresKey: 'room_2_key', hidden: false, traversalDifficulty: 1, description: '客房2号' },
      ],
    }],
    ['tavern_cellar', {
      id: 'tavern_cellar',
      name: '地窖',
      description: '阴暗潮湿的地窖，存放着酒桶。',
      buildingId: 'building_tavern_main',
      type: 'cellar',
      lighting: 'dark',
      capacity: 4,
      occupants: [],
      objects: [],
      connections: [
        { targetSpaceId: 'tavern_main_hall', type: 'stairs_up', locked: false, hidden: false, traversalDifficulty: 1, description: '回到大厅' },
        { targetSpaceId: 'tavern_secret_tunnel', type: 'hidden', locked: false, hidden: true, traversalDifficulty: 1, description: '一面松动的石墙后面似乎有通道' },
      ],
    }],
  ]),
};
```

#### 实施文件清单

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `packages/shared-types/src/architecture.ts` | 建筑类型定义 | P0 |
| `packages/shared-types/src/building-presets.ts` | 建筑预设数据 | P0 |
| `packages/core/src/engine/space-manager.ts` | 空间管理器 | P0 |
| `packages/core/src/engine/__tests__/space-manager.test.ts` | 空间管理器测试 | P1 |

#### 空间管理器接口

```typescript
// packages/core/src/engine/space-manager.ts

export class SpaceManager {
  /** 注册建筑 */
  registerBuilding(building: Building): void;

  /** 获取空间 */
  getSpace(spaceId: string): SpaceNode | undefined;

  /** 获取建筑 */
  getBuilding(buildingId: string): Building | undefined;

  /** 查找路径 */
  findPath(fromSpaceId: string, toSpaceId: string): SpacePath | null;

  /** 移动角色到空间 */
  moveOccupant(occupantId: string, fromSpaceId: string, toSpaceId: string): boolean;

  /** 获取可通行的连接 */
  getAvailableConnections(spaceId: string, occupantKeys?: string[]): SpaceConnection[];

  /** 发现隐藏通道 */
  revealHiddenConnection(spaceId: string, connectionIndex: number): boolean;

  /** 获取空间内所有可交互物体 */
  getInteractableObjects(spaceId: string): InteractableObject[];

  /** 生成空间描述（用于叙事） */
  generateSpaceDescription(spaceId: string): string;
}
```

---

## 三、Phase 2: 文明层 — 文化系统

### 3.1 文化模型 (Culture Model)

#### 目标
建立可独立演进的文化属性系统，让文化影响 NPC 行为、社会结构、任务生成。

#### 核心类型定义

```typescript
// packages/shared-types/src/culture.ts

/** 文化维度 — 基于人类学模型 */
export interface CultureDimensions {
  /** 个人主义 vs 集体主义 (-1 ~ 1) */
  individualism: number;
  /** 权力距离 (-1 ~ 1) */
  powerDistance: number;
  /** 不确定性规避 (-1 ~ 1) */
  uncertaintyAvoidance: number;
  /** 男性化 vs 女性化 (-1 ~ 1) */
  masculinity: number;
  /** 长期导向 (-1 ~ 1) */
  longTermOrientation: number;
  /** 放纵 vs 克制 (-1 ~ 1) */
  indulgence: number;
}

/** 文化核心元素 */
export interface CultureCore {
  /** 语言 */
  language: Language;
  /** 宗教信仰 */
  religion: Religion;
  /** 价值观 */
  values: string[];
  /** 禁忌 */
  taboos: string[];
  /** 礼仪规范 */
  etiquette: EtiquetteRule[];
}

/** 语言 */
export interface Language {
  id: string;
  name: string;
  /** 语系 */
  family: string;
  /** 问候语 */
  greetings: string[];
  /** 脏话/粗俗用语 */
  profanity: string[];
  /** 敬语系统 */
  honorifics: boolean;
  /** 方言变体 */
  dialects: string[];
}

/** 宗教 */
export interface Religion {
  id: string;
  name: string;
  /** 神祇列表 */
  deities: Deity[];
  /** 核心教义 */
  doctrines: string[];
  /** 仪式 */
  rituals: Ritual[];
  /** 圣物 */
  sacredItems: string[];
  /** 宗教节日 */
  holyDays: HolyDay[];
  /** 宗教热情 (0-1) */
  fervor: number;
}

/** 神祇 */
export interface Deity {
  id: string;
  name: string;
  domain: string[];
  alignment: 'benevolent' | 'neutral' | 'malevolent';
  symbol: string;
  favoredOfferings: string[];
}

/** 仪式 */
export interface Ritual {
  id: string;
  name: string;
  purpose: string;
  requiredItems: string[];
  steps: string[];
  /** 参与者角色 */
  participantRoles: string[];
}

/** 礼仪规则 */
export interface EtiquetteRule {
  id: string;
  situation: string;
  expectedBehavior: string;
  violationConsequence: string;
  importance: 'critical' | 'important' | 'minor';
}

/** 文化实例 */
export interface Culture {
  id: string;
  name: string;
  description: string;
  dimensions: CultureDimensions;
  core: CultureCore;
  /** 艺术形式 */
  arts: ArtForm[];
  /** 传统服饰 */
  traditionalAttire: string;
  /** 饮食习惯 */
  cuisine: Cuisine;
  /** 建筑偏好 */
  architectureStyle: string;
  /** 文化影响力 (0-1) */
  influence: number;
  /** 文化健康度 (0-1) */
  vitality: number;
  /** 母地区 */
  homelandRegionId: string;
  /** 传播到的地区 */
  spreadRegions: string[];
}

/** 艺术形式 */
export interface ArtForm {
  id: string;
  type: 'music' | 'dance' | 'poetry' | 'painting' | 'sculpture' | 'theater' | 'craft';
  name: string;
  description: string;
  notableWorks: string[];
}

/** 饮食 */
export interface Cuisine {
  stapleFoods: string[];
  preferredFlavors: string[];
  tabooIngredients: string[];
  traditionalDrinks: string[];
  diningEtiquette: string[];
}
```

#### 文化预设：北方部落 vs 南方城邦

```typescript
// packages/shared-types/src/culture-presets.ts

export const NORTHERN_TRIBAL_CULTURE: Culture = {
  id: 'culture_northern_tribe',
  name: '北地部落文化',
  description: '崇尚力量与荣誉的游牧部落文化，重视血缘与忠诚。',
  dimensions: {
    individualism: -0.6,
    powerDistance: 0.4,
    uncertaintyAvoidance: -0.3,
    masculinity: 0.7,
    longTermOrientation: 0.2,
    indulgence: 0.5,
  },
  core: {
    language: {
      id: 'lang_northern',
      name: '北地语',
      family: '古北语系',
      greetings: ['愿风指引你', '荣耀归于氏族'],
      profanity: ['懦夫', '背叛者'],
      honorifics: true,
      dialects: ['草原方言', '山地方言'],
    },
    religion: {
      id: 'religion_storm_gods',
      name: '风暴神信仰',
      deities: [
        { id: 'deity_thunder', name: '雷神托尔格', domain: ['战争', '风暴'], alignment: 'benevolent', symbol: '⚡', favoredOfferings: ['武器', '烈酒'] },
        { id: 'deity_hunt', name: '猎神维尔娜', domain: ['狩猎', '丰收'], alignment: 'neutral', symbol: '🏹', favoredOfferings: ['猎物', '草药'] },
      ],
      doctrines: ['力量即正义', '保护弱者', '荣誉高于生命'],
      rituals: [
        { id: 'ritual_battle_blessing', name: '战前祝福', purpose: '祈求战斗胜利', requiredItems: ['武器', '烈酒'], steps: ['献上武器', '饮下烈酒', '念诵祷词'], participantRoles: ['战士', '萨满'] },
      ],
      sacredItems: ['先祖战斧', '雷霆之石'],
      holyDays: [{ name: '风暴节', month: 3, day: 15, description: '纪念雷神的降临' }],
      fervor: 0.8,
    },
    values: ['荣誉', '忠诚', '勇气', '家族', '力量'],
    taboos: ['背叛氏族', '拒绝帮助求助者', '在神圣场所争斗'],
    etiquette: [
      { id: 'etq_guest_right', situation: '接待客人', expectedBehavior: '提供食物和庇护', violationConsequence: '被视为耻辱', importance: 'critical' },
      { id: 'etq_elder_respect', situation: '面对长者', expectedBehavior: '低头致意，先听后说', violationConsequence: '被斥为无礼', importance: 'important' },
    ],
  },
  arts: [
    { id: 'art_throat_singing', type: 'music', name: '喉音唱法', description: '模仿自然声音的古老唱法', notableWorks: ['风之歌', '战吼'] },
    { id: 'art_rune_carving', type: 'craft', name: '符文雕刻', description: '在骨头和石头上雕刻神秘符文', notableWorks: ['先祖骨牌', '守护石'] },
  ],
  traditionalAttire: '毛皮与皮革制成的保暖服装，佩戴氏族图腾饰品',
  cuisine: {
    stapleFoods: ['烤肉', '奶酪', '黑麦面包'],
    preferredFlavors: ['咸', '烟熏', '辛辣'],
    tabooIngredients: ['蛇肉', '腐肉'],
    traditionalDrinks: ['蜂蜜酒', '烈性麦酒'],
    diningEtiquette: ['主人先饮', '分享食物', '不浪费肉食'],
  },
  architectureStyle: '帐篷与木质结构，可移动，装饰以图腾柱',
  influence: 0.6,
  vitality: 0.75,
  homelandRegionId: 'region_northern_plains',
  spreadRegions: ['region_eastern_hills'],
};

export const SOUTHERN_CITY_CULTURE: Culture = {
  id: 'culture_southern_city',
  name: '南方城邦文化',
  description: '注重贸易与知识的城邦文明，讲究礼仪与法律。',
  dimensions: {
    individualism: 0.4,
    powerDistance: 0.2,
    uncertaintyAvoidance: 0.6,
    masculinity: -0.2,
    longTermOrientation: 0.7,
    indulgence: 0.3,
  },
  core: {
    language: {
      id: 'lang_southern',
      name: '南方通用语',
      family: '古商语系',
      greetings: ['愿知识照亮你', '贸易顺利'],
      profanity: ['骗子', '强盗'],
      honorifics: true,
      dialects: ['港口方言', '学者方言'],
    },
    religion: {
      id: 'religion_sun_moon',
      name: '日月教',
      deities: [
        { id: 'deity_sun', name: '太阳神索拉瑞斯', domain: ['光明', '正义'], alignment: 'benevolent', symbol: '☀️', favoredOfferings: ['黄金', '镜子'] },
        { id: 'deity_moon', name: '月神露娜', domain: ['智慧', '秘密'], alignment: 'neutral', symbol: '🌙', favoredOfferings: ['银器', '书籍'] },
      ],
      doctrines: ['知识即力量', '公平交易', '光明驱散黑暗'],
      rituals: [
        { id: 'ritual_market_blessing', name: '开市祝福', purpose: '祈求贸易繁荣', requiredItems: ['金币', '香料'], steps: ['献上贡品', '诵读商法', '敲响开市钟'], participantRoles: ['商人', '祭司'] },
      ],
      sacredItems: ['太阳圆盘', '月之卷轴'],
      holyDays: [{ name: '双至节', month: 6, day: 21, description: '太阳最高之日' }],
      fervor: 0.5,
    },
    values: ['知识', '贸易', '法律', '和平', '创新'],
    taboos: ['破坏契约', '偷窃', '公开暴力'],
    etiquette: [
      { id: 'etq_bargain_fair', situation: '商业谈判', expectedBehavior: '明码标价，不欺不瞒', violationConsequence: '被商会除名', importance: 'critical' },
      { id: 'etq_dress_code', situation: '正式场合', expectedBehavior: '穿着得体，佩戴身份标识', violationConsequence: '被视为粗俗', importance: 'important' },
    ],
  },
  arts: [
    { id: 'art_opera', type: 'theater', name: '城邦歌剧', description: '讲述历史与神话的音乐剧', notableWorks: ['太阳王的崛起', '月之低语'] },
    { id: 'art_mosaic', type: 'painting', name: '马赛克镶嵌', description: '用彩色石片拼贴图案', notableWorks: ['四季图', '港口全景'] },
  ],
  traditionalAttire: '丝绸与棉麻制成的精致服装，佩戴贸易公会徽章',
  cuisine: {
    stapleFoods: ['白面包', '橄榄油', '海鲜', '葡萄酒'],
    preferredFlavors: ['酸', '甜', '鲜'],
    tabooIngredients: ['人肉', '有毒蘑菇'],
    traditionalDrinks: ['葡萄酒', '柑橘汁', '茶'],
    diningEtiquette: ['等主人邀请', '使用正确餐具', '不谈论生意'],
  },
  architectureStyle: '石质结构，拱门与圆顶，装饰以马赛克',
  influence: 0.8,
  vitality: 0.9,
  homelandRegionId: 'region_southern_coast',
  spreadRegions: ['region_western_isles', 'region_central_plains'],
};
```

#### 实施文件清单

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `packages/shared-types/src/culture.ts` | 文化类型定义 | P0 |
| `packages/shared-types/src/culture-presets.ts` | 文化预设数据 | P0 |
| `packages/core/src/engine/culture-manager.ts` | 文化管理器 | P0 |
| `packages/core/src/engine/culture-evolution.ts` | 文化演化引擎 | P1 |

#### 文化管理器接口

```typescript
// packages/core/src/engine/culture-manager.ts

export class CultureManager {
  /** 注册文化 */
  registerCulture(culture: Culture): void;

  /** 获取地区主导文化 */
  getDominantCulture(regionId: string): Culture | undefined;

  /** 获取文化的社交规则 */
  getSocialRules(cultureId: string, situation: string): EtiquetteRule[];

  /** 检查行为是否违反文化禁忌 */
  checkTaboo(cultureId: string, action: string): { violated: boolean; taboos: string[]; consequence: string };

  /** 获取文化对 NPC 对话风格的影响 */
  getDialogueStyle(cultureId: string): { greetings: string[]; honorifics: boolean; speechPatterns: string[] };

  /** 文化影响力传播 */
  spreadCulture(fromRegionId: string, toRegionId: string, amount: number): void;

  /** 文化融合（当两种文化相遇时） */
  fuseCultures(cultureAId: string, cultureBId: string): Culture | null;

  /** 文化冲突检测 */
  detectCulturalConflict(cultureAId: string, cultureBId: string): { conflict: boolean; points: string[] };
}
```

---

## 四、Phase 3: 生物活动层 — 生物类型扩展

### 4.1 生物类型体系 (Creature Type System)

#### 目标
将 NPC 系统扩展为通用生物系统，支持人类、动物、怪物、神话生物。

#### 核心类型定义

```typescript
// packages/shared-types/src/creature.ts

/** 生物大类 */
export type CreatureCategory = 'humanoid' | 'animal' | 'monster' | 'mythical' | 'undead' | 'construct';

/** 生物类型 */
export type CreatureType =
  // 人形
  | 'human' | 'elf' | 'dwarf' | 'orc' | 'goblin' | 'halfling'
  // 动物
  | 'wolf' | 'bear' | 'deer' | 'rabbit' | 'eagle' | 'snake' | 'horse'
  // 怪物
  | 'goblin_raider' | 'orc_warrior' | 'troll' | 'giant_spider' | 'slime'
  // 神话
  | 'dragon' | 'phoenix' | 'unicorn' | 'griffin'
  // 亡灵
  | 'skeleton' | 'zombie' | 'ghost' | 'vampire'
  // 构装
  | 'golem' | 'automation';

/** 生物阵营 */
export type CreatureAlignment =
  | 'hostile'      // 主动攻击
  | 'predatory'    // 捕食性（饿了就攻击）
  | 'territorial'  // 领地性（进入领地攻击）
  | 'neutral'      // 中立
  | 'cautious'     // 谨慎（保持距离）
  | 'friendly'     // 友善
  | 'domesticated'; // 驯化

/** 生物行为模式 */
export interface BehaviorPattern {
  /** 活动时间 */
  activityCycle: 'diurnal' | 'nocturnal' | 'crepuscular' | 'continuous';
  /** 社会结构 */
  socialStructure: 'solitary' | 'pair' | 'pack' | 'herd' | 'colony' | 'hive';
  /** 食性 */
  diet: 'herbivore' | 'carnivore' | 'omnivore' | 'none';
  /** 领地范围 */
  territorySize: number;
  /** 迁徙模式 */
  migrationPattern?: 'seasonal' | 'random' | 'none';
  /** 恐惧源 */
  fears: string[];
  /** 吸引源 */
  attractions: string[];
}

/** 生物能力 */
export interface CreatureAbility {
  id: string;
  name: string;
  description: string;
  type: 'physical' | 'magical' | 'sensory' | 'social';
  /** 触发条件 */
  trigger: string;
  /** 效果 */
  effect: string;
  /** 冷却（回合） */
  cooldown: number;
}

/** 生物生态位 */
export interface EcologicalNiche {
  /** 偏好的地形 */
  preferredTerrains: TerrainType[];
  /** 避免的地形 */
  avoidedTerrains: TerrainType[];
  /** 气候偏好 */
  preferredClimate: ClimateType;
  /** 需要的资源 */
  requiredResources: ResourceType[];
  /** 天敌 */
  predators: CreatureType[];
  /** 猎物 */
  prey: CreatureType[];
}

/** 生物实例（替代/扩展 NPCState） */
export interface Creature {
  id: string;
  name: string;
  category: CreatureCategory;
  type: CreatureType;
  /** 显示名称 */
  displayName: string;
  description: string;

  // 状态
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  mood: string;

  // 行为
  alignment: CreatureAlignment;
  behavior: BehaviorPattern;
  abilities: CreatureAbility[];

  // 生态
  niche: EcologicalNiche;

  // 位置
  currentLocationId: string;
  currentSpaceId?: string;

  // 关系（对其他生物）
  relationships: Map<string, { targetId: string; disposition: number; history: string[] }>;

  // 记忆
  memories: string[];

  // 驯化相关
  domestication?: {
    ownerId: string;
    loyalty: number;
    trainedCommands: string[];
  };
}
```

#### 生物预设：狼群

```typescript
// packages/shared-types/src/creature-presets.ts

export const WOLF_CREATURE: Creature = {
  id: 'creature_wolf',
  name: '灰狼',
  category: 'animal',
  type: 'wolf',
  displayName: '灰狼',
  description: '一只毛色灰白的野狼，眼神警惕而锐利。',
  health: 40,
  maxHealth: 40,
  stamina: 60,
  maxStamina: 60,
  mood: 'alert',
  alignment: 'predatory',
  behavior: {
    activityCycle: 'nocturnal',
    socialStructure: 'pack',
    diet: 'carnivore',
    territorySize: 5,
    migrationPattern: 'none',
    fears: ['火', '巨大声响'],
    attractions: ['血腥味', '肉类'],
  },
  abilities: [
    { id: 'ability_pack_howl', name: '狼嚎', description: '召唤附近的狼群成员', type: 'social', trigger: '发现猎物或威胁', effect: '吸引同区域其他狼', cooldown: 3 },
    { id: 'ability_sprint', name: '疾奔', description: '短距离高速冲刺', type: 'physical', trigger: '追逐猎物', effect: '移动速度翻倍', cooldown: 5 },
  ],
  niche: {
    preferredTerrains: ['forest', 'hill', 'plains'],
    avoidedTerrains: ['desert', 'swamp'],
    preferredClimate: 'temperate',
    requiredResources: ['food', 'water'],
    predators: ['bear', 'troll'],
    prey: ['deer', 'rabbit'],
  },
  currentLocationId: 'location_forest_north',
  relationships: new Map(),
  memories: [],
};

export const GOBLIN_RAIDER_CREATURE: Creature = {
  id: 'creature_goblin_raider',
  name: '哥布林掠夺者',
  category: 'monster',
  type: 'goblin_raider',
  displayName: '哥布林',
  description: '一个瘦小的绿色生物，手持生锈的匕首，眼中闪烁着贪婪。',
  health: 25,
  maxHealth: 25,
  stamina: 40,
  maxStamina: 40,
  mood: 'aggressive',
  alignment: 'hostile',
  behavior: {
    activityCycle: 'nocturnal',
    socialStructure: 'pack',
    diet: 'omnivore',
    territorySize: 3,
    migrationPattern: 'random',
    fears: ['高大的人类', '魔法火焰'],
    attractions: ['闪亮物品', '食物'],
  },
  abilities: [
    { id: 'ability_swarm', name: ' swarm战术', description: '多个哥布林同时攻击', type: 'social', trigger: '数量优势', effect: '攻击获得加成', cooldown: 0 },
    { id: 'ability_sneak', name: '潜行', description: '在阴影中隐藏', type: 'physical', trigger: '夜间或阴影处', effect: '难以被发现', cooldown: 2 },
  ],
  niche: {
    preferredTerrains: ['cave', 'ruins', 'forest'],
    avoidedTerrains: ['mountain', 'desert'],
    preferredClimate: 'temperate',
    requiredResources: ['food'],
    predators: ['human', 'orc'],
    prey: ['rabbit', 'human'],
  },
  currentLocationId: 'location_cave_east',
  relationships: new Map(),
  memories: [],
};
```

#### 实施文件清单

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `packages/shared-types/src/creature.ts` | 生物类型定义 | P0 |
| `packages/shared-types/src/creature-presets.ts` | 生物预设数据 | P0 |
| `packages/core/src/engine/creature-manager.ts` | 生物管理器 | P0 |
| `packages/core/src/engine/ecosystem-simulator.ts` | 生态模拟器 | P1 |

#### 生物管理器接口

```typescript
// packages/core/src/engine/creature-manager.ts

export class CreatureManager {
  /** 注册生物 */
  registerCreature(creature: Creature): void;

  /** 获取区域内的生物 */
  getCreaturesInLocation(locationId: string): Creature[];

  /** 获取空间内的生物 */
  getCreaturesInSpace(spaceId: string): Creature[];

  /** 生物移动 */
  moveCreature(creatureId: string, targetLocationId: string): boolean;

  /** 生物AI决策 */
  decideAction(creatureId: string): CreatureAction;

  /** 生物间交互 */
  interact(creatureAId: string, creatureBId: string, interactionType: string): InteractionResult;

  /** 驯化生物 */
  domesticate(creatureId: string, ownerId: string): boolean;

  /** 生成生态报告 */
  generateEcologyReport(locationId: string): EcologyReport;
}
```

---

## 五、Phase 4: 事件系统 — 因果链扩展

### 5.1 事件图谱 (Event Graph)

#### 目标
将事件从简单的通知升级为可追溯因果关系的图谱，支持连锁反应和历史查询。

#### 核心类型定义

```typescript
// packages/shared-types/src/event-graph.ts

/** 事件节点 */
export interface EventNode {
  id: string;
  type: string;
  /** 事件描述 */
  description: string;
  /** 触发时间 */
  timestamp: number;
  /** 触发者 */
  actorId?: string;
  /** 目标 */
  targetId?: string;
  /** 发生地点 */
  locationId?: string;
  /** 因果权重 (0-1) */
  causalWeight: number;
  /** 是否为玩家触发 */
  playerInitiated: boolean;
  /** 事件数据 */
  payload: Record<string, unknown>;
}

/** 因果边 */
export interface CausalEdge {
  id: string;
  /** 原因事件 */
  causeEventId: string;
  /** 结果事件 */
  effectEventId: string;
  /** 因果关系类型 */
  type: 'direct' | 'indirect' | 'enabling' | 'preventing';
  /** 因果强度 (0-1) */
  strength: number;
  /** 时间延迟（毫秒） */
  timeDelay: number;
  /** 因果描述 */
  description: string;
}

/** 事件链 */
export interface EventChain {
  id: string;
  name: string;
  description: string;
  /** 链中的事件 */
  events: string[]; // EventNode IDs
  /** 链状态 */
  status: 'active' | 'resolved' | 'dormant';
  /** 触发条件 */
  triggerCondition: string;
  /** 预期结果 */
  expectedOutcome: string;
}

/** 历史查询 */
export interface HistoryQuery {
  /** 时间范围 */
  timeRange?: { start: number; end: number };
  /** 地点过滤 */
  locationIds?: string[];
  /** 角色过滤 */
  actorIds?: string[];
  /** 事件类型过滤 */
  eventTypes?: string[];
  /** 因果深度 */
  causalDepth?: number;
  /** 关键词搜索 */
  keywords?: string[];
}
```

#### 事件图谱管理器

```typescript
// packages/core/src/engine/event-graph.ts

export class EventGraph {
  private nodes: Map<string, EventNode> = new Map();
  private edges: Map<string, CausalEdge> = new Map();
  private chains: Map<string, EventChain> = new Map();

  /** 记录事件 */
  recordEvent(event: Omit<EventNode, 'id'>): EventNode;

  /** 建立因果关系 */
  linkCausality(causeEventId: string, effectEventId: string, type: CausalEdge['type'], strength: number): CausalEdge;

  /** 查找事件的原因链 */
  findCauses(eventId: string, depth: number): EventNode[];

  /** 查找事件的结果链 */
  findEffects(eventId: string, depth: number): EventNode[];

  /** 查询历史 */
  queryHistory(query: HistoryQuery): EventNode[];

  /** 检测连锁反应 */
  detectChainReaction(eventId: string): EventChain | null;

  /** 生成事件摘要 */
  generateEventSummary(eventId: string): string;

  /** 生成历史叙事 */
  generateHistoryNarrative(query: HistoryQuery): string;
}
```

#### 与现有 EventBus 集成

```typescript
// packages/core/src/engine/event-bus-enhanced.ts

export class EnhancedEventBus extends EventBus {
  private eventGraph: EventGraph;

  constructor() {
    super();
    this.eventGraph = new EventGraph();
  }

  override emit(type: string, payload: Record<string, unknown>, source: string): void {
    // 1. 调用父类发布事件
    super.emit(type, payload, source);

    // 2. 记录到事件图谱
    const event = this.eventGraph.recordEvent({
      type,
      description: this.generateEventDescription(type, payload),
      timestamp: Date.now(),
      actorId: payload.actorId as string,
      targetId: payload.targetId as string,
      locationId: payload.locationId as string,
      causalWeight: payload.causalWeight as number || 0.5,
      playerInitiated: source === 'player',
      payload,
    });

    // 3. 检测并建立因果关系
    this.inferCausality(event);

    // 4. 检测连锁反应
    const chain = this.eventGraph.detectChainReaction(event.id);
    if (chain && chain.status === 'active') {
      this.emit('chain:triggered', { chainId: chain.id, chainName: chain.name }, 'system');
    }
  }

  /** 推断因果关系 */
  private inferCausality(event: EventNode): void {
    // 查找最近的相关事件
    const recentEvents = this.eventGraph.queryHistory({
      timeRange: { start: event.timestamp - 60000, end: event.timestamp },
      locationIds: event.locationId ? [event.locationId] : undefined,
      actorIds: event.actorId ? [event.actorId] : undefined,
    });

    for (const recent of recentEvents) {
      if (recent.id === event.id) continue;
      // 简单的因果推断：同地点、同角色、时间接近
      const strength = this.calculateCausalStrength(recent, event);
      if (strength > 0.6) {
        this.eventGraph.linkCausality(recent.id, event.id, 'direct', strength);
      }
    }
  }

  /** 获取事件历史 */
  getEventHistory(query: HistoryQuery): EventNode[] {
    return this.eventGraph.queryHistory(query);
  }
}
```

---

## 六、实施路线图

### Phase 1: 世界物质层 (预计 3-4 周)

| 周次 | 任务 | 产出 |
|------|------|------|
| W1 | 地形类型定义 + 预设数据 | `terrain.ts`, `terrain-presets.ts` |
| W1 | 建筑类型定义 + 酒馆扩展示例 | `architecture.ts`, `building-presets.ts` |
| W2 | 地形管理器实现 | `terrain-manager.ts` |
| W2 | 空间管理器实现 | `space-manager.ts` |
| W3 | 集成到 SceneManager | 场景切换支持地形/空间 |
| W3 | 集成到 Narrator | 叙事中自动描述地形/建筑 |
| W4 | 测试 + 文档 | 单元测试、集成测试 |

### Phase 2: 文明层 (预计 2-3 周)

| 周次 | 任务 | 产出 |
|------|------|------|
| W1 | 文化类型定义 + 预设数据 | `culture.ts`, `culture-presets.ts` |
| W1 | 文化管理器实现 | `culture-manager.ts` |
| W2 | 集成到 NPC-Director | NPC 对话受文化影响 |
| W2 | 集成到 World-Keeper | 文化一致性检查 |
| W3 | 文化冲突检测 + 测试 | `culture-manager.test.ts` |

### Phase 3: 生物活动层 (预计 2-3 周)

| 周次 | 任务 | 产出 |
|------|------|------|
| W1 | 生物类型定义 + 预设数据 | `creature.ts`, `creature-presets.ts` |
| W1 | 生物管理器实现 | `creature-manager.ts` |
| W2 | 生态模拟器（基础） | `ecosystem-simulator.ts` |
| W2 | 集成到 NPC-Director | 支持动物/怪物 NPC |
| W3 | 测试 + 平衡调整 | 单元测试 |

### Phase 4: 事件因果链 (预计 2 周)

| 周次 | 任务 | 产出 |
|------|------|------|
| W1 | 事件图谱类型定义 | `event-graph.ts` |
| W1 | 事件图谱管理器 | `event-graph.ts` |
| W2 | 增强 EventBus | `event-bus-enhanced.ts` |
| W2 | 集成到 GameEngine | 历史查询 API |

### 依赖关系图

```
地形系统 ──┬──→ 建筑系统 ──┬──→ 生物系统
           │               │
           └──→ 文化系统 ←──┘
           │
           └──→ 事件因果链
```

---

## 七、集成点说明

### 7.1 与现有 SceneState 集成

扩展现有 `SceneState`：

```typescript
// packages/shared-types/src/scene.ts (扩展)

export interface SceneState {
  // ... 现有字段 ...

  /** 当前地形 */
  currentTerrain?: TerrainType;

  /** 当前建筑/空间 */
  currentSpaceId?: string;

  /** 当前建筑ID */
  currentBuildingId?: string;

  /** 区域文化 */
  regionCultureId?: string;

  /** 在场生物（替代 presentNPCs） */
  presentCreatures: Creature[];
}
```

### 7.2 与现有事件系统集成

增强 `GameEvents`：

```typescript
// packages/core/src/engine/event-bus.ts (扩展)

export const GameEvents = {
  // ... 现有事件 ...

  // 地形事件
  TERRAIN_ENTER: 'terrain:enter',
  TERRAIN_EXIT: 'terrain:exit',
  RESOURCE_DISCOVERED: 'resource:discovered',

  // 建筑事件
  SPACE_ENTER: 'space:enter',
  SPACE_EXIT: 'space:exit',
  DOOR_UNLOCKED: 'door:unlocked',
  HIDDEN_REVEALED: 'hidden:revealed',

  // 文化事件
  CULTURE_ENCOUNTER: 'culture:encounter',
  TABOO_VIOLATED: 'taboo:violated',
  RITUAL_PERFORMED: 'ritual:performed',

  // 生物事件
  CREATURE_SPAWN: 'creature:spawn',
  CREATURE_DEATH: 'creature:death',
  CREATURE_DOMESTICATED: 'creature:domesticated',

  // 连锁事件
  CHAIN_TRIGGERED: 'chain:triggered',
  CHAIN_RESOLVED: 'chain:resolved',
};
```

### 7.3 与现有代理系统集成

增强各代理的 system prompt：

- **World-Keeper**: 增加地形规则、文化禁忌、建筑结构一致性检查
- **NPC-Director**: 增加生物行为模式、文化礼仪、领地意识
- **Narrator**: 增加地形描述、建筑空间描述、文化氛围渲染
- **Rule-Arbiter**: 增加地形战斗修正、文化冲突判定

---

## 八、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 类型定义过于复杂 | 开发效率降低 | 分阶段实施，先核心后扩展 |
| 与现有代码冲突 | 回归问题 | 充分测试，保持向后兼容 |
| AI 上下文过长 | Token 消耗增加 | 智能上下文裁剪，渐进式披露 |
| 性能问题 | 响应延迟 | 缓存、异步加载、Rust 迁移 |

---

## 九、成功标准

1. **地形系统**: 叙事中自动体现地形影响（移动消耗、战斗修正、资源发现）
2. **建筑系统**: 支持多层建筑探索，隐藏通道发现，空间连通性
3. **文化系统**: NPC 行为受文化影响，文化冲突可被检测和叙事化
4. **生物系统**: 动物/怪物有独立 AI，生态关系可模拟
5. **事件系统**: 可追溯事件因果链，支持「为什么会这样」查询

---

*计划制定时间: 2026-04-29*
*版本: 1.0*
*状态: 待评审*
