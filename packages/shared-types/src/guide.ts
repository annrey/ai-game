/**
 * 引导系统类型定义
 */

/** 引导步骤 ID */
export type GuideStepId =
  | 'ai-config'
  | 'basic-setup'
  | 'world-init'
  | 'basic-tutorial'
  | 'advanced-features'
  | 'completed';

/** 引导步骤状态 */
export type GuideStepStatus = 'pending' | 'active' | 'completed' | 'skipped';

/** 引导步骤定义 */
export interface GuideStep {
  /** 步骤 ID */
  id: GuideStepId;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 步骤详细说明 */
  details: string;
  /** 步骤状态 */
  status: GuideStepStatus;
  /** 操作提示 */
  hints: string[];
  /** 子步骤（可选） */
  subSteps?: GuideSubStep[];
  /** 是否需要 AI 交互 */
  requiresAI: boolean;
  /** 预计完成时间（分钟） */
  estimatedTime?: number;
}

/** 子步骤定义 */
export interface GuideSubStep {
  /** 子步骤 ID */
  id: string;
  /** 子步骤标题 */
  title: string;
  /** 子步骤描述 */
  description: string;
  /** 是否已完成 */
  completed: boolean;
}

/** 引导进度 */
export interface GuideProgress {
  /** 当前步骤 ID */
  currentStepId: GuideStepId;
  /** 所有步骤的状态 */
  steps: Record<GuideStepId, GuideStepStatus>;
  /** 引导是否已完成 */
  isCompleted: boolean;
  /** 引导是否已激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 总完成步骤数 */
  completedStepsCount: number;
  /** 总步骤数 */
  totalStepsCount: number;
}

/** 引导配置 */
export interface GuideConfig {
  /** 是否启用引导 */
  enabled: boolean;
  /** 是否首次启动 */
  isFirstLaunch: boolean;
  /** 是否显示引导提示 */
  showHints: boolean;
  /** 是否自动播放引导 */
  autoPlay: boolean;
  /** 引导语言 */
  language: 'zh' | 'en';
  /** 是否允许跳过引导 */
  allowSkip: boolean;
  /** 引导完成后是否显示提示 */
  showCompletionHint: boolean;
}

/** 引导 NPC（引导角色） */
export interface GuideNPC {
  /** NPC ID */
  id: string;
  /** NPC 名称 */
  name: string;
  /** NPC 称号 */
  title: string;
  /** NPC 描述 */
  description: string;
  /** NPC 性格 */
  personality: string;
  /** NPC 头像（可选） */
  avatar?: string;
  /** 对话风格 */
  dialogueStyle: 'friendly' | 'wise' | 'humorous' | 'professional';
  /** 当前对话历史 */
  conversationHistory: GuideConversation[];
}

/** 引导对话记录 */
export interface GuideConversation {
  /** 对话 ID */
  id: string;
  /** 步骤 ID */
  stepId: GuideStepId;
  /** 玩家输入 */
  playerInput: string;
  /** 引导 NPC 回复 */
  guideResponse: string;
  /** 时间戳 */
  timestamp: number;
  /** 对话类型 */
  type: 'question' | 'instruction' | 'feedback' | 'encouragement';
}

/** 引导事件类型 */
export type GuideEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'guide_activated'
  | 'guide_completed'
  | 'guide_deactivated'
  | 'hint_requested'
  | 'chat_requested';

/** 引导事件 */
export interface GuideEvent {
  /** 事件类型 */
  type: GuideEventType;
  /** 事件数据 */
  payload: GuideEventPayload;
  /** 时间戳 */
  timestamp: number;
}

/** 引导事件数据 */
export interface GuideEventPayload {
  /** 步骤 ID */
  stepId?: GuideStepId;
  /** 子步骤 ID */
  subStepId?: string;
  /** 玩家输入 */
  playerInput?: string;
  /** 额外数据 */
  [key: string]: unknown;
}

/** 引导提示词模板 */
export interface GuidePromptTemplate {
  /** 步骤 ID */
  stepId: GuideStepId;
  /** 系统提示词 */
  systemPrompt: string;
  /** 用户提示词模板 */
  userPromptTemplate: string;
  /** 示例对话 */
  examples?: Array<{
    input: string;
    response: string;
  }>;
}

/** AI 配置引导数据 */
export interface AIConfigGuideData {
  /** AI 服务类型 */
  providerType: 'local' | 'cloud';
  /** 本地服务类型 */
  localService?: 'lm-studio' | 'ollama' | 'jan';
  /** 服务端点 */
  endpoint?: string;
  /** API 密钥（云服务） */
  apiKey?: string;
  /** 模型名称 */
  modelName?: string;
  /** 连接测试结果 */
  connectionTest?: {
    success: boolean;
    message: string;
    responseTime?: number;
  };
}

/** 基础设置引导数据 */
export interface BasicSetupGuideData {
  /** 玩家名称 */
  playerName: string;
  /** 世界名称 */
  worldName: string;
  /** 世界类型 */
  worldType?: 'fantasy' | 'scifi' | 'modern' | 'custom';
  /** 游戏风格 */
  playStyle?: 'story' | 'exploration' | 'combat' | 'social';
}

/** 引导系统状态 */
export interface GuideSystemState {
  /** 引导进度 */
  progress: GuideProgress;
  /** 引导配置 */
  config: GuideConfig;
  /** 引导 NPC */
  guideNPC: GuideNPC;
  /** 当前步骤数据 */
  currentStepData: Record<string, unknown>;
  /** 引导事件历史 */
  eventHistory: GuideEvent[];
}

