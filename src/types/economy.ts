/**
 * 经济系统类型定义
 * 用于实现酒馆中的货币、商品和交易系统
 */

/** 商品类型 */
export type ItemType = 'drink' | 'food' | 'misc' | 'service';

/** 商品 */
export interface Item {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 商品类型 */
  type: ItemType;
  /** 价格 */
  price: number;
  /** 库存数量（-1表示无限） */
  stock: number;
  /** 是否可购买 */
  buyable: boolean;
  /** 是否可出售 */
  sellable: boolean;
  /** 效果（如恢复生命值等） */
  effects?: {
    type: 'heal' | 'mana' | 'stamina' | 'mood';
    value: number;
  }[];
  /** 图标 */
  icon?: string;
}

/** 交易记录 */
export interface Transaction {
  /** 交易ID */
  id: string;
  /** 交易类型 */
  type: 'buy' | 'sell' | 'tip' | 'game_win' | 'game_loss';
  /** 交易金额 */
  amount: number;
  /** 涉及的商品 */
  itemId?: string;
  /** 交易描述 */
  description: string;
  /** 交易时间 */
  timestamp: number;
  /** 交易参与者 */
  participants: {
    from: string;
    to: string;
  };
}

/** 商店 */
export interface Shop {
  /** 商店ID */
  id: string;
  /** 商店名称 */
  name: string;
  /** 商店描述 */
  description: string;
  /** 商品列表 */
  items: Item[];
  /** 营业时间 */
  openHours: {
    start: number;
    end: number;
  };
  /** 店主ID */
  ownerId?: string;
}

/** 经济系统配置 */
export interface EconomyConfig {
  /** 初始金币 */
  startingGold: number;
  /** 最大金币 */
  maxGold: number;
  /** 小费最小金额 */
  minTip: number;
  /** 小费最大金额 */
  maxTip: number;
  /** 交易税率 */
  taxRate: number;
  /** 是否启用交易日志 */
  enableTransactionLog: boolean;
}

/** 经济统计 */
export interface EconomyStats {
  /** 总交易次数 */
  totalTransactions: number;
  /** 总交易金额 */
  totalVolume: number;
  /** 购买次数 */
  buyCount: number;
  /** 出售次数 */
  sellCount: number;
  /** 小费总额 */
  totalTips: number;
  /** 游戏输赢总额 */
  gameNetGold: number;
}

/** 预定义的酒馆商品 */
export const TAVERN_ITEMS: Item[] = [
  {
    id: 'ale',
    name: '麦酒',
    description: '酒馆招牌麦酒，醇厚香甜',
    type: 'drink',
    price: 5,
    stock: -1,
    buyable: true,
    sellable: false,
    effects: [{ type: 'mood', value: 5 }],
    icon: '🍺',
  },
  {
    id: 'wine',
    name: '红酒',
    description: '来自南方葡萄园的上等红酒',
    type: 'drink',
    price: 15,
    stock: -1,
    buyable: true,
    sellable: false,
    effects: [{ type: 'mood', value: 10 }],
    icon: '🍷',
  },
  {
    id: 'whiskey',
    name: '威士忌',
    description: '烈性酒，适合豪爽的客人',
    type: 'drink',
    price: 25,
    stock: 20,
    buyable: true,
    sellable: false,
    effects: [{ type: 'mood', value: 15 }],
    icon: '🥃',
  },
  {
    id: 'stew',
    name: '炖肉',
    description: '热腾腾的炖肉，能恢复体力',
    type: 'food',
    price: 12,
    stock: -1,
    buyable: true,
    sellable: false,
    effects: [
      { type: 'heal', value: 20 },
      { type: 'stamina', value: 10 },
    ],
    icon: '🍲',
  },
  {
    id: 'bread',
    name: '面包',
    description: '新鲜出炉的面包',
    type: 'food',
    price: 3,
    stock: -1,
    buyable: true,
    sellable: false,
    effects: [{ type: 'heal', value: 10 }],
    icon: '🍞',
  },
  {
    id: 'room',
    name: '客房住宿',
    description: '在酒馆过夜，恢复全部状态',
    type: 'service',
    price: 50,
    stock: -1,
    buyable: true,
    sellable: false,
    effects: [
      { type: 'heal', value: 100 },
      { type: 'mana', value: 100 },
      { type: 'stamina', value: 100 },
    ],
    icon: '🛏️',
  },
];

/** 默认经济配置 */
export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  startingGold: 100,
  maxGold: 99999,
  minTip: 1,
  maxTip: 100,
  taxRate: 0,
  enableTransactionLog: true,
};
