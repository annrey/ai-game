# 向 Monorepo 和插件化架构（Plugin SDK）演进 Spec

## Why
目前项目作为一个单体架构（虽然前端已被拆分为独立子目录），但后端代码、游戏核心引擎、扩展的 AI Provider、Agents（技能/代理）和记忆系统依然紧密耦合在一起。这导致了以下痛点：
1. **扩展性差**：如果社区开发者想新增一个基于新 LLM API 的 Provider，或者自定义一个游戏模式（Mode）和技能（Skill），都需要直接修改核心代码，且缺乏统一标准。
2. **构建与依赖混乱**：随着功能叠加，全局 `package.json` 的依赖越发臃肿，前端、后端、核心库的依赖未能彻底物理隔离。
3. **版本演进困难**：缺乏一套正式的“未来发展方向”规划，难以支撑像多模态交互、多玩家联机或高级开放世界这样长远的蓝图。

## What Changes
- [**BREAKING**] 引入 `pnpm` 作为包管理工具，并创建 `pnpm-workspace.yaml` 将项目拆分为 Monorepo 架构。
- 重构目录结构：
  - `apps/`：存放具体的应用级入口（如 `server`, `cli`, `ui`）。
  - `packages/`：存放底层核心库（如 `core` 引擎, `shared-types` 共享类型, `memory` 记忆系统, `plugin-sdk` 插件系统）。
- 设计并实现 `Plugin SDK`，标准化以下扩展：
  - **Provider Extension**: 支持动态加载各类大模型接入层。
  - **Mode Extension**: 支持加载不同的游戏剧本或模式。
  - **Skill Extension**: 将各种 Agent 行为通过标准接口插件化。
- 编写详尽的 `ROADMAP.md`，从短期（架构升级）、中期（内容与模组生态）、长期（多模态与联机系统）三个维度明确未来的发展方向。

## Impact
- Affected specs: 整体工程结构、构建流程、模块依赖关系、部署与测试流程。
- Affected code: 几乎所有的 `src/` 文件都需要迁移至对应的子包（packages 或 apps）下，并更新内部引用（imports）路径。

## ADDED Requirements
### Requirement: Monorepo Support
系统必须支持通过 `pnpm workspace` 来管理多包依赖，确保各模块职责单一且能独立发布。

### Requirement: Plugin SDK Architecture
系统必须提供一套标准化的扩展接口（Plugin SDK），并在启动时动态加载这些插件，而无需硬编码在核心逻辑中。

### Requirement: 长期演进规划
系统必须提供一份清晰的 `ROADMAP.md`，用于指引社区贡献方向以及核心引擎的迭代节奏。
