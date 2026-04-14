# AI Storyteller Engine - 完整 Rust 迁移方案总览

本文档汇总了将 `@openclaw` 核心系统从 Node.js (TypeScript) 迁移至 Rust 的所有方案与预案。基于当前架构的深入分析，我们制定了这套**平滑、零停机、高性能**的演进路径。

## 目录索引 (Deliverables)

1. **[迁移方案文档 (Migration Plan)](./MIGRATION_PLAN.md)**
   - 逐模块迁移路线图（按优先级：`memory` -> `core` -> `agents` -> `server`）
   - 依赖梳理与接口边界定义
   - 内存与并发模型设计 (Tokio 异步模型，无锁并发 Event Bus)
   - 与现有系统的 FFI 兼容层 (通过 `napi-rs` 实现的双轨运行机制)
   - 团队文档与培训计划

2. **[测试与性能基准策略 (Testing Strategy)](./TESTING_STRATEGY.md)**
   - 单元、集成、性能三级测试体系
   - 确保原有功能等价性的测试策略
   - 性能瓶颈分析与提升幅度 $\ge 30\%$ 的实施路径说明

3. **[Rust 代码仓库规划 (Rust Repo Structure)](./RUST_REPO_STRUCTURE.md)**
   - Cargo Workspace 与现行 pnpm Monorepo 映射关系
   - 模块生命周期定义与 FFI 过渡层规划
   - 目标性能对比表

4. **[上线手册与回滚预案 (Rollback Plan)](./ROLLBACK_PLAN.md)**
   - 持续集成 (CI) 要求
   - 影子流量与灰度发布 (Canary Release) 零停机切换流程
   - 紧急回滚机制 (T+5 恢复数据，T0 切回流量)

## 核心设计理念

- **渐进式演进 (Strangler Fig Pattern)**：不追求“一步到位”的重写，而是通过 FFI (`napi-rs`) 将 Rust 模块作为 Node.js 插件嵌入，逐层替换，确保业务连续性。
- **内存安全与高性能 (Safe & Fast)**：彻底告别 V8 的 GC 停顿与单线程阻塞问题，引入 `tokio` 与 `flume` 实现高并发的 AI 调度与状态管理。
- **类型一致性 (Type Parity)**：使用 `serde` 替换 `zod`，通过严格的 Rust 编译期类型检查，进一步降低运行时错误率。
