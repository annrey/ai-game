# AI 说书人委员会 - 架构改进规划文档

本文档基于 openclaw 主项目架构分析，结合游戏引擎特点，规划 game 项目的架构改进方向。

---

## 1. 工作区架构 (Monorepo)

### 现状
当前为单一 npm 项目，所有代码混杂在一起。

### 目标架构
```
game/
├── pnpm-workspace.yaml    # pnpm 工作区配置
├── package.json           # 根配置，仅开发依赖
├── tsconfig.json          # 共享 TS 配置
├── tsup.config.ts         # 共享构建配置
├── apps/
│   ├── server/            # Express Web 服务器
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   └── cli/               # 命令行工具
│       ├── src/
│       └── package.json
├── packages/
│   ├── core/              # 游戏引擎核心
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   ├── agents/
│   │   │   └── types/
│   │   └── package.json
│   ├── ui/                # Web UI (已存在)
│   │   ├── src/
│   │   ├── index.html
│   │   └── package.json
│   ├── shared-types/      # 共享类型定义
│   │   └── src/
│   └── memory/            # 记忆系统 SDK
│       └── src/
├── extensions/            # 可插拔扩展
│   ├── providers/         # AI Provider 扩展
│   │   ├── ollama/
│   │   ├── openai/
│   │   └── local/
│   ├── modes/             # 游戏模式扩展
│   │   ├── text-adventure/
│   │   ├── ai-battle/
│   │   └── npc-sandbox/
│   └── skills/            # Skill 扩展系统
│       └── narrator/
└── docs/                  # 文档
```

### 收益
- 模块间依赖清晰
- 独立版本管理
- 支持选择性发布
- 便于团队协作

---

## 2. 扩展系统 (Plugin SDK)

### 现状
Providers 和 Modes 硬编码在 src 中，无法动态扩展。

### 目标设计

#### 2.1 扩展接口定义
```typescript
// packages/core/src/extension.ts
interface GameExtension {
  id: string;
  version: string;
  type: 'provider' | 'mode' | 'skill' | 'memory';
  
  // 生命周期钩子
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  
  // 配置 schema
  configSchema?: ZodSchema;
}

interface ProviderExtension extends GameExtension {
  type: 'provider';
  createProvider: (config: unknown) => AIProvider;
}

interface ModeExtension extends GameExtension {
  type: 'mode';
  createGameMode: (engine: GameEngine) => GameMode;
}

interface SkillExtension extends GameExtension {
  type: 'skill';
  triggers: string[];  // 触发词
  prompt: string;      // Skill prompt
  metadata: SkillMetadata;
}
```

#### 2.2 扩展目录结构
```
extensions/{name}/
├── package.json           # 扩展元数据
├── openclaw.plugin.json   # 插件配置（参考 openclaw）
├── src/
│   └── index.ts          # 扩展入口
├── SKILL.md              # Skill 文档（如果是 skill 类型）
└── README.md
```

#### 2.3 动态加载机制
```typescript
// packages/core/src/extension-loader.ts
class ExtensionLoader {
  async loadFromDirectory(path: string): Promise<GameExtension[]>;
  async loadFromNPM(packageName: string): Promise<GameExtension>;
  async unload(extensionId: string): Promise<void>;
  
  // 扩展注册表
  get extensions(): Map<string, GameExtension>;
  get providers(): Map<string, ProviderExtension>;
  get modes(): Map<string, ModeExtension>;
  get skills(): Map<string, SkillExtension>;
}
```

---

## 3. Skill 系统

### 现状
已有简单的 SKILL.md 文件，但无运行时支持。

### 目标设计

#### 3.1 Skill 定义格式（参考 openclaw）
```markdown
---
name: narrator
description: 当需要协调叙事时触发。触发词：讲述、描述、发生了什么...
metadata:
  emoji: 📖
  requires:
    anyBins: ["ollama"]
  install:
    - id: ollama
      kind: binary
      package: ollama
      label: Install Ollama
---

# Narrator — 主控叙事 AI

你是 AI 说书人委员会的主叙述者...
```

#### 3.2 Skill 运行时
```typescript
// packages/core/src/skill-runtime.ts
class SkillRuntime {
  // 解析 SKILL.md
  parseSkill(content: string): ParsedSkill;
  
  // 触发检测
  detectTrigger(input: string, skill: Skill): boolean;
  
  // 执行 Skill
  async execute(skill: Skill, context: SkillContext): Promise<SkillResult>;
  
  // Skill 注册表
  register(skill: Skill): void;
  unregister(skillId: string): void;
}
```

