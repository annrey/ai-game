# 完成 Rust 迁移 Spec

## Why
当前项目处于 TypeScript 与 Rust 双轨运行状态。`newgame/` 目录中已存在基础 Rust 架构（Cargo Workspace、memory crate、core crate、FFI 层、Axum 服务器），但核心功能尚未完成。为了彻底移除 Node.js 依赖，获得 Rust 在性能、内存安全和并发方面的优势，需要完成剩余模块的迁移，并将前端与纯 Rust 后端直接对接。

## What Changes
- **完善 `game_core` crate**：补充缺失的 Agent（WorldKeeper、NPCDirector、RuleArbiter、DramaCurator）、完善 Provider 工厂模式、完成规则引擎与游戏模式的 Rust 实现
- **完善 `server` app**：将当前 Express 服务器的全部 API 端点迁移到 Axum，保持与现有前端 `api.js` 的接口兼容
- **前端对接**：保持现有 Vite + 原生 JS 前端不变，将其 API 基础地址从 Express 切换到 Axum Rust 服务器
- **移除 FFI 层**：当 Axum 服务器功能完备后，`ffi/openclaw-node` 进入仅维护状态，最终废弃
- **构建与部署**：提供 `cargo build` 一键构建 Rust 后端 + `vite build` 构建前端的完整流程

## Impact
- Affected specs: `rust-migration-newgame`, `rust-migration-phase1-memory`, `monorepo-plugin-evolution`
- Affected code: `newgame/crates/core/*`, `newgame/apps/server/*`, `apps/ui/src/js/api.js`

## ADDED Requirements

### Requirement: Core Crate 功能完备
The `game_core` crate SHALL provide all game logic previously implemented in `@openclaw/core`.

#### Scenario: Agent 系统完整
- **WHEN** 游戏引擎初始化
- **THEN** 必须包含 Narrator、WorldKeeper、NPCDirector、RuleArbiter、DramaCurator、Guide 六个代理
- **AND** 每个代理实现 `BaseAgent` trait，支持异步 `process_action`

#### Scenario: Provider 工厂
- **WHEN** 配置指定 Ollama/OpenAI/Local/LMStudio/Jan
- **THEN** `ProviderFactory` 创建对应 Provider
- **AND** 支持按角色覆盖 Provider/模型

#### Scenario: 游戏模式
- **WHEN** 切换 text-adventure / ai-battle / npc-sandbox / chat-roleplay / stardew-valley
- **THEN** 加载对应模式规则与初始状态

#### Scenario: 规则引擎
- **WHEN** 玩家执行动作
- **THEN** `RuleEngine` 按注册顺序执行 Movement/Economy/Relationship/Schedule/Quest/Item 规则
- **AND** 生成二次事件并广播

### Requirement: Axum Server API 兼容
The Rust server SHALL expose all REST endpoints previously provided by Express, maintaining request/response schema compatibility.

#### Scenario: 配置端点
- **GET** `/api/config` → 返回 gameConfig, providerRouting, runtime, availability
- **POST** `/api/config` → 接受 GameConfigPatch，更新配置并重建引擎

#### Scenario: 游戏状态
- **GET** `/api/state` → 返回当前世界状态 JSON
- **POST** `/api/turn` → 接受 `{ input }`，返回 narrative + stateSnapshot
- **POST** `/api/turn/stream` → 流式返回 narrative chunks

#### Scenario: 存档
- **GET** `/api/saves` → 列表
- **POST** `/api/save` → 创建
- **POST** `/api/load` → 加载
- **DELETE** `/api/saves/:id` → 删除

#### Scenario: 记忆
- **GET** `/api/memories` → 列表
- **GET** `/api/memories/search?q=` → 搜索
- **POST** `/api/memories/clear` → 清空

#### Scenario: 引导系统
- **GET** `/api/guide/progress` → 进度
- **POST** `/api/guide/step/start` → 开始步骤
- **POST** `/api/guide/step/complete` → 完成步骤
- **POST** `/api/guide/chat` → 与引路人对话

#### Scenario: 思维链
- **GET** `/api/cot/current` → 当前 CoT
- **GET** `/api/cot/history` → 历史（支持 limit/offset/agentRole）
- **GET** `/api/cot/stats` → 统计
- **GET** `/api/cot/events` → SSE 实时推送

### Requirement: 前端零改动对接
The existing UI SHALL work with the Rust backend without modifying business logic.

#### Scenario: API 基础地址
- **WHEN** `apps/ui/vite.config.js` 中 proxy `/api` 指向 `http://localhost:3000`
- **THEN** Axum 服务器监听 `0.0.0.0:3000`
- **AND** CORS 允许 `localhost:5173`

### Requirement: 构建与运行
Developers SHALL build and run the entire stack using standard Cargo and npm/pnpm commands.

#### Scenario: 开发模式
- **GIVEN** 运行 `cargo run --bin server` 在 `newgame/`
- **AND** 运行 `npm run dev:ui` 在根目录
- **THEN** 前端通过 proxy 访问 Rust API，功能与之前一致

#### Scenario: 生产构建
- **GIVEN** 运行 `cargo build --release --bin server`
- **AND** 运行 `vite build` 在 `apps/ui`
- **THEN** Rust 服务器二进制可独立运行，并 serve `apps/ui/dist` 静态文件

## MODIFIED Requirements

### Requirement: Memory Store 接口扩展
**现有**: `MemoryStore` trait 仅有基础 CRUD 和 list。
**修改**: 增加 `recall(query, limit)`、`get_by_type(type, limit)`、`get_by_session(session_id, limit)`、`delete_by_session(session_id)` 方法，以支持 Express 端现有的搜索和会话管理功能。

### Requirement: StateStore 持久化
**现有**: `StateStore` 使用内存 + 文件系统保存。
**修改**: 增加 SQLite 后端选项，通过 `sqlx` 将世界状态、存档、玩家进度持久化到 `data/saves.db`，替代原 `data/saves/` JSON 文件存储。

## REMOVED Requirements

### Requirement: FFI / openclaw-node 模块
**Reason**: 终期方案不再需要通过 Node.js FFI 调用 Rust。Axum HTTP 服务器直接暴露 API，前端通过 HTTP 调用。
**Migration**: `ffi/openclaw-node` 保留在仓库中但不再维护，文档中标记为废弃。后续版本可彻底删除。

### Requirement: Express Server
**Reason**: 完全被 Axum 替代。
**Migration**: `apps/server/src/server.ts` 保留作为参考，但不再启动。所有新开发基于 `newgame/apps/server`。
