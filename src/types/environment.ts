/**
 * 环境系统类型定义
 * 用于实现天气、可交互物体和环境效果
 */

/** 天气类型 */
export type WeatherType = 'sunny' | 'rainy' | 'cloudy' | 'foggy' | 'stormy' | 'snowy';

/** 天气状态 */
export interface WeatherState {
  /** 当前天气 */
  type: WeatherType;
  /** 天气描述 */
  description: string;
  /** 温度（摄氏度） */
  temperature: number;
  /** 湿度（0-100） */
  humidity: number;
  /** 风力（0-10） */
  windLevel: number;
  /** 持续时间（回合数） */
  duration: number;
  /** 对心情的影响 */
  moodEffect: number;
}

/** 可交互物体类型 */
export type InteractableType = 'furniture' | 'instrument' | 'decoration' | 'tool' | 'container';

/** 可交互物体 */
export interface InteractableObject {
  /** 物体ID */
  id: string;
  /** 物体名称 */
  name: string;
  /** 物体描述 */
  description: string;
  /** 物体类型 */
  type: InteractableType;
  /** 交互动作 */
  actions: ObjectAction[];
  /** 当前状态 */
  state: 'idle' | 'in_use' | 'broken';
  /** 使用者ID */
  currentUser?: string;
  /** 位置 */
  location: string;
  /** 图标 */
  icon: string;
}

/** 物体交互动作 */
export interface ObjectAction {
  /** 动作ID */
  id: string;
  /** 动作名称 */
  name: string;
  /** 动作描述 */
  description: string;
  /** 需要的技能 */
  requiredSkill?: string;
  /** 效果 */
  effects: {
    type: 'mood' | 'stamina' | 'social' | 'entertainment';
    value: number;
  }[];
  /** 冷却时间（回合数） */
  cooldown: number;
  /** 是否可以多人使用 */
  allowMultiple: boolean;
}

/** 环境音效 */
export interface AmbientSound {
  /** 音效ID */
  id: string;
  /** 音效名称 */
  name: string;
  /** 触发条件 */
  trigger: 'weather' | 'time' | 'random' | 'action';
  /** 触发值 */
  triggerValue: string;
  /** 音量（0-1） */
  volume: number;
  /** 循环播放 */
  loop: boolean;
}

/** 环境效果 */
export interface EnvironmentEffect {
  /** 效果ID */
  id: string;
  /** 效果名称 */
  name: string;
  /** 触发条件 */
  trigger: {
    type: 'weather' | 'time' | 'location' | 'object';
    value: string;
  };
  /** 影响目标 */
  target: 'npc' | 'player' | 'all';
  /** 效果 */
  effects: {
    type: 'mood' | 'health' | 'stamina' | 'activity';
    value: number;
  }[];
  /** 描述 */
  description: string;
}

/** 预定义的天气状态 */
export const WEATHER_STATES: Record<WeatherType, WeatherState> = {
  sunny: {
    type: 'sunny',
    description: '阳光明媚，天空湛蓝',
    temperature: 25,
    humidity: 40,
    windLevel: 2,
    duration: 0,
    moodEffect: 5,
  },
  rainy: {
    type: 'rainy',
    description: '细雨绵绵，街道湿润',
    temperature: 18,
    humidity: 80,
    windLevel: 3,
    duration: 0,
    moodEffect: -3,
  },
  cloudy: {
    type: 'cloudy',
    description: '阴天，云层厚重',
    temperature: 20,
    humidity: 60,
    windLevel: 2,
    duration: 0,
    moodEffect: 0,
  },
  foggy: {
    type: 'foggy',
    description: '雾气弥漫，能见度低',
    temperature: 15,
    humidity: 90,
    windLevel: 1,
    duration: 0,
    moodEffect: -5,
  },
  stormy: {
    type: 'stormy',
    description: '雷雨交加，狂风大作',
    temperature: 16,
    humidity: 85,
    windLevel: 8,
    duration: 0,
    moodEffect: -8,
  },
  snowy: {
    type: 'snowy',
    description: '雪花飘落，银装素裹',
    temperature: -5,
    humidity: 70,
    windLevel: 4,
    duration: 0,
    moodEffect: -2,
  },
};

