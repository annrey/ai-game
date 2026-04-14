# 测试与性能基准策略 (Testing Strategy & Performance Benchmarks)

## 1. 核心测试策略 (Core Testing Strategy)

为确保从 Node.js 迁移到 Rust 后，所有原有功能完美运行并且性能提升显著（$\ge 30\%$），我们制定了“三级测试体系”：

### 1.1 单元测试 (Unit Testing)
- **等价性校验**：复用原有 `vitest` 测试用例中核心逻辑的输入输出（如 `agents` 生成结果、`rules` 验证逻辑），并将其转译为 Rust `#[test]`。
- **内存安全验证**：使用 `cargo-miri` 在 CI 环境中自动检测内存泄漏和未定义行为（Undefined Behavior），尽管纯 Safe Rust 较少出现此类问题。
- **FFI 边界测试**：针对 `napi-rs` 暴露出的 `.node` 模块接口，依然运行原有的 TypeScript 测试 (`npm run test`)，确保 FFI 边界行为和异常抛出完全一致。

### 1.2 集成测试 (Integration Testing)
- **API 契约测试 (Contract Testing)**：在 Phase 4（完全切换至 Rust `axum` 服务）时，利用已有的前端请求抓包数据和 Postman 集合，验证 `axum` 服务对外暴露的接口（HTTP/WebSocket）是否与原 Express 服务完全一致。
- **端到端 (E2E) 测试**：使用 Playwright 运行原有前端应用，分别连接旧 Node.js 后端与新 Rust 后端，比对 UI 渲染、事件触发、AI 回复流(Streaming)的一致性。
- **数据库兼容性测试**：确保 Rust `sqlx` 写入的 SQLite 数据能够被旧系统读取，反之亦然。

### 1.3 性能基准测试 (Performance Benchmarking)
- **微基准 (Micro-benchmarking)**：使用 `criterion.rs` 测试核心算法，如复杂文本模板字符串替换、事件路由分发、Zod Schema (Rust 中为 Serde 序列化/反序列化) 验证时间。目标提升 $\ge 50\%$。
- **宏观压测 (Macro-benchmarking)**：使用 `wrk` 或 `k6` 对关键接口进行压力测试。
  - **当前 Node.js 瓶颈**：事件总线积压导致高并发场景下响应延迟。
  - **Rust 目标指标**：并发 1000 玩家场景下，单节点 P99 延迟降低至少 30%，内存占用从单进程 300MB+ 降至 50MB 左右（提升幅度远超 30%）。

## 2. 性能提升 $\ge 30\%$ 的关键实施路径

### 2.1 JSON 序列化/反序列化 (Serde)
- **优化点**：Node.js 中通过 Zod 验证 JSON 负载非常消耗 CPU。
- **Rust 实现**：使用 `serde_json`，它比 V8 原生 JSON 具有更高的解析和构造效率。配合 `#[derive(Serialize, Deserialize)]` 做到零成本抽象，提升数据交互效率。

### 2.2 事件总线无锁化 (Lock-free Event Bus)
- **优化点**：Node.js 是单线程执行模型。
- **Rust 实现**：使用 `flume` 无锁并发队列处理游戏内数以千计的事件分发。多个 AI 代理处理（如 `Narrator`, `GuideAgent`）能够在不同 CPU 核心上并行执行。

### 2.3 数据库访问异步化 (Async Database Access)
- **优化点**：`better-sqlite3` 是同步的，每次数据库操作都会阻塞整个 Node.js 事件循环。
- **Rust 实现**：引入 `sqlx` 与 SQLite，启用 WAL 模式，读写分离。通过 Tokio 异步调度，在等待磁盘 IO 的同时可以继续处理其他玩家请求，极大提升吞吐量。

### 3. 测试通过标准 (Definition of Done)
1. **所有原有 TypeScript 功能** 在 `npm run test` 下（通过 FFI）100% 绿灯。
2. **纯 Rust 实现** 的 `cargo test` 覆盖率 $\ge 85\%$。
3. **宏观压测对比**：在等价硬件和压力下，Rust 版本 TPS（每秒事务数）提升 $\ge 30\%$，内存峰值占用降低 $\ge 50\%$，并且在大并发量下无阻塞 (No Event Loop Lag)。
