/**
 * 游戏常量定义
 * 集中管理所有魔法数字，便于维护和调整
 */

// ============ 时间相关常量 ============
export const TIME = {
  /** 每回合推进的游戏时间（分钟） */
  ADVANCE_PER_TURN: 30,
  /** 闲置状态额外推进时间（分钟） */
  IDLE_EXTRA_MINUTES: 10,
  /** 回合间隔（每 N 回合推进时间） */
  TURN_INTERVAL: 5,
  /** 一天的总分钟数 */
  MINUTES_PER_DAY: 24 * 60,
  /** 一小时的总分钟数 */
  MINUTES_PER_HOUR: 60,
} as const;

// ============ 记忆相关常量 ============
export const MEMORY = {
  /** 记忆摘要最大长度（字符） */
  SUMMARY_MAX_LENGTH: 200,
  /** 默认上下文记忆字符预算 */
  DEFAULT_CONTEXT_CHARS: 2000,
  /** 记忆上下文字符预算最小值 */
  MIN_CONTEXT_CHARS: 200,
  /** 记忆上下文字符预算最大值 */
  MAX_CONTEXT_CHARS: 20000,
} as const;

// ============ 历史记录相关常量 ============
export const HISTORY = {
  /** 默认最大历史回合数 */
  DEFAULT_MAX_TURNS: 30,
  /** 代理历史记录最大条数 */
  AGENT_MAX_HISTORY: 20,
  /** 代理历史记录上限（回合数） */
  AGENT_MAX_HISTORY_TURNS: 200,
  /** 保留的最近行动数 */
  RECENT_ACTIONS_COUNT: 3,
} as const;

// ============ 限制相关常量 ============
export const LIMITS = {
  /** 存档列表默认限制 */
  SAVES_LIST_DEFAULT: 50,
  /** 存档列表最大限制 */
  SAVES_LIST_MAX: 200,
  /** 存档列表文件扫描上限 */
  SAVES_FILE_SCAN_MAX: 500,
  /** 叙事字数限制 - 最小值 */
  NARRATIVE_MIN_WORDS: 200,
  /** 叙事字数限制 - 最大值 */
  NARRATIVE_MAX_WORDS: 400,
  /** 字符串最大长度 - 短 */
  STRING_SHORT: 100,
  /** 字符串最大长度 - 中 */
  STRING_MEDIUM: 200,
  /** 字符串最大长度 - 长 */
  STRING_LONG: 500,
  /** 规则书最大长度 */
  RULEBOOK_MAX_LENGTH: 200000,
  /** 预览生成提示词最大长度 */
  PREVIEW_PROMPT_MAX: 500,
  /** 最大历史回合配置最小值 */
  MAX_HISTORY_TURNS_MIN: 1,
  /** 最大历史回合配置最大值 */
  MAX_HISTORY_TURNS_MAX: 200,
  /** 自动存档间隔最大值 */
  AUTO_SAVE_INTERVAL_MAX: 100,
  /** 记忆搜索结果限制 */
  MEMORY_SEARCH_LIMIT: 20,
  /** 记忆列表默认限制 */
  MEMORY_LIST_DEFAULT: 50,
} as const;

// ============ 服务器相关常量 ============
export const SERVER = {
  /** 默认端口 */
  DEFAULT_PORT: 3000,
  /** 执行命令最大缓冲区（字节） */
  EXEC_MAX_BUFFER: 1024 * 1024 * 8,
} as const;

// ============ 游戏数值相关常量 ============
export const GAME = {
  /** 玩家默认生命值 */
  DEFAULT_HEALTH: 100,
  /** 玩家默认最大生命值 */
  DEFAULT_MAX_HEALTH: 100,
  /** 玩家默认法力值 */
  DEFAULT_MANA: 50,
  /** 玩家默认最大法力值 */
  DEFAULT_MAX_MANA: 50,
  /** 玩家默认体力值 */
  DEFAULT_STAMINA: 100,
  /** 玩家默认最大体力值 */
  DEFAULT_MAX_STAMINA: 100,
  /** 默认探索进度 */
  DEFAULT_EXPLORATION_PROGRESS: 0,
  /** 默认游戏时间 - 天数 */
  DEFAULT_DAY: 1,
  /** 默认游戏时间 - 小时 */
  DEFAULT_HOUR: 8,
  /** 默认游戏时间 - 分钟 */
  DEFAULT_MINUTE: 0,
  /** 重要性评估 - 基础值 */
  IMPORTANCE_BASE: 0.4,
  /** 重要性评估 - 高 */
  IMPORTANCE_HIGH: 0.8,
  /** 重要性评估 - 中 */
  IMPORTANCE_MEDIUM: 0.6,
} as const;

// ============ 时间段定义常量 ============
export const TIME_PERIODS = {
  /** 黎明 */
  DAWN: { start: 5, end: 7, name: 'dawn' },
  /** 上午 */
  MORNING: { start: 7, end: 11, name: 'morning' },
  /** 中午 */
  NOON: { start: 11, end: 13, name: 'noon' },
  /** 下午 */
  AFTERNOON: { start: 13, end: 17, name: 'afternoon' },
  /** 黄昏 */
  DUSK: { start: 17, end: 19, name: 'dusk' },
  /** 晚上 */
  EVENING: { start: 19, end: 22, name: 'evening' },
  /** 深夜 */
  NIGHT: { start: 22, end: 1, name: 'night' },
  /** 午夜 */
  MIDNIGHT: { start: 1, end: 5, name: 'midnight' },
} as const;

// ============ 温度相关常量 ============
export const TEMPERATURE = {
  /** 默认代理温度 */
  DEFAULT: 0.7,
  /** 分析协调温度（较低以获得更确定的结果） */
  ANALYSIS: 0.3,
  /** 叙述者温度 */
  NARRATOR: 0.8,
  /** 状态解析温度 */
  STATE_PARSE: 0.1,
} as const;

// ============ 闲置指令常量 ============
export const COMMANDS = {
  /** 等待/闲置指令 */
  IDLE: '<WAIT>',
  /** 闲置状态描述 */
  IDLE_DESCRIPTION: '玩家静静地待在原地，等待时间流逝。',
  /** 流式闲置状态描述 */
  IDLE_DESCRIPTION_STREAM: '玩家静静地待在原地，观察着时间的流逝和周围的变化。',
} as const;

// ============ 本地模型超时配置 ============
export const LOCAL_LLM = {
  /** 本地模型请求超时时间（毫秒），默认 120 秒，可通过环境变量 LOCAL_LLM_TIMEOUT 覆盖 */
  TIMEOUT: parseInt(process.env.LOCAL_LLM_TIMEOUT || '120000', 10),
  /** 本地模型连接超时时间（毫秒），默认 10 秒 */
  CONNECT_TIMEOUT: 10000,
} as const;
