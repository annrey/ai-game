# Rust 迁移第一阶段：存储层 (Memory Crate) 规范

## Why
目前 Node.js 系统中 `@openclaw/memory` 使用的是同步阻塞调用库 `better-sqlite3`，这在处理高并发读写时会严重阻塞单线程的事件循环，成为系统性能瓶颈。作为迁移的 Phase 1，我们将在 Rust 中利用 `sqlx` (纯异步) 重写存储层，以解决这一阻塞问题。

## What Changes
- 在 `newgame/crates/` 目录下新建 `memory` crate。
- 引入核心依赖：`tokio` (异步运行时), `sqlx` (数据库连接与操作), `serde` / `serde_json` (序列化), `thiserror` (错误处理)。
- 实现数据模型定义 (对应 TS 中的事件与记忆结构)。
- 定义异步 `MemoryStore` trait。
- 提供基于 `sqlx::SqlitePool` 的 `SqliteMemoryStore` 实现，封装数据库的 CRUD 操作。

## Impact
- Affected specs: 存储层的底层接口（Rust 侧）。
- Affected code: 新增 `newgame/crates/memory`。对 Node.js 现存代码暂无破坏性影响（FFI 将在后续阶段引入）。

## ADDED Requirements
### Requirement: Async SQLite Storage
系统必须提供一个纯异步的、非阻塞的 SQLite 存储实现，支持多并发读写。

#### Scenario: Success case
- **WHEN** 应用调用存储层的写操作并立即发起读操作
- **THEN** 操作应通过 tokio 异步非阻塞执行，不阻塞线程，且最终读到的数据一致。
