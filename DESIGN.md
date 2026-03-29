## AI 说书人委员会 — 多代理游戏引擎设计方案

### 项目概述

基于 OpenClaw 架构设计的「AI 说书人委员会」系统，是一个模块化、多代理协作的游戏引擎。多个 AI 角色各司其职，协同完成叙事、世界观维护、NPC 交互、规则判定和剧情管理。

系统支持四种游戏模式：文字冒险/互动小说、AI 对战/策略游戏、AI NPC 沙盒、AI 聊天角色扮演。

AI 后端兼容 OpenAI 风格 API、Ollama 本地推理、以及其他本地 AI 引擎（如 llama.cpp、vLLM、LM Studio 等）。

---

### 核心架构

```
game/
├── DESIGN.md                    # 本设计文档
├── package.json                 # 项目依赖
├── tsconfig.json                # TypeScript 配置
├── .env.example                 # 环境变量示例
│
├── src/
│   ├── index.ts                 # 主入口
│   ├── engine/                  # 游戏引擎核心
│   │   ├── game-engine.ts       # 引擎主控
│   │   ├── event-bus.ts         # 事件总线
│   │   ├── scene-manager.ts     # 场景管理器
│   │   └── state-store.ts       # 状态存储
│   │
│   ├── providers/               # AI Provider 抽象层
│   │   ├── base-provider.ts     # 基类接口
│   │   ├── openai-provider.ts   # OpenAI 风格 API
│   │   ├── ollama-provider.ts   # Ollama 本地
│   │   ├── local-provider.ts    # 通用本地 AI（llama.cpp / vLLM / LM Studio）
│   │   └── provider-factory.ts  # 工厂 + 路由
│   │
│   ├── agents/                  # AI 说书人委员会
│   │   ├── base-agent.ts        # 代理基类
│   │   ├── narrator.ts          # 主控 AI — 叙事协调
│   │   ├── world-keeper.ts      # 世界观守护者
│   │   ├── npc-director.ts      # NPC 导演
│   │   ├── rule-arbiter.ts      # 规则仲裁者
│   │   └── drama-curator.ts     # 剧情策划
│   │
│   ├── modes/                   # 四种游戏模式
│   │   ├── text-adventure.ts    # 文字冒险 / 互动小说
│   │   ├── ai-battle.ts         # AI 对战 / 策略游戏
│   │   ├── npc-sandbox.ts       # AI NPC 沙盒
│   │   └── chat-roleplay.ts     # AI 聊天角色扮演
│   │
│   └── types/                   # 类型定义
│       ├── scene.ts             # 场景状态
│       ├── agent.ts             # 代理接口
│       ├── provider.ts          # Provider 接口
│       └── game.ts              # 游戏全局类型
│
├── skills/                      # 技能模块（可热插拔）
│   ├── narrator/
│   │   └── SKILL.md
│   ├── world-keeper/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── world_lore.md
│   │       ├── magic_system.md
│   │       └── factions.md
│   ├── npc-director/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── npc_profiles/
│   │       ├── relationship_web.md
│   │       └── personality_models/
│   ├── rule-arbiter/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── rulebook.md
│   │       └── combat_tables/
│   └── drama-curator/
│       ├── SKILL.md
│       └── references/
│           └── plot_arcs.md
│
└── data/                        # 运行时数据
    ├── saves/                   # 存档
    └── logs/                    # 日志
```

---

### 核心组件设计

#### 1. AI Provider 抽象层

统一的接口抽象，让上层代码完全不关心底层使用哪个 AI 引擎。

```typescript
interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  isAvailable(): Promise<boolean>;
}
```

支持的后端：

| Provider | 说明 | 配置方式 |
|----------|------|----------|
| OpenAI API | 兼容所有 OpenAI 风格 API（OpenAI、DeepSeek、Moonshot 等） | `baseURL` + `apiKey` |
| Ollama | 本地 Ollama 服务 | `host`（默认 `http://localhost:11434`） |
| Local (llama.cpp) | llama.cpp server 或兼容接口 | `endpoint` |
| Local (vLLM) | vLLM 推理服务 | `endpoint` |
| Local (LM Studio) | LM Studio 本地服务 | `endpoint`（默认 `http://localhost:1234`） |

Provider 工厂根据配置自动选择后端，支持按代理角色分配不同模型（如 Narrator 用强模型，Rule-Arbiter 用快模型）。

#### 2. AI 说书人委员会（代理系统）

五个专职代理，各有明确的职责边界：

**Narrator（主控叙事）**：接收玩家输入，协调其他代理，整合响应，输出最终叙事。是整个系统的调度中枢。

**World-Keeper（世界观守护者）**：维护设定一致性，提供世界背景细节，拒绝违背设定的内容。持有世界背景、魔法规则、种族势力等参考文档。

**NPC-Director（NPC 导演）**：管理 NPC 行为、对话和关系网。根据性格模型和关系图谱生成真实的 NPC 反应。

**Rule-Arbiter（规则仲裁者）**：处理所有规则判定，包括骰子机制、战斗结算、技能检定。确保公平性和一致性。

**Drama-Curator（剧情策划）**：管理伏笔、高潮和情感曲线，确保叙事节奏。可选启用。

协作流程：

```
玩家输入 → Narrator（主控）
              │
              ├── 需要世界观确认 → 询问 World-Keeper
              ├── 需要NPC反应 → 委托 NPC-Director
              ├── 需要规则判定 → 请求 Rule-Arbiter
              ├── 需要剧情推进 → 咨询 Drama-Curator
              └── 整合所有响应 → 输出给玩家
```

#### 3. 事件驱动引擎

所有代理通过事件总线解耦通信：

```typescript
interface SceneState {
  currentLocation: string;
  presentNPCs: string[];
  activePlots: string[];
  playerActions: Action[];
  pendingResolutions: Resolution[];
  worldTime: GameTime;
  environment: EnvironmentState;
}

// 事件订阅
eventBus.on('location:change', worldKeeper.handleNewLocation);
eventBus.on('npc:should-react', npcDirector.generateReaction);
eventBus.on('combat:initiated', ruleArbiter.resolveCombat);
eventBus.on('plot:checkpoint', dramaCurator.evaluateArc);
```

#### 4. 四种游戏模式

**文字冒险模式**：经典互动小说，AI 驱动叙事分支，玩家通过文字选择推进剧情。重度依赖 Narrator + World-Keeper。

**AI 对战模式**：策略/棋类游戏，AI 作为对手或队友。重度依赖 Rule-Arbiter，Narrator 负责解说。

**NPC 沙盒模式**：开放世界探索，与智能 NPC 自由互动。重度依赖 NPC-Director + World-Keeper，所有代理全面参与。

**聊天角色扮演模式**：轻量级角色扮演对话，AI 扮演多种角色。重度依赖 NPC-Director，可选启用其他代理。

---

### 设计要点

**职责分离**：每个 AI 只负责一个明确领域，避免「什么都管」。

**上下文管理**：使用渐进式披露，只在需要时加载相关背景，控制 token 开销。

**冲突解决**：当 AI 意见冲突时，由 Narrator 或更高层仲裁。

**状态同步**：所有 AI 共享一个最小化的场景状态对象。

**模块化**：可以单独更新某个「说书人」的规则；需要新领域时添加新的 AI 角色。

**可调试**：能追踪每个决策是哪个 AI 做出的，完整日志。

**多模型灵活配置**：每个代理可以使用不同的 AI 后端和模型，根据需求在性能和质量间取舍。
