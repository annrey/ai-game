/**
 * Provider 工厂 + 路由
 * 根据配置自动选择和分配 AI 后端
 */

import type { AIProvider, ProviderConfig } from '../types/provider.js';
import type { AgentRole } from '../types/agent.js';
import { OpenAIProvider } from './openai-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { LocalProvider } from './local-provider.js';
import chalk from 'chalk';

/** 本地服务检测配置 */
interface LocalServiceConfig {
  name: string;
  endpoint: string;
  type: ProviderConfig['type'];
  checkPath: string;
}

/** 推荐工具信息 */
interface RecommendedTool {
  name: string;
  description: string;
  features: string[];
  installUrl: string;
  docsUrl: string;
  startCommand: string;
  defaultEndpoint: string;
  envVar: string;
}

/** 推荐工具列表 */
const RECOMMENDED_TOOLS: RecommendedTool[] = [
  {
    name: 'LM Studio',
    description: '优雅的桌面端本地 LLM 运行环境，支持模型下载和管理',
    features: ['图形界面', '模型管理', 'OpenAI 兼容 API', '跨平台'],
    installUrl: 'https://lmstudio.ai/',
    docsUrl: 'https://lmstudio.ai/docs',
    startCommand: '打开 LM Studio → 加载模型 → 启动服务器',
    defaultEndpoint: 'http://localhost:1234/v1',
    envVar: 'LM_STUDIO_ENDPOINT',
  },
  {
    name: 'Jan',
    description: '100% 本地运行的 ChatGPT 替代品，注重隐私',
    features: ['完全本地', '隐私优先', 'OpenAI 兼容 API', '跨平台'],
    installUrl: 'https://jan.ai/',
    docsUrl: 'https://jan.ai/docs',
    startCommand: '打开 Jan → 下载模型 → 启动服务器',
    defaultEndpoint: 'http://localhost:1337/v1',
    envVar: 'JAN_ENDPOINT',
  },
  {
    name: 'Ollama',
    description: '命令行优先的本地 LLM 运行工具，简单易用',
    features: ['命令行工具', '轻量级', '丰富的模型库', '跨平台'],
    installUrl: 'https://ollama.com/',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/README.md',
    startCommand: 'ollama run llama3.2',
    defaultEndpoint: 'http://localhost:11434',
    envVar: 'OLLAMA_HOST',
  },
];

/**
 * 打印本地模型服务未找到时的友好错误提示
 * 包含推荐工具列表、安装指南和环境变量配置说明
 */