#### 3.3 Skill 类型
- **Agent Skill** - 代理行为定义（如 narrator、world-keeper）
- **Action Skill** - 玩家动作处理（如战斗、交易）
- **Event Skill** - 事件响应（如随机遭遇、剧情触发）
- **Tool Skill** - 外部工具集成（如生成图片、查询数据库）

---

## 4. 记忆系统 (Memory System)

### 现状
仅有简单的 StateStore，无长期记忆能力。

### 目标设计（参考 openclaw memory-host-sdk）

#### 4.1 记忆类型
```typescript
// packages/memory/src/types.ts
interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural';
  content: string;
  embedding?: number[];      // 向量嵌入
  metadata: {
    timestamp: Date;
    importance: number;      // 0-1，用于记忆衰减
    sessionId?: string;
    tags?: string[];
  };
}

// 情节记忆 - 具体事件
interface EpisodicMemory extends Memory {
  type: 'episodic';
  scene: string;
  action: string;
  outcome: string;
}

// 语义记忆 - 事实和知识
interface SemanticMemory extends Memory {
  type: 'semantic';
  subject: string;
  predicate: string;
  object: string;
}

// 程序记忆 - 技能和规则
interface ProceduralMemory extends Memory {
  type: 'procedural';
  skill: string;
  steps: string[];
}
```

#### 4.2 记忆存储后端
```typescript
// packages/memory/src/backends/
interface MemoryBackend {
  store(memory: Memory): Promise<void>;
  retrieve(query: string, options?: RetrieveOptions): Promise<Memory[]>;
  searchByEmbedding(embedding: number[], limit?: number): Promise<Memory[]>;
  forget(memoryId: string): Promise<void>;
}

// 实现选项：
// - LanceDBBackend (参考 openclaw memory-lancedb)
// - SQLiteBackend
// - RedisBackend
// - ChromaBackend
```

#### 4.3 记忆管理器
```typescript
// packages/memory/src/manager.ts
class MemoryManager {
  constructor(
    private backend: MemoryBackend,
    private embeddingProvider: EmbeddingProvider
  );
  
  // 存储记忆
  async remember(content: string, type: MemoryType, metadata?: Partial<MemoryMetadata>);
  
  // 检索相关记忆
  async recall(query: string, context?: RecallContext): Promise<Memory[]>;
  
  // 总结长期记忆
  async summarize(sessionId: string): Promise<string>;
  
  // 记忆压缩（防止上下文过长）
  async compress(memories: Memory[]): Promise<Memory[]>;
  
  // 记忆衰减（低重要性记忆逐渐遗忘）
  async decay(): Promise<void>;
}
```

#### 4.4 与 Agent 集成
```typescript
// 在 Narrator 中使用记忆
class Narrator {
  async generateNarrative(input: string, context: Context): Promise<string> {
    // 检索相关记忆
    const relevantMemories = await this.memoryManager.recall(input, {
      sessionId: context.sessionId,
      limit: 5,
      minImportance: 0.3,
    });
    
    // 构建包含记忆的 prompt
    const prompt = this.buildPrompt(input, context, relevantMemories);
    
    return this.provider.chat(prompt);
  }
}
```

---

## 5. 构建和发布

### 5.1 构建配置
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['express', 'ollama', 'openai'],
});
```

### 5.2 发布配置
```json
// package.json
{
  "files": [
    "dist/",
    "SKILL.md",
    "README.md"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin-sdk": {
      "types": "./dist/plugin-sdk/index.d.ts",
      "default": "./dist/plugin-sdk/index.js"
    }
  }
}
```

### 5.3 Docker 支持
```dockerfile
# apps/server/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
RUN npm install --production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 6. 代码质量工具

### 6.1 必需工具
| 工具 | 用途 | 配置 |
|------|------|------|
| TypeScript | 类型检查 | strict: true |
| ESLint/Oxlint | 代码检查 | 参考 openclaw .oxlintrc.json |
| Prettier | 代码格式化 | 统一风格 |
| Vitest | 单元测试 | 参考 openclaw vitest.config.ts |
| Knip | 死代码检测 | knip.config.ts |
| Husky | Git hooks | pre-commit 检查 |

### 6.2 测试策略
```
test/
├── unit/              # 单元测试
│   ├── agents/
│   ├── engine/
│   └── providers/
├── integration/       # 集成测试
│   ├── api.test.ts
│   └── game-flow.test.ts
├── e2e/              # 端到端测试
│   └── ui.test.ts
└── fixtures/         # 测试数据
```

