/**
 * Provider 工厂 + 路由
 * 根据配置自动选择和分配 AI 后端
 */

import type { AIProvider, ProviderConfig } from '../types/provider.js';
import type { AgentRole } from '../types/agent.js';
import { OpenAIProvider } from './openai-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { LocalProvider } from './local-provider.js';

interface ProviderFactoryConfig {
  defaultProvider: ProviderConfig['type'];
  openai?: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  };
  ollama?: {
    host?: string;
    defaultModel?: string;
  };
  local?: {
    endpoint?: string;
    defaultModel?: string;
    name?: string;
  };
  /** 按代理角色独立配置 */
  agentOverrides?: Partial<Record<AgentRole, {
    providerType: ProviderConfig['type'];
    model?: string;
  }>>;
}

export class ProviderFactory {
  private providers = new Map<string, AIProvider>();
  private config: ProviderFactoryConfig;

  constructor(config: ProviderFactoryConfig) {
    this.config = config;
    this.initProviders();
  }

  private initProviders(): void {
    // OpenAI
    if (this.config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: this.config.openai.apiKey,
        baseURL: this.config.openai.baseURL,
        defaultModel: this.config.openai.defaultModel,
      }));
    }

    // Ollama
    this.providers.set('ollama', new OllamaProvider({
      host: this.config.ollama?.host,
      defaultModel: this.config.ollama?.defaultModel,
    }));

    // Local
    this.providers.set('local', new LocalProvider({
      endpoint: this.config.local?.endpoint,
      defaultModel: this.config.local?.defaultModel,
      name: this.config.local?.name,
    }));
  }

  /** 获取默认 Provider */
  getDefault(): AIProvider {
    return this.getByType(this.config.defaultProvider);
  }

  /** 按类型获取 Provider */
  getByType(type: ProviderConfig['type']): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider "${type}" 不可用。请检查配置。`);
    }
    return provider;
  }

  /** 为特定代理获取 Provider（支持独立模型配置） */
  getForAgent(role: AgentRole): { provider: AIProvider; model?: string } {
    const override = this.config.agentOverrides?.[role];
    if (override) {
      return {
        provider: this.getByType(override.providerType),
        model: override.model,
      };
    }
    return { provider: this.getDefault() };
  }

  /** 检测所有 Provider 可用性 */
  async checkAvailability(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.isAvailable();
    }
    return results;
  }

  /** 列出所有可用模型 */
  async listAllModels(): Promise<Record<string, Awaited<ReturnType<AIProvider['listModels']>>>> {
    const all: Record<string, Awaited<ReturnType<AIProvider['listModels']>>> = {};
    for (const [name, provider] of this.providers) {
      try {
        all[name] = await provider.listModels();
      } catch {
        all[name] = [];
      }
    }
    return all;
  }

  /**
   * 从环境变量加载配置
   */
  static fromEnv(): ProviderFactory {
    const config: ProviderFactoryConfig = {
      defaultProvider: (process.env.DEFAULT_PROVIDER as ProviderConfig['type']) || 'ollama',
      openai: process.env.OPENAI_API_KEY
        ? {
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
            defaultModel: process.env.OPENAI_MODEL,
          }
        : undefined,
      ollama: {
        host: process.env.OLLAMA_HOST,
        defaultModel: process.env.OLLAMA_MODEL,
      },
      local: {
        endpoint: process.env.LOCAL_AI_ENDPOINT,
        defaultModel: process.env.LOCAL_AI_MODEL,
      },
      agentOverrides: {},
    };

    // 解析各代理独立配置
    const roles: AgentRole[] = ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'];
    const envKeys: Record<AgentRole, string> = {
      narrator: 'NARRATOR',
      'world-keeper': 'WORLD_KEEPER',
      'npc-director': 'NPC_DIRECTOR',
      'rule-arbiter': 'RULE_ARBITER',
      'drama-curator': 'DRAMA_CURATOR',
    };

    for (const role of roles) {
      const prefix = envKeys[role];
      const providerType = process.env[`${prefix}_PROVIDER`] as ProviderConfig['type'] | undefined;
      const model = process.env[`${prefix}_MODEL`];
      if (providerType) {
        config.agentOverrides![role] = { providerType, model };
      }
    }

    return new ProviderFactory(config);
  }
}