/** 预定义的可交互物体 */
export const TAVERN_OBJECTS: InteractableObject[] = [
  {
    id: 'piano',
    name: '旧钢琴',
    description: '一架有些年头的钢琴，音色依然优美',
    type: 'instrument',
    actions: [
      {
        id: 'play_piano',
        name: '弹奏',
        description: '弹奏一首曲子',
        effects: [
          { type: 'mood', value: 10 },
          { type: 'entertainment', value: 15 },
        ],
        cooldown: 3,
        allowMultiple: false,
      },
      {
        id: 'listen_piano',
        name: '聆听',
        description: '欣赏他人的演奏',
        effects: [
          { type: 'mood', value: 5 },
          { type: 'entertainment', value: 8 },
        ],
        cooldown: 1,
        allowMultiple: true,
      },
    ],
    state: 'idle',
    location: '酒馆大厅',
    icon: '🎹',
  },
  {
    id: 'fireplace',
    name: '壁炉',
    description: '温暖的壁炉，火焰跳动着',
    type: 'furniture',
    actions: [
      {
        id: 'warm_by_fire',
        name: '取暖',
        description: '在壁炉旁取暖',
        effects: [
          { type: 'mood', value: 8 },
          { type: 'stamina', value: 5 },
        ],
        cooldown: 2,
        allowMultiple: true,
      },
    ],
    state: 'idle',
    location: '酒馆大厅',
    icon: '🔥',
  },
  {
    id: 'dartboard',
    name: '飞镖靶',
    description: '挂在墙上的飞镖靶',
    type: 'tool',
    actions: [
      {
        id: 'play_darts',
        name: '玩飞镖',
        description: '投掷飞镖',
        effects: [
          { type: 'mood', value: 5 },
          { type: 'social', value: 10 },
        ],
        cooldown: 2,
        allowMultiple: true,
      },
    ],
    state: 'idle',
    location: '酒馆角落',
    icon: '🎯',
  },
  {
    id: 'bookshelf',
    name: '书架',
    description: '摆满各种书籍的书架',
    type: 'furniture',
    actions: [
      {
        id: 'read_book',
        name: '阅读',
        description: '找本书阅读',
        effects: [
          { type: 'mood', value: 6 },
        ],
        cooldown: 4,
        allowMultiple: true,
      },
    ],
    state: 'idle',
    location: '酒馆角落',
    icon: '📚',
  },
  {
    id: 'bar_counter',
    name: '吧台',
    description: '酒馆的吧台，可以点饮料',
    type: 'furniture',
    actions: [
      {
        id: 'sit_at_bar',
        name: '坐在吧台',
        description: '在吧台坐下',
        effects: [
          { type: 'mood', value: 3 },
          { type: 'social', value: 5 },
        ],
        cooldown: 1,
        allowMultiple: true,
      },
    ],
    state: 'idle',
    location: '酒馆中央',
    icon: '🍺',
  },
];

/** 预定义的环境效果 */
export const ENVIRONMENT_EFFECTS: EnvironmentEffect[] = [
  {
    id: 'rainy_mood',
    name: '雨天忧郁',
    trigger: { type: 'weather', value: 'rainy' },
    target: 'all',
    effects: [
      { type: 'mood', value: -3 },
    ],
    description: '雨天让人心情有些低落',
  },
  {
    id: 'sunny_happy',
    name: '阳光明媚',
    trigger: { type: 'weather', value: 'sunny' },
    target: 'all',
    effects: [
      { type: 'mood', value: 5 },
    ],
    description: '阳光让人心情愉快',
  },
  {
    id: 'stormy_tension',
    name: '暴风雨紧张',
    trigger: { type: 'weather', value: 'stormy' },
    target: 'all',
    effects: [
      { type: 'mood', value: -8 },
      { type: 'activity', value: -10 },
    ],
    description: '暴风雨让人紧张不安',
  },
  {
    id: 'night_calm',
    name: '夜晚宁静',
    trigger: { type: 'time', value: 'night' },
    target: 'all',
    effects: [
      { type: 'mood', value: 3 },
    ],
    description: '夜晚的酒馆格外宁静',
  },
];

/** 环境系统配置 */
export interface EnvironmentConfig {
  /** 天气变化间隔（回合数） */
  weatherChangeInterval: number;
  /** 是否启用环境效果 */
  enableEffects: boolean;
  /** 是否启用音效 */
  enableSounds: boolean;
  /** 音效音量（0-1） */
  soundVolume: number;
}

/** 默认环境配置 */
export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  weatherChangeInterval: 10,
  enableEffects: true,
  enableSounds: true,
  soundVolume: 0.5,
};
