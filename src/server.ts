/**
 * AI 说书人委员会 — Web 服务器
 * 提供静态文件服务和游戏 API
 */

import { loadTestConfig } from './utils/config.js';
loadTestConfig();

// 调试：打印环境变量
console.log('🔧 环境变量检查:');
console.log('  DEFAULT_PROVIDER:', process.env.DEFAULT_PROVIDER);
console.log('  OLLAMA_HOST:', process.env.OLLAMA_HOST);
console.log('  OLLAMA_MODEL:', process.env.OLLAMA_MODEL);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { GameEngine } from './engine/game-engine.js';
import { ProviderFactory, type ProviderFactoryConfig, printLocalModelGuide } from './providers/provider-factory.js';
import type { GameConfig, GameMode } from './types/game.js';
import { z } from 'zod';
import { SERVER, LIMITS, HISTORY, MEMORY } from './constants.js';
import { GuideManager } from './engine/guide-manager.js';
import { GuideAgent } from './agents/guide-agent.js';
import type { GuideStepId } from './types/guide.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = process.env.DATA_PATH || './data/saves';
const memoryDbPath = process.env.MEMORY_DB_PATH || './data/memories.db';
const previewModelDir = process.env.PIXEL_MODEL_DIR || '/Users/chengyongwei/Documents/326_ckpt_SD_XL';
const previewOutputPath = path.join(__dirname, '../ui/generated/latest-preview.png');
const previewCoverPath = path.join(previewModelDir, '_cover_images_/cover_image.png');
const previewPython = process.env.PREVIEW_PYTHON || path.join(process.cwd(), '.sdxl-venv/bin/python3');
const hfEndpoint = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
const execFileAsync = promisify(execFile);

let providerConfig: ProviderFactoryConfig;
let providerFactory: ProviderFactory;
let engine: GameEngine;

// 检测到的本地模型服务信息
let detectedServiceInfo: { name: string; endpoint: string; type: string } | null = null;

/**
 * 初始化 Provider 配置
 * 支持自动检测本地模型服务（当 DEFAULT_PROVIDER=auto 时）
 * 当 UI_ONLY=true 时，跳过 provider 检查，仅提供静态文件服务
 */
async function initProviderConfig(): Promise<void> {
  const defaultProvider = process.env.DEFAULT_PROVIDER;
  const uiOnly = process.env.UI_ONLY === 'true';

  // UI 模式：跳过 provider 检查，使用 mock 配置
  if (uiOnly) {
    console.log('🎨 UI 预览模式：跳过 AI Provider 检查');
    providerConfig = {
      defaultProvider: 'ollama',
      ollama: {
        host: 'http://localhost:11434',
        defaultModel: 'ui-preview-mode',
      },
      agentOverrides: {},
    };
    return;
  }

  if (defaultProvider === 'auto') {
    console.log('🔍 自动检测本地模型服务...');
    const connectTimeout = parseInt(process.env.CONNECT_TIMEOUT || '5000', 10);
    const { services, recommendedProvider } = await ProviderFactory.detectLocalServices(connectTimeout);

    console.log('\n📊 本地服务检测结果：');
    for (const service of services) {
      const status = service.available ? '✅ 可用' : '❌ 不可用';
      console.log(`   ${service.name}: ${status}`);
      if (service.available && !detectedServiceInfo) {
        detectedServiceInfo = service;
      }
    }

    if (recommendedProvider) {
      console.log(`\n🎯 推荐使用: ${services.find(s => s.type === recommendedProvider)?.name}`);
    } else {
      console.log('\n⚠️ 未检测到可用的本地服务');
      // 显示友好错误提示并退出
      printLocalModelGuide();
      process.exit(1);
    }

    providerConfig = {
      defaultProvider: recommendedProvider || 'ollama',
      ollama: {
        host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_MODEL,
      },
      lmstudio: {
        endpoint: process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234/v1',
        defaultModel: process.env.LM_STUDIO_MODEL,
        name: 'LM Studio',
      },
      jan: {
        endpoint: process.env.JAN_ENDPOINT || 'http://localhost:1337/v1',
        defaultModel: process.env.JAN_MODEL,
        name: 'Jan',
      },
      agentOverrides: {},
    };

    // 加载代理覆盖配置
    const roles = ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'] as const;
    const envKeys: Record<string, string> = {
      narrator: 'NARRATOR',
      'world-keeper': 'WORLD_KEEPER',
      'npc-director': 'NPC_DIRECTOR',
      'rule-arbiter': 'RULE_ARBITER',
      'drama-curator': 'DRAMA_CURATOR',
    };

    for (const role of roles) {
      const prefix = envKeys[role];
      const providerType = process.env[`${prefix}_PROVIDER`] as any;
      const model = process.env[`${prefix}_MODEL`];
      if (providerType) {
        providerConfig.agentOverrides![role] = { providerType, model };
      }
    }
  } else {
    providerConfig = await ProviderFactory.configFromEnv();

    // 检查配置的 provider 是否可用
    const providerToCheck = providerConfig.defaultProvider;
    if (providerToCheck !== 'openai') {
      console.log(`🔍 检查配置的 Provider: ${providerToCheck}`);
      const tempFactory = new ProviderFactory(providerConfig);
      const availability = await tempFactory.checkAvailability();

      if (!availability[providerToCheck]) {
        console.log(`\n❌ 配置的 Provider "${providerToCheck}" 不可用`);
        printLocalModelGuide();
        process.exit(1);
      }
      console.log(`✅ Provider "${providerToCheck}" 可用`);
    }
  }
}

