import type { AIProvider, ProviderConfig, GameConfig } from '@openclaw/shared-types';

/**
 * 插件清单
 */
export interface ExtensionManifest {
  /** 插件唯一 ID，建议格式：发布者.插件名 */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 依赖的其他插件 */
  dependencies?: Record<string, string>;
}

/**
 * 基础扩展接口
 */
export interface BaseExtension {
  manifest: ExtensionManifest;
  /** 插件激活时调用 */
  activate?: () => Promise<void> | void;
  /** 插件卸载/停用时调用 */
  deactivate?: () => Promise<void> | void;
}

/**
 * AI Provider 扩展
 * 允许第三方接入新的大模型服务
 */
export interface ProviderExtension extends BaseExtension {
  type: 'provider';
  /** 提供创建 Provider 实例的工厂方法 */
  createProvider: (config: ProviderConfig) => AIProvider;
}

/**
 * 游戏模式扩展
 * 允许第三方接入新的游戏模式
 */
export interface ModeExtension extends BaseExtension {
  type: 'mode';
  /**
   * 注册游戏模式
   * @param modeId 模式ID
   * @param factory 模式创建工厂
   */
  registerMode: () => {
    modeId: string;
    factory: (providerFactory: any, dataPath: string, configOverride?: Partial<GameConfig>) => any;
  };
}

/**
 * 游戏玩法/类型扩展
 * 例如骰子游戏、卡牌游戏等内置小游戏
 */
export interface GameExtension extends BaseExtension {
  type: 'game';
  registerGame: () => {
    gameId: string;
    gameModule: any; // 具体游戏模块
  };
}

/**
 * 技能/Agent 扩展
 * 允许添加新的 Agent 角色或赋予现有 Agent 新能力
 */
export interface SkillExtension extends BaseExtension {
  type: 'skill';
  registerSkill: () => {
    skillId: string;
    agentFactory?: (config: any, provider: AIProvider) => any;
    // TODO: 完善技能的具体接口定义
  };
}

/**
 * 所有可能的扩展类型
 */
export type Extension = ProviderExtension | ModeExtension | GameExtension | SkillExtension;
