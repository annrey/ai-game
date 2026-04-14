# AI Storyteller Engine - Rust 迁移方案 (Rust Migration Plan)

## 1. 架构现状与性能瓶颈分析
当前系统为基于 Node.js/TypeScript 的单体架构（部分插件化）：
- **核心逻辑 (`@openclaw/core`)**：通过 `EventEmitter` 驱动事件循环，由于 Node.js 单线程模型，密集的事件分发与复杂的 AI 提示词构建可能阻塞事件循环。
- **存储层 (`@openclaw/memory`)**：使用 `better-sqlite3`（同步阻塞调用）。在高并发状态读写时会成为性能瓶颈，阻塞其他异步操作。
- **服务层 (`@openclaw/server`)**：Express 服务端，使用 Zod 验证。JSON 解析和验证在单线程下消耗较多 CPU 资源。
- **网络调用**：依赖外部或本地 LLM（OpenAI, Ollama, 本地模型），I/O 等待时间长，且大量并发连接的上下文切换带来内存消耗。

## 2. 内存与并发模型设计 (Memory & Concurrency Model)
Rust 语言天生具备内存安全与无数据竞争的并发特性，针对当前业务特性，我们采用以下设计：
- **异步运行时 (Async Runtime)**：使用 `tokio` 作为底层异步运行时。绝大多数 I/O（网络请求 LLM、数据库读写）采用异步非阻塞模型。
- **所有权与生命周期 (Ownership & Lifetimes)**：
  - **核心状态机 (State Store)**：游戏世界状态封装在 `Arc<RwLock<WorldState>>` 中。读多写少的场景下，`RwLock` 提供高并发读取。
  - **事件总线 (Event Bus)**：使用 `tokio::sync::broadcast` 或 `flume` 实现多生产者多消费者的事件通道。不再受限于单线程回调，代理(Agent)可以作为独立的 `tokio::task` 运行。
  - **内存管理**：摒弃 Node.js 的 GC 机制，利用 Rust 的 RAII 自动释放资源，消除 GC 造成的应用暂停 (STW) 现象。
- **数据库连接池**：使用 `sqlx::SqlitePool` 替代 `better-sqlite3`。实现完全异步的数据库访问，避免阻塞计算线程。

## 3. 逐模块迁移路线图与双轨运行层 (Migration Roadmap & FFI)
为了保证**零停机切换 (Zero-Downtime)**，我们将采用 **“绞杀者无花果 (Strangler Fig)”** 模式，通过 FFI (Foreign Function Interface) 逐步替换。

### 兼容层设计 (FFI / RPC)
- **初期方案**：使用 `napi-rs` 将 Rust 代码编译为 Node.js 原生模块 (`.node` 插件)。TypeScript 端通过 FFI 调用 Rust 实现的模块，两者在同一个进程内运行，平滑过渡。
- **终期方案**：彻底移除 Node.js，将整个后端切换为纯 Rust 实现的二进制文件，通过 HTTP/gRPC 提供 API 供前端或第三方调用。

### 迁移阶段规划
#### Phase 1: 存储层与状态管理 (Month 1)
- **目标**：重写 `@openclaw/memory`。
- **实施**：用 Rust + `sqlx` 封装 SQLite 操作，暴露 N-API 接口供现有 TS 代码调用。
- **收益**：解决同步 SQLite 导致的事件循环阻塞问题。

#### Phase 2: 事件总线与核心计算 (Month 2)
- **目标**：重写 `@openclaw/core/engine` (EventBus, StateStore)。
- **实施**：将事件分发逻辑用 Rust 通道 (`tokio::sync`) 实现。TS 端的 Agents 将事件发布到 Rust 核心中。
- **收益**：核心状态读写速度提升，内存占用降低。

#### Phase 3: AI 代理与规则引擎 (Month 3)
- **目标**：重写 `agents` (Narrator, NPC, Guide 等) 和 `rules`。
- **实施**：将复杂的 Prompt 构建和状态校验 (Zod 替换为 `serde` + 自定义校验) 移至 Rust。
- **收益**：大量字符串拼接与 JSON 处理在 Rust 中完成，大幅降低 CPU 负载。

#### Phase 4: 网络服务与全面替换 (Month 4)
- **目标**：重写 `@openclaw/server`，替换 Express。
- **实施**：使用 `axum` (基于 tokio) 搭建全新的 HTTP 服务。将 Vite 前端与 Rust 后端直接对接。移除 `napi-rs` 层。

## 4. 持续集成与灰度发布 (CI/CD & Canary Release)
- **持续集成 (CI)**：GitHub Actions 增加 `cargo test` 和 `cargo clippy` 检查。确保每次提交必须通过 TS 单元测试和 Rust 单元测试。
- **双轨运行与比对**：在 Phase 1~3 期间，系统中同时存在 TS 逻辑和 Rust FFI 逻辑。通过特征开关 (Feature Flags) 进行控制。
- **灰度发布**：使用 Kubernetes/Nginx 路由权重控制（Phase 4），先将 10% 流量导入纯 Rust 后端，监控错误率和响应时间。若无异常，逐步扩容至 100%。

## 5. 团队培训与长期维护计划 (Documentation & Training)
- **Rust 基础培训**：针对现有 TS 开发者，开展为期 4 周的 Rust 内部工坊，重点讲解 `所有权机制`、`生命周期`、`Option/Result 错误处理`、`异步编程 (Tokio)`。
- **代码规范**：统一应用 `rustfmt` 和严格的 `clippy` 规则，降低代码审查的沟通成本。
- **文档沉淀**：维护 `RUST_REPO_STRUCTURE.md` 以及架构决策记录 (ADR)，所有接口变更和 FFI 绑定需提交配套的 Markdown 文档。
