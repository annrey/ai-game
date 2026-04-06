# AI 说书人委员会 - 多代理游戏引擎

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**一个基于多 AI 代理协作的互动叙事游戏引擎**

[特性](#-特性) • [快速开始](#-快速开始) • [游戏模式](#-游戏模式) • [引导系统](#-引导系统) • [架构设计](#-架构设计) • [开发指南](#-开发指南)

</div>

---

## 📖 简介

「AI 说书人委员会」是一个创新的互动叙事游戏引擎，采用**多 AI 代理协作架构**。多个 AI 角色各司其职，协同完成叙事、世界观维护、NPC 交互、规则判定和剧情管理，为玩家提供沉浸式、动态生成的游戏体验。

### 🎮 核心特性

- **多代理协作** - 5 个 AI 代理组成"说书人委员会"，各司其职
  - 📚 **Narrator（主控叙事）** - 协调叙事节奏和玩家互动
  - 🌍 **World Keeper（世界观守护者）** - 维护世界观一致性
  - 🎭 **NPC Director（NPC 导演）** - 管理 NPC 行为和对话
  - ⚖️ **Rule Arbiter（规则仲裁者）** - 执行游戏规则和判定
  - 🎬 **Drama Curator（剧情策划）** - 设计剧情走向和冲突

- **四种游戏模式**
  - 📖 **文字冒险** - 互动小说式体验
  - ⚔️ **AI 对战** - 策略对战游戏
  - 🏙️ **NPC 沙盒** - 自由探索的开放世界
  - 💬 **角色扮演** - 深度角色互动

- **灵活的 AI 后端**
  - ☁️ **云端 AI** - OpenAI、Anthropic 等
  - 💻 **本地 AI** - Ollama、LM Studio、Jan
  - 🔌 **兼容 OpenAI API** - 支持各种兼容接口

- **✨ 全新引导系统**（最新）
  - 🧙 **专属引导角色** - "引路人"全程指导
  - 📋 **五步引导流程** - 从 AI 配置到世界探索
  - 💡 **智能提示系统** - 上下文相关的帮助
  - 📊 **进度可视化** - 清晰的进度追踪

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm 或 yarn
- AI 服务（本地或云端）

### 安装

```bash
# 克隆项目
git clone https://github.com/annrey/ai-game.git
cd ai-game/game

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置你的 AI 服务
```

### 启动游戏

```bash
# 开发模式（推荐）
npm run dev

# 启动服务器 + UI 界面
npm run server

# 仅启动 UI 服务器
npm run server:ui

# 快速测试不同模式
npm run demo              # 默认沙盒模式
npm run demo:adventure    # 文字冒险模式
npm run demo:battle       # AI 对战模式
npm run demo:sandbox      # NPC 沙盒模式
npm run demo:roleplay     # 角色扮演模式
```

---

## 🎯 游戏模式

### 1. 文字冒险模式 (Adventure)
互动小说式体验，AI 根据玩家选择动态生成剧情。

```bash
npm run demo:adventure
```

**特点：**
- 分支剧情选择
- 角色成长系统
- 多结局设计

### 2. AI 对战模式 (Battle)
策略对战游戏，AI 担任对手或裁判。

```bash
npm run demo:battle
```

**特点：**
- 回合制战斗
- AI 策略生成
- 动态平衡调整

### 3. NPC 沙盒模式 (Sandbox)
自由探索的开放世界，与 AI NPC 自由互动。

```bash
npm run demo:sandbox
```

**特点：**
- 开放世界探索
- 自然语言交互
- 动态 NPC 行为

### 4. 角色扮演模式 (Roleplay)
深度角色扮演，沉浸式剧情体验。

```bash
npm run demo:roleplay
```

**特点：**
- 角色背景定制
- 情感系统
- 关系网络

---

## 🧭 引导系统

**全新功能！** 完善的引导系统帮助新玩家从零开始，一步步配置 AI 并创建自己的世界。

### 引导流程

```
1️⃣ AI 配置引导
   ├─ 选择本地 AI 或在线 AI
   ├─ 配置服务端点/API 密钥
   └─ 测试连接

2️⃣ 基础设置引导
   ├─ 创建角色名称
   ├─ 设置世界名称
   └─ 选择世界类型

3️⃣ 世界初始化引导
   ├─ 生成初始场景
   ├─ 安排 NPC
   └─ 设置基础规则

4️⃣ 基础功能教学
   ├─ 移动操作
   ├─ 对话交互
   └─ 环境观察

5️⃣ 进阶功能引导
   ├─ 物品栏管理
   └─ 任务系统
```

### 引导界面

<div align="center">

**右侧面板 - 引导区域**
- 📊 进度条显示完成度
- 💬 引导对话框（"引路人"发言）
- 🎯 当前步骤提示
- ⚡ 快捷操作按钮（开始/下一步/跳过/提示）

</div>

### 与引路人对话

随时在引导输入框中输入问题，例如：
- "本地 AI 和在线 AI 有什么区别？"
- "LM Studio 怎么配置？"
- "怎么和 NPC 说话？"
- "物品栏在哪里？"

---

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    玩家界面 (UI)                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server (Express)                   │
│  /api/guide/*  /api/narrative  /api/npcs  /api/action   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    游戏引擎核心                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ GameEngine   │  │ EventManager │  │ StateStore   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │SceneManager  │  │ MemorySystem │  │ RuleEngine   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 AI 说书人委员会 (Agents)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Narrator  │ │World     │ │NPC       │ │Rule      │   │
│  │(主控)    │ │Keeper    │ │Director  │ │Arbiter   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐                              │
│  │Drama     │ │Guide     │                              │
│  │Curator   │ │Agent     │                              │
│  └──────────┘ └──────────┘                              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  AI Provider 抽象层                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │OpenAI    │ │Ollama    │ │LM Studio │ │Jan       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 核心模块

#### 1. 游戏引擎 (GameEngine)
- 游戏状态管理
- 事件协调
- 时间系统
- 存档/读档

#### 2. AI 代理层 (Agents)
每个代理都有专门的职责和提示词模板：

```typescript
// 示例：使用引导代理
const guideAgent = new GuideAgent(guideManager, provider);
const response = await guideAgent.chat("如何配置本地 AI？");
```

#### 3. 记忆系统 (MemorySystem)
- 短期记忆 - 当前会话上下文
- 长期记忆 - 持久化存储
- 语义检索 - 向量相似度搜索

#### 4. 规则引擎 (RuleEngine)
- 动作验证
- 效果计算
- 成就追踪

---

## ⚙️ AI 服务配置

### 本地 AI（推荐新手）

#### LM Studio（最友好）
1. 下载并安装 [LM Studio](https://lmstudio.ai/)
2. 下载模型（推荐 Llama 系列）
3. 点击 "Start Server"
4. 配置：
   ```
   AI_PROVIDER=local
   LOCAL_MODEL_ENDPOINT=http://localhost:1234/v1
   LOCAL_MODEL_NAME=llama-3.2-3b-instruct
   ```

#### Ollama（性能优秀）
1. 安装 [Ollama](https://ollama.ai/)
2. 下载模型：`ollama pull llama3.2`
3. 配置：
   ```
   AI_PROVIDER=ollama
   OLLAMA_MODEL=llama3.2
   ```

### 云端 AI

#### OpenAI
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
```

#### Anthropic (Claude)
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

---

## 🛠️ 开发指南

### 项目结构

```
game/
├── src/
│   ├── engine/           # 游戏引擎核心
│   │   ├── game-engine.ts
│   │   ├── guide-manager.ts      # ✨ 引导管理器
│   │   ├── event-bus.ts
│   │   ├── scene-manager.ts
│   │   ├── state-store.ts
│   │   └── memory-system.ts
│   │
│   ├── agents/           # AI 代理
│   │   ├── base-agent.ts
│   │   ├── narrator.ts
│   │   ├── world-keeper.ts
│   │   ├── npc-director.ts
│   │   ├── rule-arbiter.ts
│   │   ├── drama-curator.ts
│   │   └── guide-agent.ts        # ✨ 引导代理
│   │
│   ├── providers/        # AI Provider
│   │   ├── base-provider.ts
│   │   ├── openai-provider.ts
│   │   ├── ollama-provider.ts
│   │   └── local-provider.ts
│   │
│   ├── types/            # 类型定义
│   │   ├── game.ts
│   │   ├── agent.ts
│   │   ├── guide.ts              # ✨ 引导类型
│   │   └── scene.ts
│   │
│   ├── modes/            # 游戏模式
│   │   ├── text-adventure.ts
│   │   ├── ai-battle.ts
│   │   ├── npc-sandbox.ts
│   │   └── chat-roleplay.ts
│   │
│   ├── ui/               # UI 界面
│   │   └── index.html
│   │
│   ├── server.ts         # API 服务器
│   └── index.ts          # 主入口
│
├── .trae/specs/          # 规格文档
│   └── guide-system/     # ✨ 引导系统规格
│       ├── spec.md
│       ├── tasks.md
│       └── checklist.md
│
├── package.json
└── README.md
```

### 添加新的游戏模式

1. 在 `src/modes/` 创建新模式文件
2. 继承 `BaseGameMode` 类
3. 实现必需的方法
4. 在 `game-engine.ts` 中注册

### 创建自定义 AI 代理

```typescript
import { BaseAgent } from './agents/base-agent.js';

export class CustomAgent extends BaseAgent {
  async process(request: AgentRequest): Promise<AgentResponse> {
    // 实现你的逻辑
    const response = await this.generateResponse(request);
    return response;
  }
}
```

### 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 测试覆盖率
npm run test:coverage

# 本地 AI 测试
npm run test:local
```

---

## 📚 文档

- [设计文档](DESIGN.md) - 详细的架构设计
- [本地 AI 配置指南](LOCAL-AI-SETUP.md) - 本地 AI 服务配置
- [架构改进说明](ARCHITECTURE_IMPROVEMENTS.md) - 架构优化记录
- [优化报告](OPTIMIZATION_REPORT.md) - 性能优化总结

---

## 🔧 常用命令

```bash
# 开发
npm run dev              # 开发模式
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 服务器
npm run server           # 启动 API 服务器
npm run server:ui        # 仅 UI 服务器
npm run server:watch     # 监听模式

# 测试
npm run demo             # 快速演示
npm run demo:sandbox     # 沙盒演示
npm run test             # 运行测试

# Docker
npm run docker:build     # 构建 Docker 镜像
npm run docker:up        # 启动 Docker 容器
npm run docker:down      # 停止 Docker 容器
```

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 更新日志

### v0.1.0 (当前版本)
- ✨ **新增引导系统** - 完整的五步引导流程
- 🧙 **专属引导角色** - "引路人"AI 代理
- 📊 **UI 引导界面** - 进度条、对话框、操作按钮
- 🔌 **引导 API** - 6 个新的 API 端点
- 📝 **类型定义** - 完整的 TypeScript 类型
- 💾 **进度持久化** - 保存和加载引导进度

### v0.0.1 (初始版本)
- 核心游戏引擎
- 多代理架构
- 四种游戏模式
- AI Provider 抽象层
- 记忆系统
- 规则引擎

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🙏 致谢

- 感谢所有为开源社区做出贡献的开发者
- 基于 OpenClaw 架构设计
- 使用优秀的 AI 模型提供商的服务

---

<div align="center">

**🎮 准备好开始你的冒险了吗？**

[开始使用](#-快速开始) • [查看示例](#-游戏模式) • [阅读文档](#-文档)

</div>
