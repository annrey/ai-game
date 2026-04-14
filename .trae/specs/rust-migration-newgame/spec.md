# 开始 Rust 迁移：创建 newgame 项目 Spec

## Why
根据前期的 Rust 迁移方案，我们需要在当前项目根目录下创建一个名为 `newgame` 的文件夹，作为新 Rust 架构（Cargo Workspace）的起点，以便开始真正的代码迁移和双轨运行准备。

## What Changes
- 在项目根目录下新建 `newgame` 文件夹。
- 在 `newgame` 文件夹中初始化基础的 Cargo Workspace 配置文件（`Cargo.toml`）。
- 初始化内部的基础目录结构（如 `apps`、`crates`、`ffi` 等），对齐先前规划的架构。

## Impact
- Affected specs: 无（这是全新的迁移起点）。
- Affected code: 项目根目录将增加 `newgame` 目录及初始化的 Rust 配置文件。对现有 Node.js/TypeScript 代码无破坏性影响。

## ADDED Requirements
### Requirement: Initialize Rust Workspace
系统应该在 `newgame` 目录下提供一个标准的 Cargo 工作区，作为承载后续 Rust 模块的基础结构。

#### Scenario: Success case
- **WHEN** 开发者进入 `newgame` 目录并执行相关 Cargo 命令
- **THEN** 工作区被正确识别且没有任何报错。
