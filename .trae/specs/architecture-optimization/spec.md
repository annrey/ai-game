# 架构与技术优化 (Architecture Optimization) Spec

## Why
在对当前代码库进行 Review 后，发现虽然功能已相对完善（具备思维链、记忆系统、任务和物品生成等），但在架构和技术层面上存在明显的瓶颈和技术债：
1. **前端巨石应用**：`ui/index.html` 文件过于庞大（>128KB），HTML、CSS、JS 业务逻辑（状态管理、SSE/WebSocket 通信、UI 渲染、动画效果等）全部耦合在一个文件中，可读性和可维护性极差。
2. **核心引擎“上帝类” (God Class) 问题**：`GameEngine` (`src/engine/game-engine.ts`) 承担了过多职责，代码长达 1300+ 行。它不仅处理游戏核心循环和状态分发，还直接包含：
   - 所有的成就系统逻辑（Achievements）。
   - 任务和物品的具体生成与校验逻辑。
   - 甚至包含硬编码的 LLM 解析调用（`resolveActionAndPushState`），直接使用了 `provider.chat`，这本该属于 Agent 层（如 `RuleArbiter`）的职责。
3. **工程结构缺乏模块化**：前后端代码、核心引擎、服务器逻辑混合在单一的目录结构中，未实现物理隔离，不符合现代 Monorepo 的最佳实践。这与 `ARCHITECTURE_IMPROVEMENTS.md` 中规划的目标架构有较大差距。

## What Changes
- **前端模块化重构**：
  - 拆分 `ui/index.html`：提取 CSS 到独立的样式文件，提取 JS 逻辑到独立的模块文件中（如网络层、状态层、UI 组件层）。
  - 引入轻量级的现代前端构建工具（如 Vite），实现前端代码的模块化管理和热更新。
- **GameEngine 职责解耦**：
  - 提取 `AchievementManager` 专门处理成就解锁、进度更新和事件分发。
  - 提取 `QuestManager` 和 `ItemManager` 专门负责与验证器交互及具体的生成逻辑。
  - 将 `resolveActionAndPushState` 相关的自然语言解析逻辑下沉至 `RuleArbiter`（或新建一个 `StateParserAgent`），消除引擎中对 `providerFactory.getForAgent('rule-arbiter')` 的直接硬编码调用。
- **Monorepo 架构改造 (Phase 1)**：
  - 引入 pnpm workspace 机制，开始向 `packages/core`, `packages/server`, `packages/ui` 和 `packages/shared-types` 演进。
  - [**BREAKING**] 重新梳理依赖和 `package.json` 的结构，可能需要更新现有的构建脚本（`tsup` 和 `vite`）。

## Impact
- Affected specs: 前端 UI 架构、游戏引擎核心调度机制。
- Affected code: `ui/index.html`, `src/engine/game-engine.ts`, `src/agents/rule-arbiter.ts`, 根目录 `package.json` 及构建配置。

## ADDED Requirements
### Requirement: 前端代码解耦
The system SHALL organize the frontend code into logical modules (HTML/CSS/JS).
#### Scenario: Success case
- **WHEN** 开发者需要修改聊天框样式或 WebSocket 逻辑时
- **THEN** 可以直接在特定的模块文件中修改，而无需滚动数千行的 `index.html`。

### Requirement: 核心引擎职责单一化
The system SHALL delegate secondary mechanics (achievements, parsing) to dedicated managers/agents.
#### Scenario: Success case
- **WHEN** 玩家执行一个动作导致状态改变时
- **THEN** 引擎将解析请求交给 `RuleArbiter` 处理，随后 `AchievementManager` 监听到事件并更新进度，引擎自身只负责状态合并和分发。

## MODIFIED Requirements
### Requirement: 状态解析逻辑
将 `resolveActionAndPushState` 这一硬编码方法彻底移除引擎核心，改为由代理（Agent）系统通过标准接口返回状态变更（State Deltas），引擎仅作为状态变更的执行者。