---

## 7. 配置管理

### 7.1 配置层级（优先级从低到高）
1. 默认值
2. 配置文件 (`game.config.json`)
3. 环境变量
4. 命令行参数
5. 运行时动态配置

### 7.2 配置 Schema
```typescript
// packages/shared-types/src/config.ts
import { z } from 'zod';

const GameConfigSchema = z.object({
  // 游戏设置
  game: z.object({
    mode: z.enum(['text-adventure', 'ai-battle', 'npc-sandbox']),
    language: z.string().default('zh-CN'),
    maxTurns: z.number().optional(),
  }),
  
  // AI 设置
  ai: z.object({
    defaultProvider: z.enum(['ollama', 'openai', 'local']),
    providers: z.record(ProviderConfigSchema),
    agents: z.record(AgentConfigSchema),
  }),
  
  // 记忆设置
  memory: z.object({
    backend: z.enum(['lancedb', 'sqlite', 'redis']),
    maxMemories: z.number().default(1000),
    decayRate: z.number().default(0.01),
  }),
  
  // 服务器设置
  server: z.object({
    port: z.number().default(3000),
    cors: z.boolean().default(true),
  }),
});

type GameConfig = z.infer<typeof GameConfigSchema>;
```

---

## 8. 日志和监控

### 8.1 日志系统
```typescript
// packages/core/src/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
  base: {
    service: 'ai-storyteller',
  },
});

// 使用
logger.info({ turn: 5, action: 'move' }, 'Player action processed');
logger.error({ err }, 'AI provider failed');
```

### 8.2 性能监控
```typescript
// 追踪 AI 调用
class AITelemetry {
  recordCall(provider: string, model: string, duration: number, tokens: number);
  recordError(provider: string, error: Error);
  getStats(): TelemetryStats;
}

// 追踪游戏事件
class GameTelemetry {
  recordEvent(event: GameEvent);
  recordTurn(turn: TurnData);
  generateReport(): GameReport;
}
```

### 8.3 OpenTelemetry 集成
```typescript
// 分布式追踪
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricExporter: new OTLPMetricExporter(),
});
```

---

## 9. 文档系统

### 9.1 文档结构
```
docs/
├── README.md              # 项目介绍
├── ARCHITECTURE.md        # 架构设计
├── API.md                 # API 文档（自动生成）
├── SKILLS.md              # Skill 开发指南
├── EXTENSIONS.md          # 扩展开发指南
├── DEPLOYMENT.md          # 部署指南
├── examples/              # 示例代码
│   ├── basic-game/
│   ├── custom-mode/
│   └── custom-provider/
└── reference/             # 参考文档
    ├── config-options.md
    └── cli-commands.md
```

### 9.2 自动生成文档
```json
// package.json
{
  "scripts": {
    "docs:api": "typedoc --out docs/api src/index.ts",
    "docs:readme": "readme-md-generator",
    "docs:serve": "vitepress dev docs",
    "docs:build": "vitepress build docs"
  }
}
```

---

## 10. 实施优先级

### Phase 1: 基础架构（1-2 周）
- [ ] 迁移到 pnpm workspace
- [ ] 统一构建配置 (tsup)
- [ ] 添加测试框架 (Vitest)
- [ ] 配置代码检查 (ESLint/Oxlint)

### Phase 2: 扩展系统（2-3 周）
- [ ] 设计 Extension SDK
- [ ] 迁移 providers 到 extensions/
- [ ] 迁移 modes 到 extensions/
- [ ] 实现动态加载机制

### Phase 3: Skill 系统（1-2 周）
- [ ] 设计 Skill 格式和运行时
- [ ] 迁移现有 SKILL.md
- [ ] 实现触发检测和执行

### Phase 4: 记忆系统（2-3 周）
- [ ] 设计 Memory API
- [ ] 实现 LanceDB 后端
- [ ] 集成到 Agents
- [ ] 记忆压缩和衰减

### Phase 5: 生产就绪（1-2 周）
- [ ] Docker 化
- [ ] CI/CD 配置
- [ ] 监控和日志
- [ ] 性能优化

---

## 参考资源

- [openclaw architecture](https://github.com/openclaw/openclaw)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [tsup documentation](https://tsup.egoist.dev/)
- [LanceDB](https://lancedb.github.io/lancedb/)
- [OpenTelemetry](https://opentelemetry.io/)

---

*文档生成时间: 2026-03-29*
*版本: 0.1.0*
