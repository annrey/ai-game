/**
 * AI 说书人委员会 — Web 服务器
 * 提供静态文件服务和游戏 API
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameEngine } from './engine/game-engine.js';
import { ProviderFactory } from './providers/provider-factory.js';
import type { GameConfig } from './types/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化游戏引擎
const providerFactory = ProviderFactory.fromEnv();

const gameConfig: GameConfig = {
  mode: 'text-adventure',
  enabledAgents: ['world-keeper', 'npc-director', 'rule-arbiter', 'drama-curator'],
  logging: true,
};

const engine = new GameEngine({
  config: gameConfig,
  providerFactory,
  dataPath: './data/saves',
  memoryDbPath: './data/memories.db',
  sessionId: `session-${Date.now()}`,
});

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../ui')));

// API 路由

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

    const stream = engine.processStreamTurn(input);
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
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

// 获取记忆列表
app.get('/api/memories', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
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

// 搜索记忆
app.get('/api/memories/search', (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'query parameter "q" is required' });
      return;
    }
    const mm = engine.getMemoryManager();
    const memories = mm.recall(query, { limit: 20 });
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     AI 说书人委员会 · Web 服务已启动     ║
╚══════════════════════════════════════════╝

🌐 访问地址: http://localhost:${PORT}
📁 UI 目录: ${path.join(__dirname, '../ui')}
🔌 API 端点: http://localhost:${PORT}/api

可用端点:
  GET  /api/health        健康检查
  GET  /api/state         获取游戏状态
  GET  /api/providers     获取 AI Provider 状态
  POST /api/turn          处理玩家输入
  POST /api/turn/stream   流式处理玩家输入
  POST /api/save          保存游戏
  POST /api/load          加载游戏
  POST /api/reset         重置游戏
  GET  /api/turn-count    获取回合数
  GET  /api/memories       获取记忆列表
  GET  /api/memories/search?q=关键词  搜索记忆
  `);
});

export { app };
