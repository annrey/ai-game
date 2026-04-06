/**
 * 迷你游戏类型定义
 * 用于实现酒馆中的小游戏系统
 */

/** 游戏事件 */
export interface GameEvent {
  /** 事件类型 */
  type: string;
  /** 事件数据 */
  payload: Record<string, unknown>;
  /** 时间戳 */
  timestamp: number;
  /** 事件来源 */
  source: 'engine' | 'agent' | 'player' | 'system' | 'world-keeper';
}

/** 游戏类型 */
export type GameType = 'dice' | 'card' | 'guessing';

/** 游戏状态 */
export type GameState = 'waiting' | 'playing' | 'finished' | 'cancelled';

/** 游戏结果 */
export type GameResult = 'win' | 'lose' | 'draw' | 'pending';

/** 基础游戏接口 */
export interface MiniGame {
  /** 游戏ID */
  id: string;
  /** 游戏类型 */
  type: GameType;
  /** 游戏名称 */
  name: string;
  /** 游戏描述 */
  description: string;
  /** 游戏状态 */
  state: GameState;
  /** 游戏结果 */
  result: GameResult;
  /** 参与者ID列表 */
  participants: string[];
  /** 赌注/奖励 */
  bet: number;
  /** 创建时间 */
  createdAt: number;
  /** 结束时间 */
  endedAt?: number;
}

/** 骰子游戏 */
export interface DiceGame extends MiniGame {
  type: 'dice';
  /** 骰子数量 */
  diceCount: number;
  /** 骰子面数 */
  diceSides: number;
  /** 玩家骰子结果 */
  playerRolls: number[];
  /** NPC骰子结果 */
  npcRolls: number[];
  /** 游戏模式 */
  mode: 'higher' | 'lower' | 'exact' | 'sum';
  /** 目标值（用于exact模式） */
  targetValue?: number;
  /** 当前轮次 */
  currentRound: number;
  /** 最大轮次 */
  maxRounds: number;
}

/** 骰子游戏配置 */
export interface DiceGameConfig {
  /** 默认骰子数量 */
  defaultDiceCount: number;
  /** 默认骰子面数 */
  defaultDiceSides: number;
  /** 最小赌注 */
  minBet: number;
  /** 最大赌注 */
  maxBet: number;
  /** 是否允许多轮 */
  allowMultipleRounds: boolean;
  /** 默认最大轮次 */
  defaultMaxRounds: number;
}

/** 游戏动作 */
export interface GameAction {
  /** 动作ID */
  id: string;
  /** 游戏ID */
  gameId: string;
  /** 玩家ID */
  playerId: string;
  /** 动作类型 */
  type: 'roll' | 'bet' | 'fold' | 'raise' | 'call';
  /** 动作数据 */
  data: Record<string, unknown>;
  /** 动作时间 */
  timestamp: number;
}

/** 游戏历史记录 */
export interface GameHistory {
  /** 记录ID */
  id: string;
  /** 游戏类型 */
  gameType: GameType;
  /** 参与者 */
  participants: string[];
  /** 结果 */
  result: GameResult;
  /** 金币变化 */
  goldChange: Record<string, number>;
  /** 游戏时间 */
  playedAt: number;
  /** 游戏时长（毫秒） */
  duration: number;
}

/** 游戏管理器配置 */
export interface GameManagerConfig {
  /** 是否启用游戏 */
  enabled: boolean;
  /** 默认赌注 */
  defaultBet: number;
  /** 游戏冷却时间（毫秒） */
  cooldownTime: number;
  /** 最大同时进行的游戏数 */
  maxConcurrentGames: number;
  /** 是否记录游戏历史 */
  enableHistory: boolean;
}

/** 骰子游戏结果 */
export interface DiceRollResult {
  /** 骰子值列表 */
  values: number[];
  /** 总和 */
  sum: number;
  /** 是否暴击（所有骰子最大值） */
  isCritical: boolean;
  /** 是否大失败（所有骰子最小值） */
  isFumble: boolean;
}

/** 预定义的骰子游戏配置 */
export const DEFAULT_DICE_GAME_CONFIG: DiceGameConfig = {
  defaultDiceCount: 2,
  defaultDiceSides: 6,
  minBet: 1,
  maxBet: 100,
  allowMultipleRounds: true,
  defaultMaxRounds: 3,
};

/** 游戏配置（用于游戏引擎） */
export interface GameConfig {
  /** 游戏模式 */
  mode: 'text-adventure' | 'chat-roleplay' | 'npc-sandbox' | 'ai-battle';
  /** 游戏主题 */
  theme: string;
  /** 是否启用战斗系统 */
  enableCombat: boolean;
  /** 是否启用存档 */
  enableSave: boolean;
  /** 最大回合数 */
  maxTurns: number;
  /** 难度级别 */
  difficulty: 'easy' | 'normal' | 'hard';
  /** 记忆最大上下文字符数 */
  memoryMaxContextChars: number;
  /** 自动世界时间推进 */
  autoWorldTick: boolean;
  /** 空闲超时时间 */
  idleTimeout: number;
  /** 启用的代理 */
  enabledAgents: string[];
  /** 最大历史回合数 */
  maxHistoryTurns: number;
  /** 日志配置 */
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  /** 自动保存间隔 */
  autoSaveInterval: number;
}

/** 游戏结果文本 */
export function getGameResultText(result: GameResult): string {
  const texts: Record<GameResult, string> = {
    win: '胜利',
    lose: '失败',
    draw: '平局',
    pending: '进行中',
  };
  return texts[result];
}

/** 游戏状态文本 */
export function getGameStateText(state: GameState): string {
  const texts: Record<GameState, string> = {
    waiting: '等待中',
    playing: '进行中',
    finished: '已结束',
    cancelled: '已取消',
  };
  return texts[state];
}

/** 游戏模式 */
export type GameMode = 'text-adventure' | 'chat-roleplay' | 'npc-sandbox' | 'ai-battle';

/** 游戏模式名称 */
export const GameModeNames: Record<GameMode, string> = {
  'text-adventure': '文字冒险',
  'chat-roleplay': '角色扮演',
  'npc-sandbox': 'NPC沙盒',
  'ai-battle': 'AI对战',
};

/** 存档数据 */
export interface SaveData {
  /** 存档ID */
  id: string;
  /** 存档名称 */
  name: string;
  /** 游戏模式 */
  mode: GameMode;
  /** 场景状态 */
  sceneState: import('./scene.js').SceneState;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 历史记录 */
  history: import('./scene.js').Action[];
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/** 成就类型 */
export type AchievementType = 'story' | 'exploration' | 'combat' | 'social' | 'collection' | 'special';

/** 成就 */
export interface Achievement {
  /** 成就ID */
  id: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 成就类型 */
  type: AchievementType;
  /** 图标 */
  icon: string;
  /** 是否已解锁 */
  unlocked?: boolean;
  /** 解锁时间 */
  unlockedAt?: string;
  /** 进度（用于渐进式成就） */
  progress?: number;
  /** 最大进度 */
  maxProgress?: number;
  /** 是否隐藏成就 */
  secret?: boolean;
}
