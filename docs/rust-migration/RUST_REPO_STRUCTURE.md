# Rust 代码仓库结构与迁移计划 (Rust Repo Structure Plan)

## 1. 目标 Rust 工作区结构 (Target Cargo Workspace)

我们将采用 Cargo Workspace 结构，与当前的 pnpm monorepo 保持一致。

```text
openclaw-rs/
├── Cargo.toml                  # Workspace 配置
├── apps/
│   └── server/                 # 对应 @openclaw/server (axum)
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs         # HTTP 服务入口
│           ├── routes.rs       # 路由定义
│           └── handlers.rs     # 请求处理逻辑
├── crates/
│   ├── core/                   # 对应 @openclaw/core
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── engine/         # GameEngine, EventBus
│   │       ├── agents/         # Narrator, NPC, Guide
│   │       ├── rules/          # 规则引擎
│   │       └── providers/      # LLM Providers (OpenAI, Ollama)
│   ├── memory/                 # 对应 @openclaw/memory
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── store.rs        # 封装 sqlx 逻辑
│   │       └── migrations/     # SQLite 迁移文件
│   ├── shared-types/           # 对应 @openclaw/shared-types
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs       # serde 定义的数据结构
│   │       └── events.rs       # 事件定义
│   └── plugin-sdk/             # 对应 @openclaw/plugin-sdk
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs
└── ffi/
    └── openclaw-node/          # Node.js FFI 兼容层 (napi-rs)
        ├── Cargo.toml
        ├── package.json
        └── src/
            ├── lib.rs          # 导出给 TS 的接口
            └── bridge.rs       # 转换 Rust 结构到 JS 对象
```

## 2. 模块边界与接口定义 (Module Boundaries & Interfaces)

### 2.1 `shared-types` 模块
- **职责**：定义所有跨模块传输的数据结构 (Data Transfer Objects)。
- **实现**：使用 `serde` 宏 (`#[derive(Serialize, Deserialize, Clone, Debug)]`)。完全替代 TypeScript 中的 `zod` schema，在编译期保证类型安全。

### 2.2 `memory` 模块
- **职责**：处理 SQLite 读写。
- **接口**：暴露异步 trait，例如 `MemoryStore`。
  ```rust
  #[async_trait]
  pub trait MemoryStore: Send + Sync {
      async fn save_event(&self, event: Event) -> Result<(), Error>;
      async fn load_events(&self, limit: usize) -> Result<Vec<Event>, Error>;
  }
  ```

### 2.3 `core` 模块
- **职责**：包含游戏引擎、事件总线、Agent 逻辑。
- **并发设计**：
  - Event Bus：`tokio::sync::broadcast::channel`。
  - Game State：`Arc<RwLock<WorldState>>`。
- **LLM 交互**：使用 `reqwest` 异步请求 OpenAI/Ollama，并使用 `tokio_stream` 处理 SSE 响应（打字机效果）。

### 2.4 `ffi/openclaw-node` 模块 (过渡期专用)
- **职责**：将 Rust 逻辑包装为 Node.js 原生模块 (`.node` 文件)。
- **实现**：依赖 `napi-rs`。在 TypeScript 中：
  ```typescript
  import { GameEngineRust } from './openclaw-node.node';
  const engine = new GameEngineRust();
  ```
- **生命周期**：在 Phase 4（完全切换到 `axum` 服务）完成后，此模块将被废弃并移除。

## 3. 性能基准预期 (Expected Performance Benchmarks)

由于采用了纯异步的 Tokio 运行时与无锁队列，相较于目前的 Express + better-sqlite3，预期在以下指标上实现提升：

| 指标 | 当前 Node.js (估算值) | 目标 Rust (估算值) | 提升幅度 |
| :--- | :--- | :--- | :--- |
| **单机并发连接数** | ~5,000 | >50,000 | 10x |
| **Event Bus 分发延迟 (P99)** | ~15ms (受单线程 GC 影响) | <1ms | >90% |
| **JSON 序列化/反序列化速度** | 较慢 (V8 JSON.parse + Zod) | 极快 (Serde) | ~300% |
| **内存占用 (空闲时)** | ~150 MB | ~20 MB | >80% |
| **数据库写入阻塞** | 会阻塞事件循环 | 异步无阻塞 (sqlx) | TPS 提升 50% |
