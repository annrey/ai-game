# Tasks

- [x] Task 1: 初始化 `memory` Crate 并配置依赖
  - [x] SubTask 1.1: 在 `newgame/crates` 下使用 Cargo 新建一个名为 `memory` 的库。
  - [x] SubTask 1.2: 在 `memory/Cargo.toml` 中添加依赖：`tokio`, `sqlx` (开启 `sqlite` 和 `runtime-tokio-rustls` features), `serde`, `serde_json`, `thiserror`, `uuid` 等。

- [x] Task 2: 定义核心数据模型与错误处理
  - [x] SubTask 2.1: 在 `src/error.rs` 中定义 `MemoryError` 枚举。
  - [x] SubTask 2.2: 在 `src/models.rs` 中定义基础数据结构（例如 `MemoryEvent`, `MemoryEntry`），并通过 `serde` 支持序列化。

- [x] Task 3: 实现异步 SQLite 存储接口
  - [x] SubTask 3.1: 在 `src/store.rs` 中定义 `MemoryStore` 异步 Trait。
  - [x] SubTask 3.2: 在 `src/sqlite.rs` 中实现 `SqliteMemoryStore` 结构体，封装 `sqlx::SqlitePool`，包含基本的初始化建表语句和基础增查接口。
  - [x] SubTask 3.3: 确保所有代码导出在 `src/lib.rs` 中。

# Task Dependencies
- Task 2 依赖于 Task 1
- Task 3 依赖于 Task 2