/** 默认引导 NPC */
export const DEFAULT_GUIDE_NPC: GuideNPC = {
  id: 'guide-npc',
  name: '引路人',
  title: '世界引导者',
  description: '一位经验丰富的冒险向导，热衷于帮助新探索者开启他们的旅程',
  personality: '友好、耐心、知识渊博',
  dialogueStyle: 'friendly',
  conversationHistory: [],
};

/** 默认引导配置 */
export const DEFAULT_GUIDE_CONFIG: GuideConfig = {
  enabled: true,
  isFirstLaunch: true,
  showHints: true,
  autoPlay: false,
  language: 'zh',
  allowSkip: true,
  showCompletionHint: true,
};

/** 引导步骤定义列表 */
export const GUIDE_STEPS: Record<GuideStepId, Omit<GuideStep, 'status'>> = {
  'ai-config': {
    id: 'ai-config',
    title: '配置 AI 服务',
    description: '选择并配置你的 AI 服务（本地或在线）',
    details: '在这一步，我们将帮助你配置 AI 服务。你可以选择使用本地 AI（如 LM Studio、Ollama）或在线 AI 服务（如 OpenAI、Anthropic）。本地 AI 免费且隐私，在线 AI 更强大但需要付费。',
    hints: [
      '推荐使用本地 AI 进行免费体验',
      'LM Studio 界面友好，适合新手',
      'Ollama 性能优秀，支持多种模型',
      '连接测试可以验证配置是否正确',
    ],
    requiresAI: false,
    estimatedTime: 5,
    subSteps: [
      { id: 'ai-select', title: '选择 AI 类型', description: '选择本地 AI 或在线 AI', completed: false },
      { id: 'ai-config', title: '配置 AI 参数', description: '输入服务端点或 API 密钥', completed: false },
      { id: 'ai-test', title: '测试连接', description: '验证 AI 服务是否可用', completed: false },
    ],
  },
  'basic-setup': {
    id: 'basic-setup',
    title: '基础设置',
    description: '创建你的角色和世界',
    details: '在这一步，我们将创建你的角色和世界。告诉我想叫什么名字，以及你想探索什么样的世界。可以是奇幻世界、科幻世界、现代世界，或者任何你想象的世界。',
    hints: [
      '角色名称将用于游戏中的对话',
      '世界名称将作为你冒险的起点',
      '世界类型会影响 NPC 和场景的描述',
      '这些设置之后可以修改',
    ],
    requiresAI: true,
    estimatedTime: 3,
    subSteps: [
      { id: 'player-name', title: '设置角色名称', description: '输入你的角色名称', completed: false },
      { id: 'world-name', title: '设置世界名称', description: '输入你的世界名称', completed: false },
      { id: 'world-type', title: '选择世界类型', description: '选择世界风格', completed: false },
    ],
  },
  'world-init': {
    id: 'world-init',
    title: '世界初始化',
    description: '创建并加载你的世界',
    details: '在这一步，我们将创建并初始化你的世界。这包括生成初始场景、NPC 和基础规则。世界初始化可能需要一些时间，请耐心等待。',
    hints: [
      '世界初始化会自动生成初始场景',
      'NPC 会根据世界类型自动生成',
      '基础规则会确保世界运行正常',
      '初始化完成后就可以开始冒险了',
    ],
    requiresAI: true,
    estimatedTime: 2,
    subSteps: [
      { id: 'world-create', title: '创建世界', description: '根据配置生成世界', completed: false },
      { id: 'scene-load', title: '加载初始场景', description: '加载起始场景', completed: false },
      { id: 'npc-spawn', title: '生成 NPC', description: '生成初始 NPC', completed: false },
    ],
  },
  'basic-tutorial': {
    id: 'basic-tutorial',
    title: '基础教学',
    description: '学习基本操作',
    details: '在这一步，我们将学习游戏的基本操作：如何移动、如何与 NPC 交互、如何进行对话。这些是游戏的核心功能，掌握它们将帮助你更好地探索世界。',
    hints: [
      '使用移动指令可以改变位置',
      '与 NPC 对话可以获取信息和任务',
      '对话是自然语言的，可以自由表达',
      '观察指令可以查看周围环境',
    ],
    requiresAI: true,
    estimatedTime: 5,
    subSteps: [
      { id: 'move-tutorial', title: '移动教学', description: '学习如何移动', completed: false },
      { id: 'talk-tutorial', title: '对话教学', description: '学习如何与 NPC 对话', completed: false },
      { id: 'observe-tutorial', title: '观察教学', description: '学习如何观察环境', completed: false },
    ],
  },
  'advanced-features': {
    id: 'advanced-features',
    title: '进阶功能',
    description: '了解物品栏和任务系统',
    details: '在这一步，我们将介绍游戏的进阶功能：物品栏系统和任务系统。物品栏用于管理你的装备和道具，任务系统帮助你追踪目标和剧情。',
    hints: [
      '物品栏可以查看和管理物品',
      '任务系统显示当前任务和目标',
      '完成任务可以获得奖励',
      '物品可以通过购买、探索或奖励获得',
    ],
    requiresAI: true,
    estimatedTime: 5,
    subSteps: [
      { id: 'inventory-tutorial', title: '物品栏教学', description: '学习如何使用物品栏', completed: false },
      { id: 'quest-tutorial', title: '任务系统教学', description: '学习如何使用任务系统', completed: false },
    ],
  },
  'completed': {
    id: 'completed',
    title: '引导完成',
    description: '引导已完成',
    details: '恭喜你完成了所有引导步骤！现在你已经掌握了游戏的基本操作，可以开始自由探索了。如果之后遇到问题，可以随时询问引路人。',
    hints: [
      '随时可以与引路人对话获取帮助',
      '探索世界发现更多秘密',
      '与 NPC 建立关系解锁更多内容',
      '享受你的冒险旅程！',
    ],
    requiresAI: false,
    estimatedTime: 0,
  },
};
