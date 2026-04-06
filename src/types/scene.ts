/**
 * 场景状态类型定义
 */

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
  period: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';
}

export interface EnvironmentState {
  weather: string;
  lighting: string;
  ambiance: string;
  hazards: string[];
}

export interface NPCState {
  id: string;
  name: string;
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown';
  currentActivity: string;
  health?: number;
  mood?: string;
}

export interface Action {
  id: string;
  actor: string;
  type: 'move' | 'talk' | 'combat' | 'use' | 'examine' | 'custom';
  description: string;
  target?: string;
  timestamp: number;
}

export interface Resolution {
  actionId: string;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  description: string;
  effects: string[];
}

export interface PlotPoint {
  id: string;
  name: string;
  status: 'hidden' | 'foreshadowed' | 'active' | 'resolved';
  description: string;
}

export interface Quest {
  id: string;
  questId: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  objectives?: string[];
}

export interface PlayerState {
  name: string;
  role?: string;
  background?: string;
  worldName?: string;
  genre?: string;
  tone?: string;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  /** 金币数量 */
  gold: number;
  visitedLocations: string[];
  explorationProgress: number;
  inventory: Array<{
    id: string;
    name: string;
    description?: string;
    quantity: number;
    type: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc';
  }>;
  quests: Quest[];
  [key: string]: unknown;
}

/**
 * 核心场景状态 — 所有代理共享
 */
export interface SceneState {
  /** 当前位置 */
  currentLocation: string;
  /** 位置描述 */
  locationDescription: string;
  /** 在场 NPC */
  presentNPCs: NPCState[];
  /** 活跃剧情线 */
  activePlots: PlotPoint[];
  /** 玩家最近行动 */
  playerActions: Action[];
  /** 待解决事项 */
  pendingResolutions: Resolution[];
  /** 游戏内时间 */
  worldTime: GameTime;
  /** 环境状态 */
  environment: EnvironmentState;
  /** 玩家背包/状态 */
  playerState: PlayerState;
}