let gameConfig: GameConfig = {
  mode: 'text-adventure',
  theme: 'fantasy',
  enableCombat: true,
  enableSave: true,
  maxTurns: 1000,
  difficulty: 'normal',
  memoryMaxContextChars: 2000,
  autoWorldTick: false,
  idleTimeout: 30000,
  enabledAgents: ['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'],
  maxHistoryTurns: HISTORY.DEFAULT_MAX_TURNS,
  logging: {
    enabled: process.env.LOG_LEVEL === 'debug',
    level: (process.env.LOG_LEVEL as any) || 'info',
  },
  autoSaveInterval: 0,
};

let ruleBookText = '';
let sessionId = `session-${Date.now()}`;

function rebuildEngine(options?: { preserveState?: boolean; newSession?: boolean }): void {
  const preserveState = options?.preserveState ?? true;
  const newSession = options?.newSession ?? false;

  const prevEngine = engine;
  const state = preserveState ? prevEngine.getState() : undefined;
  const nextSessionId = newSession ? `session-${Date.now()}` : sessionId;
  const nextProviderFactory = new ProviderFactory(providerConfig);
  const nextEngine = new GameEngine({
    config: gameConfig,
    providerFactory: nextProviderFactory,
    dataPath,
    memoryDbPath,
    sessionId: nextSessionId,
    initialState: state as any,
  });

  if (ruleBookText) nextEngine.setRuleBook(ruleBookText);

  engine = nextEngine;
  providerFactory = nextProviderFactory;
  sessionId = nextSessionId;
  prevEngine.close();
}

const app = express();
const PORT = process.env.PORT || SERVER.DEFAULT_PORT;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../ui')));

// API 路由