export function printLocalModelGuide(): void {
  console.log('');
  console.log(chalk.red.bold('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.red.bold('║  🔴 未检测到本地模型服务                                       ║'));
  console.log(chalk.red.bold('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');

  console.log(chalk.yellow('💡 要使用 AI 说书人委员会，你需要先安装并启动一个本地模型服务。'));
  console.log('');

  // 推荐工具列表
  console.log(chalk.cyan.bold('📋 推荐的本地模型服务工具：'));
  console.log('');

  for (const tool of RECOMMENDED_TOOLS) {
    console.log(chalk.green.bold(`  ${tool.name}`));
    console.log(chalk.gray(`  ${'─'.repeat(60)}`));
    console.log(`  ${chalk.white(tool.description)}`);
    console.log('');
    console.log(`  ${chalk.yellow('✨ 特点:')} ${tool.features.join(' · ')}`);
    console.log(`  ${chalk.blue('🔗 官网:')} ${chalk.underline(tool.installUrl)}`);
    console.log(`  ${chalk.magenta('📖 文档:')} ${chalk.underline(tool.docsUrl)}`);
    console.log('');
  }

  // 快速开始指南
  console.log(chalk.cyan.bold('🚀 快速开始指南：'));
  console.log('');

  console.log(chalk.white.bold('  1. LM Studio（推荐新手）'));
  console.log(chalk.gray('     ─────────────────────────────────────────────────────────'));
  console.log(`     ${chalk.yellow('①')} 访问 ${chalk.underline('https://lmstudio.ai/')} 下载并安装`);
  console.log(`     ${chalk.yellow('②')} 打开 LM Studio，从 HuggingFace 下载一个模型（如 llama-3.2）`);
  console.log(`     ${chalk.yellow('③')} 点击左侧 "Local Server" 标签`);
  console.log(`     ${chalk.yellow('④')} 点击 "Start Server" 启动 API 服务`);
  console.log(`     ${chalk.yellow('⑤')} 保持 LM Studio 运行，重新启动 AI 说书人委员会`);
  console.log('');

  console.log(chalk.white.bold('  2. Jan'));
  console.log(chalk.gray('     ─────────────────────────────────────────────────────────'));
  console.log(`     ${chalk.yellow('①')} 访问 ${chalk.underline('https://jan.ai/')} 下载并安装`);
  console.log(`     ${chalk.yellow('②')} 打开 Jan，下载推荐的模型`);
  console.log(`     ${chalk.yellow('③')} 点击右上角设置 → Local API Server`);
  console.log(`     ${chalk.yellow('④')} 启动 Local API Server`);
  console.log(`     ${chalk.yellow('⑤')} 保持 Jan 运行，重新启动 AI 说书人委员会`);
  console.log('');

  console.log(chalk.white.bold('  3. Ollama（命令行用户）'));
  console.log(chalk.gray('     ─────────────────────────────────────────────────────────'));
  console.log(`     ${chalk.yellow('①')} 安装 Ollama：`);
  console.log(`        macOS: ${chalk.cyan('brew install ollama')}`);
  console.log(`        Linux: ${chalk.cyan('curl -fsSL https://ollama.com/install.sh | sh')}`);
  console.log(`        Windows: 访问 ${chalk.underline('https://ollama.com/download/windows')}`);
  console.log(`     ${chalk.yellow('②')} 启动服务：${chalk.cyan('ollama run llama3.2')}`);
  console.log(`     ${chalk.yellow('③')} 保持终端运行，重新启动 AI 说书人委员会`);
  console.log('');

  // 环境变量配置
  console.log(chalk.cyan.bold('⚙️  环境变量配置（可选）：'));
  console.log('');
  console.log(chalk.white('  如果使用了非默认端口，可以通过环境变量配置：'));
  console.log('');
  console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────┐'));
  console.log(chalk.gray('  │') + chalk.green('  # .env 文件示例') + chalk.gray('                                         │'));
  console.log(chalk.gray('  │') + chalk.white('  DEFAULT_PROVIDER=auto') + chalk.gray('                                   │'));
  console.log(chalk.gray('  │') + chalk.white('  # 或指定特定服务') + chalk.gray('                                      │'));
  console.log(chalk.gray('  │') + chalk.white('  DEFAULT_PROVIDER=lmstudio') + chalk.gray('                             │'));
  console.log(chalk.gray('  │') + chalk.white('  LM_STUDIO_ENDPOINT=http://localhost:1234/v1') + chalk.gray('           │'));
  console.log(chalk.gray('  │') + chalk.white('  LM_STUDIO_MODEL=your-model-name') + chalk.gray('                       │'));
  console.log(chalk.gray('  └─────────────────────────────────────────────────────────┘'));
  console.log('');

  // 其他选项
  console.log(chalk.cyan.bold('🌐 其他选项：'));
  console.log('');
  console.log(`  ${chalk.yellow('•')} 使用 OpenAI API：设置 ${chalk.cyan('OPENAI_API_KEY')} 环境变量`);
  console.log(`  ${chalk.yellow('•')} 使用自定义本地服务：设置 ${chalk.cyan('LOCAL_AI_ENDPOINT')} 环境变量`);
  console.log('');

  // 文档链接
  console.log(chalk.cyan.bold('📖 相关文档：'));
  console.log('');
  console.log(`  ${chalk.yellow('•')} 项目 README: ${chalk.underline('https://github.com/your-repo/ai-storyteller')}`);
  console.log(`  ${chalk.yellow('•')} 模型配置指南: ${chalk.underline('https://github.com/your-repo/ai-storyteller/blob/main/docs/models.md')}`);
  console.log(`  ${chalk.yellow('•')} 常见问题: ${chalk.underline('https://github.com/your-repo/ai-storyteller/blob/main/docs/faq.md')}`);
  console.log('');

  console.log(chalk.red.bold('═══════════════════════════════════════════════════════════════════'));
  console.log('');
}

/** 检测结果 */
export interface DetectedService {
  name: string;
  endpoint: string;
  type: ProviderConfig['type'];
  available: boolean;
}

/** 检测服务结果 */
export interface DetectLocalServicesResult {
  services: DetectedService[];
  recommendedProvider: ProviderConfig['type'] | null;
}

export interface ProviderFactoryConfig {
  defaultProvider: ProviderConfig['type'] | 'auto';
  openai?: {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
  };
  ollama?: {
    host?: string;
    defaultModel?: string;
  };
  local?: {
    endpoint?: string;
    apiKey?: string;
    defaultModel?: string;
    name?: string;
  };
  lmstudio?: {
    endpoint?: string;
    apiKey?: string;
    defaultModel?: string;
    name?: string;
  };
  jan?: {
    endpoint?: string;
    apiKey?: string;
    defaultModel?: string;
    name?: string;
  };
  /** 按代理角色独立配置 */
  agentOverrides?: Partial<Record<AgentRole, {
    providerType: ProviderConfig['type'];
    model?: string;
  }>>;
  /** 自动检测结果（内部使用） */
  _detectionResult?: {
    services: DetectedService[];
    recommendedProvider: ProviderConfig['type'] | null;
    autoDetected: boolean;
  };
}

export class ProviderFactory {
  private providers = new Map<string, AIProvider>();
  private config: ProviderFactoryConfig;

  constructor(config: ProviderFactoryConfig) {
    this.config = config;
    this.initProviders();
    this.logProviderInfo();
  }

  /** 输出 Provider 配置信息 */
  private logProviderInfo(): void {
    const { defaultProvider, _detectionResult } = this.config;

    if (_detectionResult?.autoDetected) {
      console.log('[ProviderFactory] 自动检测模式');
      console.log('[ProviderFactory] 本地服务检测结果：');
      for (const service of _detectionResult.services) {
        console.log(`  ${service.name}: ${service.available ? '✓ 可用' : '✗ 不可用'}`);
      }

      if (_detectionResult.recommendedProvider) {
        const recommendedService = _detectionResult.services.find(s => s.type === _detectionResult.recommendedProvider);
        console.log(`[ProviderFactory] 推荐使用: ${recommendedService?.name} (${_detectionResult.recommendedProvider})`);
      } else {
        console.log('[ProviderFactory] 未检测到可用的本地服务，回退到默认配置');
      }
    }

    console.log(`[ProviderFactory] 当前使用的 Provider: ${defaultProvider}`);

    // 输出各 provider 的配置信息
    const providerConfigs: Record<string, { endpoint?: string; model?: string }> = {
      openai: { model: this.config.openai?.defaultModel },
      ollama: { endpoint: this.config.ollama?.host, model: this.config.ollama?.defaultModel },
      lmstudio: { endpoint: this.config.lmstudio?.endpoint, model: this.config.lmstudio?.defaultModel },
      jan: { endpoint: this.config.jan?.endpoint, model: this.config.jan?.defaultModel },
      local: { endpoint: this.config.local?.endpoint, model: this.config.local?.defaultModel },
    };

    const currentConfig = providerConfigs[defaultProvider as string];
    if (currentConfig) {
      if (currentConfig.endpoint) {
        console.log(`[ProviderFactory] 端点: ${currentConfig.endpoint}`);
      }
      if (currentConfig.model) {
        console.log(`[ProviderFactory] 默认模型: ${currentConfig.model}`);
      }
    }
  }

  private initProviders(): void {
    // OpenAI
    this.providers.set('openai', new OpenAIProvider({
      apiKey: this.config.openai?.apiKey,
      baseURL: this.config.openai?.baseURL,
      defaultModel: this.config.openai?.defaultModel,
    }));

    // Ollama
    this.providers.set('ollama', new OllamaProvider({
      host: this.config.ollama?.host,
      defaultModel: this.config.ollama?.defaultModel,
    }));

    // Local
    this.providers.set('local', new LocalProvider({
      endpoint: this.config.local?.endpoint,
      apiKey: this.config.local?.apiKey,
      defaultModel: this.config.local?.defaultModel,
      name: this.config.local?.name,
      type: 'local',
    }));

    this.providers.set('lmstudio', new LocalProvider({
      endpoint: this.config.lmstudio?.endpoint ?? 'http://localhost:1234/v1',
      apiKey: this.config.lmstudio?.apiKey,
      defaultModel: this.config.lmstudio?.defaultModel,
      name: this.config.lmstudio?.name ?? 'LM Studio',
      type: 'lmstudio',
    }));

    this.providers.set('jan', new LocalProvider({
      endpoint: this.config.jan?.endpoint ?? 'http://localhost:1337/v1',
      apiKey: this.config.jan?.apiKey,
      defaultModel: this.config.jan?.defaultModel,
      name: this.config.jan?.name ?? 'Jan',
      type: 'jan',
    }));
  }

  /** 获取默认 Provider */
  getDefault(): AIProvider {
    const providerType = this.config.defaultProvider;
    if (providerType === 'auto') {
      // auto 模式下使用 ollama 作为默认（或检测到的第一个可用服务）
      return this.getByType('ollama');
    }
    return this.getByType(providerType);
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
  static async fromEnv(): Promise<ProviderFactory> {
    return new ProviderFactory(await ProviderFactory.configFromEnv());
  }

  static async configFromEnv(): Promise<ProviderFactoryConfig> {
    const envProvider = process.env.DEFAULT_PROVIDER;
    let defaultProvider: ProviderFactoryConfig['defaultProvider'] = (envProvider as ProviderConfig['type']) || 'auto';

    // 当设置为 auto 或未设置时，进行自动检测
    let detectedProvider: ProviderConfig['type'] | null = null;
    let detectionResults: DetectLocalServicesResult | null = null;

    if (!envProvider || envProvider === 'auto') {
      detectionResults = await ProviderFactory.detectLocalServices();
      if (detectionResults.recommendedProvider) {
        detectedProvider = detectionResults.recommendedProvider;
        defaultProvider = detectedProvider;
      } else {
        // 未检测到任何服务，回退到 ollama
        defaultProvider = 'ollama';
      }
    }

    const config: ProviderFactoryConfig = {
      defaultProvider,
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
      lmstudio: {
        endpoint: process.env.LM_STUDIO_ENDPOINT,
        defaultModel: process.env.LM_STUDIO_MODEL,
        name: 'LM Studio',
      },
      jan: {
        endpoint: process.env.JAN_ENDPOINT,
        defaultModel: process.env.JAN_MODEL,
        name: 'Jan',
      },
      agentOverrides: {},
    };

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

    // 添加检测结果到配置中（用于构造函数日志输出）
    if (detectionResults) {
      config._detectionResult = {
        services: detectionResults.services,
        recommendedProvider: detectionResults.recommendedProvider,
        autoDetected: true,
      };
    }

    return config;
  }

  /** 本地服务配置列表（按优先级排序：LM Studio > Jan > Ollama） */
  private static readonly LOCAL_SERVICES: LocalServiceConfig[] = [
    {
      name: 'LM Studio',
      endpoint: 'http://localhost:1234/v1',
      type: 'lmstudio',
      checkPath: '/models',
    },
    {
      name: 'Jan',
      endpoint: 'http://localhost:1337/v1',
      type: 'jan',
      checkPath: '/models',
    },
    {
      name: 'Ollama',
      endpoint: 'http://localhost:11434',
      type: 'ollama',
      checkPath: '/api/tags',
    },
  ];

  /**
   * 检测单个服务是否可用
   * @param service 服务配置
   * @param timeout 超时时间（毫秒）
   * @returns 检测结果
   */
  private static async checkServiceAvailability(
    service: LocalServiceConfig,
    timeout: number = 2000
  ): Promise<DetectedService> {
    const checkUrl = `${service.endpoint}${service.checkPath}`;

    const checkPromise = fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => ({
        name: service.name,
        endpoint: service.endpoint,
        type: service.type,
        available: response.ok,
      }))
      .catch(() => ({
        name: service.name,
        endpoint: service.endpoint,
        type: service.type,
        available: false,
      }));

    const timeoutPromise = new Promise<DetectedService>((resolve) => {
      setTimeout(() => {
        resolve({
          name: service.name,
          endpoint: service.endpoint,
          type: service.type,
          available: false,
        });
      }, timeout);
    });

    return Promise.race([checkPromise, timeoutPromise]);
  }

  /**
   * 检测本地模型服务
   * 自动检测 LM Studio、Jan 和 Ollama 服务
   * @param timeout 每个服务的超时时间（毫秒），默认 2000ms
   * @returns 检测到的服务列表和推荐使用的 provider 类型
   */
  static async detectLocalServices(timeout: number = 2000): Promise<DetectLocalServicesResult> {
    const services = await Promise.all(
      ProviderFactory.LOCAL_SERVICES.map(service =>
        ProviderFactory.checkServiceAvailability(service, timeout)
      )
    );

    // 找到第一个可用的服务（按优先级排序）
    const firstAvailable = services.find(s => s.available);
    const recommendedProvider = firstAvailable ? firstAvailable.type : null;

    return {
      services,
      recommendedProvider,
    };
  }

  /**
   * 自动检测并使用本地服务创建 ProviderFactory
   * 如果没有检测到可用服务，将显示友好错误提示
   * @param timeout 每个服务的超时时间（毫秒），默认 2000ms
   * @param showGuide 是否显示错误提示指南，默认 true
   * @returns ProviderFactory 实例
   * @throws Error 当没有检测到可用服务时抛出错误
   */
  static async createWithAutoDetect(
    timeout: number = 2000,
    showGuide: boolean = true
  ): Promise<ProviderFactory> {
    const { services, recommendedProvider } = await ProviderFactory.detectLocalServices(timeout);

    // 打印检测结果
    console.log('本地服务检测结果：');
    for (const service of services) {
      console.log(`  ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
    }

    if (recommendedProvider) {
      console.log(`\n🎯 推荐使用: ${services.find(s => s.type === recommendedProvider)?.name}`);
    } else {
      console.log('\n⚠️ 未检测到可用的本地服务');

      if (showGuide) {
        // 显示友好错误提示
        printLocalModelGuide();
        throw new Error(
          '未检测到可用的本地模型服务。请安装并启动 LM Studio、Jan 或 Ollama 后重试。'
        );
      }
    }

    // 使用检测到的服务或默认配置
    const config: ProviderFactoryConfig = {
      defaultProvider: recommendedProvider || 'ollama',
      ollama: {
        host: 'http://localhost:11434',
      },
      lmstudio: {
        endpoint: 'http://localhost:1234/v1',
        name: 'LM Studio',
      },
      jan: {
        endpoint: 'http://localhost:1337/v1',
        name: 'Jan',
      },
    };

    return new ProviderFactory(config);
  }
}