app.get('/api/config', async (req, res) => {
  try {
    const availability = await providerFactory.checkAvailability();
    res.json({
      success: true,
      data: {
        gameConfig: engine.getConfig(),
        providerRouting: {
          defaultProvider: providerConfig.defaultProvider,
          agentOverrides: providerConfig.agentOverrides ?? {},
          ollama: { defaultModel: providerConfig.ollama?.defaultModel, host: providerConfig.ollama?.host },
          local: { defaultModel: providerConfig.local?.defaultModel, endpoint: providerConfig.local?.endpoint, apiKey: providerConfig.local?.apiKey ? '***' : undefined, name: providerConfig.local?.name },
          lmstudio: { defaultModel: providerConfig.lmstudio?.defaultModel, endpoint: providerConfig.lmstudio?.endpoint, apiKey: providerConfig.lmstudio?.apiKey ? '***' : undefined, name: providerConfig.lmstudio?.name },
          jan: { defaultModel: providerConfig.jan?.defaultModel, endpoint: providerConfig.jan?.endpoint, apiKey: providerConfig.jan?.apiKey ? '***' : undefined, name: providerConfig.jan?.name },
          openai: { defaultModel: providerConfig.openai?.defaultModel, baseURL: providerConfig.openai?.baseURL, apiKey: providerConfig.openai?.apiKey ? '***' : undefined, enabled: true },
        },
        runtime: {
          sessionId,
          dataPath,
          memoryDbPath,
        },
        availability,
        ruleBook: { enabled: !!ruleBookText, length: ruleBookText.length },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const AgentRoleSchema = z.enum(['narrator', 'world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator']);
const GameModeSchema = z.enum(['text-adventure', 'ai-battle', 'npc-sandbox', 'chat-roleplay']);

const GameConfigPatchSchema = z.object({
  mode: GameModeSchema.optional(),
  language: z.string().min(2).max(50).optional(),
  enabledAgents: z.array(AgentRoleSchema).min(1).optional(),
  streaming: z.boolean().optional(),
  logging: z.boolean().optional(),
  maxHistoryTurns: z.number().int().min(LIMITS.MAX_HISTORY_TURNS_MIN).max(LIMITS.MAX_HISTORY_TURNS_MAX).optional(),
  memoryMaxContextChars: z.number().int().min(MEMORY.MIN_CONTEXT_CHARS).max(MEMORY.MAX_CONTEXT_CHARS).optional(),
  autoSaveInterval: z.number().int().min(0).max(LIMITS.AUTO_SAVE_INTERVAL_MAX).optional(),
  autoWorldTick: z.boolean().optional(),
  idleTimeout: z.number().int().min(10).max(300).optional(),
}).strict();

app.post('/api/config', async (req, res) => {
  try {
    const parsed = GameConfigPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const patch = parsed.data;
    const next: GameConfig = {
      ...gameConfig,
      ...patch,
    };

    if (!next.enabledAgents.includes('narrator')) {
      next.enabledAgents = ['narrator', ...next.enabledAgents.filter(r => r !== 'narrator')];
    }

    const preserveState = patch.mode ? false : true;
    gameConfig = next;
    rebuildEngine({ preserveState });

    res.json({ success: true, data: { gameConfig: engine.getConfig() } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取游戏状态
app.get('/api/state', (req, res) => {
  try {
    const state = engine.getState();
    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取 AI Provider 可用性
app.get('/api/providers', async (req, res) => {
  try {
    const availability = await providerFactory.checkAvailability();
    const models = await providerFactory.listAllModels();
    res.json({
      success: true,
      data: {
        availability,
        models,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const ProviderTypeSchema = z.enum(['openai', 'ollama', 'local', 'lmstudio', 'jan']);
const ProviderRoutingPatchSchema = z.object({
  defaultProvider: ProviderTypeSchema.optional(),
  agentOverrides: z.record(AgentRoleSchema, z.union([
    z.object({
      providerType: ProviderTypeSchema,
      model: z.string().min(1).max(LIMITS.STRING_MEDIUM).optional(),
    }),
    z.null(),
  ])).optional(),
  ollama: z.object({
    host: z.string().max(LIMITS.STRING_LONG).optional(),
    defaultModel: z.string().max(LIMITS.STRING_MEDIUM).optional(),
  }).optional(),
  local: z.object({
    endpoint: z.string().max(LIMITS.STRING_LONG).optional(),
    apiKey: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    defaultModel: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    name: z.string().max(LIMITS.STRING_MEDIUM).optional(),
  }).optional(),
  lmstudio: z.object({
    endpoint: z.string().max(LIMITS.STRING_LONG).optional(),
    apiKey: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    defaultModel: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    name: z.string().max(LIMITS.STRING_MEDIUM).optional(),
  }).optional(),
  jan: z.object({
    endpoint: z.string().max(LIMITS.STRING_LONG).optional(),
    apiKey: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    defaultModel: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    name: z.string().max(LIMITS.STRING_MEDIUM).optional(),
  }).optional(),
  openai: z.object({
    baseURL: z.string().max(LIMITS.STRING_LONG).optional(),
    apiKey: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    defaultModel: z.string().max(LIMITS.STRING_MEDIUM).optional(),
  }).optional(),
}).strict();

app.post('/api/providers/config', async (req, res) => {
  try {
    const parsed = ProviderRoutingPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const patch = parsed.data;
    const nextAgentOverrides = { ...(providerConfig.agentOverrides ?? {}) } as any;
    if (patch.agentOverrides) {
      for (const [k, v] of Object.entries(patch.agentOverrides)) {
        if (v === null) delete nextAgentOverrides[k as any];
        else nextAgentOverrides[k as any] = v;
      }
    }
    providerConfig = {
      ...providerConfig,
      ...patch,
      agentOverrides: nextAgentOverrides,
      openai: { ...(providerConfig.openai ?? {}), ...(patch.openai ?? {}) },
      ollama: { ...(providerConfig.ollama ?? {}), ...(patch.ollama ?? {}) },
      local: { ...(providerConfig.local ?? {}), ...(patch.local ?? {}) },
      lmstudio: { ...(providerConfig.lmstudio ?? {}), ...(patch.lmstudio ?? {}) },
      jan: { ...(providerConfig.jan ?? {}), ...(patch.jan ?? {}) },
    };

    rebuildEngine({ preserveState: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 处理玩家输入
app.post('/api/turn', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input: input is required and must be a string',
      });
      return;
    }

    const result = await engine.processTurn(input);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 流式处理玩家输入
app.post('/api/turn/stream', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input: input is required and must be a string',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      const stream = engine.processStreamTurn(input);
      for await (const chunk of stream) {
        res.write(chunk);
      }
      res.end();
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
      const errorData = JSON.stringify({
        type: 'error',
        success: false,
        error: errorMessage,
      });
      res.write(`\n[ERROR]${errorData}[/ERROR]\n`);
      res.end();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    } else {
      const errorData = JSON.stringify({
        type: 'error',
        success: false,
        error: errorMessage,
      });
      res.write(`\n[ERROR]${errorData}[/ERROR]\n`);
      res.end();
    }
  }
});

app.get('/api/saves', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || LIMITS.SAVES_LIST_DEFAULT;
    const saves = await engine.listSaves(limit);
    res.json({ success: true, data: { saves } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 保存游戏
app.post('/api/save', async (req, res) => {
  try {
    const { name } = req.body;
    const saveId = await engine.save(name || `save-${Date.now()}`);
    res.json({
      success: true,
      data: { saveId },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 加载游戏
app.post('/api/load', async (req, res) => {
  try {
    const { saveId } = req.body;
    if (!saveId) {
      res.status(400).json({
        success: false,
        error: 'saveId is required',
      });
      return;
    }
    await engine.load(saveId);
    res.json({
      success: true,
      message: 'Game loaded successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 重置游戏
app.post('/api/reset', (req, res) => {
  try {
    engine.reset();
    res.json({
      success: true,
      message: 'Game reset successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 删除存档
app.delete('/api/saves/:saveId', async (req, res) => {
  try {
    const { saveId } = req.params;
    if (!saveId) {
      res.status(400).json({
        success: false,
        error: 'saveId is required',
      });
      return;
    }
    await engine.deleteSave(saveId);
    res.json({
      success: true,
      message: 'Save deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取回合数
app.get('/api/turn-count', (req, res) => {
  res.json({
    success: true,
    data: { turnCount: engine.getTurnCount() },
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/memories/clear', (req, res) => {
  try {
    engine.clearMemories();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取记忆列表
app.get('/api/memories', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || LIMITS.MEMORY_LIST_DEFAULT;
    const type = req.query.type as string | undefined;
    const mm = engine.getMemoryManager();
    const memories = mm.getAllMemories({
      limit,
      type: type as any,
    });
    res.json({
      success: true,
      data: {
        memories,
        count: mm.getMemoryCount(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/rulebook', (req, res) => {
  res.json({ success: true, data: { text: ruleBookText } });
});

app.post('/api/rulebook', (req, res) => {
  try {
    const schema = z.object({ text: z.string().max(LIMITS.RULEBOOK_MAX_LENGTH) }).strict();
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }
    ruleBookText = parsed.data.text;
    engine.setRuleBook(ruleBookText);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/session/new', (req, res) => {
  try {
    rebuildEngine({ preserveState: true, newSession: true });
    res.json({ success: true, data: { sessionId } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/architecture', (req, res) => {
  const cfg = engine.getConfig();
  const features = [
    { module: '输入层', responsibilities: ['玩家输入', cfg.streaming ? '流式输出' : '非流式输出', '世界/角色引导', '图像预览生成'] },
    { module: '引擎层', responsibilities: ['回合推进', '时间推进', '存档/读档/重置', '事件日志'] },
    { module: '记忆层', responsibilities: ['记忆写入', '相关记忆召回', `上下文预算 ${cfg.memoryMaxContextChars ?? 2000} 字符`] },
    { module: '代理层', responsibilities: cfg.enabledAgents },
    { module: '规则层', responsibilities: ['规则仲裁', '骰子/检定', '规则书注入'] },
    { module: 'Provider 层', responsibilities: ['Ollama', 'LM Studio', 'Jan', 'Local OpenAI-Compatible', 'OpenAI'] },
  ];
  res.json({ success: true, data: { features } });
});

// 获取成就列表
app.get('/api/achievements', (req, res) => {
  try {
    const achievements = engine.getAchievements();
    const count = engine.getUnlockedAchievementCount();
    res.json({ success: true, data: { achievements, count } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/preview/default', (req, res) => {
  res.sendFile(previewCoverPath, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: 'default preview not found' });
    }
  });
});

app.post('/api/preview/generate', async (req, res) => {
  try {
    const schema = z.object({
      prompt: z.string().min(1).max(LIMITS.PREVIEW_PROMPT_MAX),
    }).strict();
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const scriptPath = path.join(__dirname, '../scripts/generate_preview.py');
    const { stdout } = await execFileAsync(previewPython, [scriptPath, parsed.data.prompt, previewOutputPath], {
      env: {
        ...process.env,
        PIXEL_MODEL_DIR: previewModelDir,
        HF_ENDPOINT: hfEndpoint,
      },
      maxBuffer: SERVER.EXEC_MAX_BUFFER,
    });
    const meta = JSON.parse(stdout.trim().split('\n').pop() || '{}');
    res.json({
      success: true,
      data: {
        ...meta,
        url: `/generated/latest-preview.png?v=${Date.now()}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/bootstrap/world', (req, res) => {
  try {
    const schema = z.object({
      worldName: z.string().max(LIMITS.STRING_SHORT).optional(),
      genre: z.string().max(LIMITS.STRING_SHORT).optional(),
      tone: z.string().max(LIMITS.STRING_SHORT).optional(),
      conflict: z.string().max(LIMITS.STRING_MEDIUM).optional(),
      location: z.string().max(LIMITS.STRING_SHORT).optional(),
      locationDescription: z.string().max(LIMITS.STRING_LONG).optional(),
      weather: z.string().max(LIMITS.STRING_SHORT).optional(),
      playerName: z.string().max(LIMITS.STRING_SHORT).optional(),
      playerRole: z.string().max(LIMITS.STRING_SHORT).optional(),
      playerBackground: z.string().max(LIMITS.STRING_MEDIUM).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }
    engine.bootstrapWorld(parsed.data);
    res.json({ success: true, data: { state: engine.getState() } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 搜索记忆
app.get('/api/memories/search', (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'query parameter "q" is required' });
      return;
    }
    const mm = engine.getMemoryManager();
    const memories = mm.recall(query, { limit: LIMITS.MEMORY_SEARCH_LIMIT });
    res.json({
      success: true,
      data: { memories },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============ 引导系统 API ============

// 全局引导管理器和代理实例
let guideManager: GuideManager | null = null;
let guideAgent: GuideAgent | null = null;

/**
 * 获取或创建引导管理器
 */
function getGuideManager(): GuideManager {
  if (!guideManager) {
    guideManager = new GuideManager();
    // 与状态存储集成（如果可能）
    try {
      const stateStore = engine.getStateStore();
      if (stateStore) {
        guideManager.setStateStore(stateStore);
      }
    } catch (e) {
      console.log('引导管理器无法与状态存储集成');
    }
  }
  return guideManager;
}

/**
 * 获取或创建引导代理
 */
function getGuideAgent(): GuideAgent {
  if (!guideAgent) {
    const manager = getGuideManager();
    const provider = providerFactory.createProvider();
    const modelName = getCurrentModelName();
    guideAgent = new GuideAgent(manager, provider, modelName);
  }
  return guideAgent;
}

/**
 * 获取引导进度
 */
app.get('/api/guide/progress', (req, res) => {
  try {
    const manager = getGuideManager();
    const progress = manager.getProgress();
    const currentStep = manager.getCurrentStep();
    
    res.json({
      success: true,
      data: {
        isActive: progress.isActive,
        isCompleted: progress.isCompleted,
        progress: manager.getProgressPercentage(),
        currentStep: currentStep ? {
          id: currentStep.id,
          title: currentStep.title,
          description: currentStep.description,
          status: currentStep.status,
        } : null,
        completedStepsCount: progress.completedStepsCount,
        totalStepsCount: progress.totalStepsCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 开始引导步骤
 */
app.post('/api/guide/step/start', (req, res) => {
  try {
    const { stepId } = req.body as { stepId: GuideStepId };
    
    if (!stepId) {
      res.status(400).json({ success: false, error: 'stepId is required' });
      return;
    }
    
    const manager = getGuideManager();
    const success = manager.startStep(stepId);
    
    if (!success) {
      res.status(400).json({ 
        success: false, 
        error: '无法开始此步骤，请检查前置条件' 
      });
      return;
    }
    
    const progress = manager.getProgress();
    const currentStep = manager.getCurrentStep();
    const nextStep = currentStep ? {
      id: currentStep.id,
      title: currentStep.title,
      description: currentStep.description,
    } : null;
    
    res.json({
      success: true,
      data: {
        isActive: progress.isActive,
        currentStep: nextStep,
        progress: manager.getProgressPercentage(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 完成引导步骤
 */
app.post('/api/guide/step/complete', (req, res) => {
  try {
    const { stepId, data } = req.body as { stepId?: GuideStepId; data?: Record<string, unknown> };
    
    const manager = getGuideManager();
    const currentStep = manager.getCurrentStep();
    
    if (!currentStep) {
      res.status(400).json({ 
        success: false, 
        error: '没有活跃的引导步骤' 
      });
      return;
    }
    
    const success = manager.completeStep(data);
    
    if (!success) {
      res.status(400).json({ 
        success: false, 
        error: '无法完成此步骤' 
      });
      return;
    }
    
    const progress = manager.getProgress();
    const nextStep = manager.getCurrentStep();
    
    res.json({
      success: true,
      data: {
        isCompleted: progress.isCompleted,
        progress: manager.getProgressPercentage(),
        nextStep: nextStep ? {
          id: nextStep.id,
          title: nextStep.title,
          description: nextStep.description,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 跳过引导步骤
 */
app.post('/api/guide/step/skip', (req, res) => {
  try {
    const manager = getGuideManager();
    const success = manager.skipStep();
    
    if (!success) {
      res.status(400).json({ 
        success: false, 
        error: '无法跳过此步骤' 
      });
      return;
    }
    
    const progress = manager.getProgress();
    const currentStep = manager.getCurrentStep();
    
    res.json({
      success: true,
      data: {
        isCompleted: progress.isCompleted,
        progress: manager.getProgressPercentage(),
        currentStep: currentStep ? {
          id: currentStep.id,
          title: currentStep.title,
          description: currentStep.description,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取当前步骤提示
 */
app.get('/api/guide/hint', async (req, res) => {
  try {
    const agent = getGuideAgent();
    const hint = await agent.getHint();
    
    res.json({
      success: true,
      data: { hint },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 与引导角色对话
 */
app.post('/api/guide/chat', async (req, res) => {
  try {
    const { message } = req.body as { message: string };
    
    if (!message || message.trim() === '') {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }
    
    const agent = getGuideAgent();
    const response = await agent.chat(message);
    
    res.json({
      success: true,
      data: { response },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取当前使用的模型名称
 */
function getCurrentModelName(): string {
  const provider = providerConfig.defaultProvider;
  switch (provider) {
    case 'ollama':
      return providerConfig.ollama?.defaultModel || process.env.OLLAMA_MODEL || 'default';
    case 'local':
      return providerConfig.local?.defaultModel || process.env.LOCAL_AI_MODEL || 'local-model';
    case 'lmstudio':
      return providerConfig.lmstudio?.defaultModel || process.env.LM_STUDIO_MODEL || 'local-model';
    case 'jan':
      return providerConfig.jan?.defaultModel || process.env.JAN_MODEL || 'local-model';
    case 'openai':
      return providerConfig.openai?.defaultModel || process.env.OPENAI_MODEL || 'gpt-4o';
    default:
      return 'unknown';
  }
}

// ============ 思维链 API ============

/**
 * 获取当前思维链
 */
app.get('/api/cot/current', (req, res) => {
  try {
    const state = engine.getState();
    const currentTurn = state.currentTurn;
    
    if (!currentTurn || !currentTurn.chainOfThought) {
      res.json({
        success: true,
        data: {
          current: null,
          message: '当前没有活跃的思维链',
        },
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        current: currentTurn.chainOfThought,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取思维链历史
 * 支持分页（limit, offset）和过滤（按 agentRole）
 */
app.get('/api/cot/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || LIMITS.SAVES_LIST_DEFAULT;
    const offset = parseInt(req.query.offset as string) || 0;
    const agentRole = req.query.agentRole as string | undefined;
    
    const state = engine.getState();
    const history = state.history || [];
    
    const allChainsOfThought = history
      .filter(turn => turn.chainOfThought)
      .map(turn => turn.chainOfThought);
    
    let filtered = allChainsOfThought;
    if (agentRole) {
      filtered = filtered.filter(cot => cot.agentRole === agentRole);
    }
    
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        items: paginated,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 展开指定思维链步骤
 */
app.post('/api/cot/expand', (req, res) => {
  try {
    const { stepId, cotId } = req.body as { stepId?: string; cotId?: string };
    
    if (!stepId) {
      res.status(400).json({ 
        success: false, 
        error: 'stepId is required' 
      });
      return;
    }
    
    const state = engine.getState();
    const history = state.history || [];
    
    let targetCot: any = null;
    
    if (cotId) {
      for (const turn of history) {
        if (turn.chainOfThought && turn.chainOfThought.id === cotId) {
          targetCot = turn.chainOfThought;
          break;
        }
      }
    }
    
    if (!targetCot) {
      const currentTurn = state.currentTurn;
      if (currentTurn && currentTurn.chainOfThought) {
        targetCot = currentTurn.chainOfThought;
      }
    }
    
    if (!targetCot) {
      res.status(404).json({ 
        success: false, 
        error: '未找到指定的思维链' 
      });
      return;
    }
    
    const targetStep = targetCot.steps.find(step => 
      step.step === stepId || step.title.includes(stepId)
    );
    
    if (!targetStep) {
      res.status(404).json({ 
        success: false, 
        error: '未找到指定的思维步骤' 
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        step: {
          id: stepId,
          ...targetStep,
          expanded: true,
          relatedSteps: targetCot.steps.filter(s => s.step !== targetStep.step).map(s => ({
            step: s.step,
            title: s.title,
            summary: s.content.substring(0, 100) + (s.content.length > 100 ? '...' : ''),
          })),
        },
        chainOfThought: {
          id: targetCot.id,
          agentRole: targetCot.agentRole,
          timestamp: targetCot.timestamp,
          totalSteps: targetCot.steps.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取思维链统计信息
 */
app.get('/api/cot/stats', (req, res) => {
  try {
    const state = engine.getState();
    const history = state.history || [];
    
    const allChainsOfThought = history
      .filter(turn => turn.chainOfThought)
      .map(turn => turn.chainOfThought);
    
    const statsByAgent: Record<string, {
      count: number;
      totalDuration: number;
      avgDuration: number;
      totalSteps: number;
    }> = {};
    
    let overallTotalDuration = 0;
    let overallTotalSteps = 0;
    
    for (const cot of allChainsOfThought) {
      const agentRole = cot.agentRole;
      if (!statsByAgent[agentRole]) {
        statsByAgent[agentRole] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          totalSteps: 0,
        };
      }
      
      const cotDuration = cot.steps.reduce((sum, step) => sum + (step.duration || 0), 0);
      
      statsByAgent[agentRole].count++;
      statsByAgent[agentRole].totalDuration += cotDuration;
      statsByAgent[agentRole].totalSteps += cot.steps.length;
      
      overallTotalDuration += cotDuration;
      overallTotalSteps += cot.steps.length;
    }
    
    for (const agentRole of Object.keys(statsByAgent)) {
      const stats = statsByAgent[agentRole];
      stats.avgDuration = stats.count > 0 
        ? Math.floor(stats.totalDuration / stats.count) 
        : 0;
    }
    
    const totalCots = allChainsOfThought.length;
    const avgThinkingTime = totalCots > 0 
      ? Math.floor(overallTotalDuration / totalCots) 
      : 0;
    
    const avgStepsPerCot = totalCots > 0 
      ? (overallTotalSteps / totalCots).toFixed(2) 
      : '0';
    
    const qualityMetrics = {
      highQualityCount: allChainsOfThought.filter(cot => cot.steps.length >= 4).length,
      mediumQualityCount: allChainsOfThought.filter(cot => cot.steps.length >= 2 && cot.steps.length < 4).length,
      lowQualityCount: allChainsOfThought.filter(cot => cot.steps.length < 2).length,
      qualityScore: totalCots > 0 
        ? ((allChainsOfThought.filter(cot => cot.steps.length >= 4).length / totalCots) * 100).toFixed(1)
        : '0',
    };
    
    res.json({
      success: true,
      data: {
        summary: {
          totalChainsOfThought: totalCots,
          avgThinkingTime,
          avgStepsPerCot: parseFloat(avgStepsPerCot as string),
        },
        byAgent: statsByAgent,
        qualityMetrics,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 思维链事件流（Server-Sent Events）
 * 实时推送思维链更新
 */
app.get('/api/cot/events', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    let lastCOTId: string | null = null;
    
    // 定时发送思维链更新
    const interval = setInterval(() => {
      try {
        const state = engine.getState();
        const currentTurn = state.currentTurn;
        
        if (currentTurn && currentTurn.chainOfThought) {
          const cot = currentTurn.chainOfThought;
          
          // 只有当思维链 ID 变化时才发送
          if (cot.id !== lastCOTId) {
            lastCOTId = cot.id;
            
            res.write(`event: cot-update\ndata: ${JSON.stringify({
              type: 'cot-update',
              data: cot,
              timestamp: Date.now(),
            })}\n\n`);
          }
        }
      } catch (err) {
        console.error('[COT Events] Error:', err);
      }
    }, 1000); // 每秒检查一次
    
    // 客户端断开时清理
    req.on('close', () => {
      clearInterval(interval);
      console.log('[COT Events] Client disconnected');
    });
    
    // 发送初始连接确认
    res.write(`event: connected\ndata: ${JSON.stringify({
      type: 'connected',
      message: '思维链事件流已连接',
      timestamp: Date.now(),
    })}\n\n`);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 打印启动配置信息
 */
function printStartupInfo(): void {
  const provider = providerConfig.defaultProvider;
  const modelName = getCurrentModelName();
  const uiOnly = process.env.UI_ONLY === 'true';

  if (uiOnly) {
    console.log(`
╔══════════════════════════════════════════╗
║     AI 说书人委员会 · UI 预览模式        ║
╚══════════════════════════════════════════╝

🌐 访问地址: http://localhost:${PORT}
📁 UI 目录: ${path.join(__dirname, '../ui')}
🔌 API 端点: http://localhost:${PORT}/api

⚠️  UI 预览模式：AI 功能不可用，仅可查看界面
`);
  } else {
    console.log(`
╔══════════════════════════════════════════╗
║     AI 说书人委员会 · Web 服务已启动     ║
╚══════════════════════════════════════════╝

🌐 访问地址: http://localhost:${PORT}
📁 UI 目录: ${path.join(__dirname, '../ui')}
🔌 API 端点: http://localhost:${PORT}/api
`);

    // 配置信息输出
    console.log('⚙️  配置信息：');

    if (detectedServiceInfo) {
      console.log(`   检测到的本地模型服务: ${detectedServiceInfo.name}`);
      console.log(`   服务端点: ${detectedServiceInfo.endpoint}`);
    }

    console.log(`   Provider 类型: ${provider}`);
    console.log(`   模型名称: ${modelName}`);
    console.log(`   游戏语言: ${gameConfig.language}`);
    console.log(`   日志级别: ${process.env.LOG_LEVEL || 'info'}`);
    console.log(`   调试模式: ${process.env.DEBUG === 'true' ? '启用' : '禁用'}`);

    if (Object.keys(providerConfig.agentOverrides || {}).length > 0) {
      console.log('\n🎭 代理独立配置:');
      for (const [role, config] of Object.entries(providerConfig.agentOverrides || {})) {
        if (config) {
          console.log(`   ${role}: ${config.providerType}${config.model ? ` (${config.model})` : ''}`);
        }
      }
    }
  }

  console.log(`
📚 可用端点:
  GET  /api/health        健康检查
  GET  /api/state         获取游戏状态
  GET  /api/providers     获取 AI Provider 状态
  POST /api/turn          处理玩家输入
  POST /api/turn/stream   流式处理玩家输入
  POST /api/save          保存游戏
  POST /api/load          加载游戏
  POST /api/reset         重置游戏
  GET  /api/turn-count    获取回合数
  GET  /api/memories      获取记忆列表
  GET  /api/memories/search?q=关键词  搜索记忆
  
🧠 思维链 API:
  GET  /api/cot/current         获取当前思维链
  GET  /api/cot/history         获取思维链历史（支持分页和过滤）
  POST /api/cot/expand          展开指定思维链步骤
  GET  /api/cot/stats           获取思维链统计信息
  GET  /api/cot/events          思维链事件流（SSE 实时推送）
  `);
}

// 异步初始化并启动服务器
async function main(): Promise<void> {
  // 初始化 Provider 配置（支持自动检测）
  await initProviderConfig();

  // 初始化 ProviderFactory 和 GameEngine
  providerFactory = new ProviderFactory(providerConfig);
  engine = new GameEngine({
    config: gameConfig,
    providerFactory,
    dataPath,
    memoryDbPath,
    sessionId,
  });

  // 启动服务器
  app.listen(PORT, () => {
    printStartupInfo();
  });
}

// 启动应用
main().catch((error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

export { app };
