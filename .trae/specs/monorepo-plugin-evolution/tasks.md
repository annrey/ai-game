# Tasks

- [x] Task 1: 编写未来发展方向规划 (ROADMAP.md)
  - [x] SubTask 1.1: 梳理当前项目现状及单体架构痛点。
  - [x] SubTask 1.2: 制定 Phase 1（近期）：Monorepo 重构与插件化核心（Plugin SDK）。
  - [x] SubTask 1.3: 制定 Phase 2（中期）：模组生态（Modding）、长期记忆深度演进、多模态互动（如接入生图/TTS）。
  - [x] SubTask 1.4: 制定 Phase 3（远期）：多玩家联机跑团、完全开放世界模拟器、高级推理架构（如多 Agent 辩论决策）。
  - [x] SubTask 1.5: 撰写并保存至根目录的 `ROADMAP.md` 文件。

- [x] Task 2: 初始化 pnpm workspace 结构
  - [x] SubTask 2.1: 在根目录创建 `pnpm-workspace.yaml`，配置 `packages/*` 和 `apps/*`。
  - [x] SubTask 2.2: 更新根目录 `package.json`，清理多余的业务依赖，转变为仅保留全局构建/代码检查工具的聚合包。

- [x] Task 3: 拆分基础 packages 和 apps
  - [x] SubTask 3.1: 创建 `packages/shared-types` 目录并迁移现有的 `src/types` 文件。
  - [x] SubTask 3.2: 创建 `packages/core` 目录并迁移 `src/engine`, `src/agents`, `src/validators` 等核心逻辑。
  - [x] SubTask 3.3: 创建 `packages/memory` 目录并迁移现有的记忆库系统。
  - [x] SubTask 3.4: 创建 `apps/server` 目录并迁移 `src/server.ts` 和相关路由。
  - [x] SubTask 3.5: 将现有的 `ui` 目录重命名或迁移为 `apps/ui`。

- [x] Task 4: 设计与实现基础 Plugin SDK
  - [x] SubTask 4.1: 创建 `packages/plugin-sdk` 并在其中定义 `GameExtension`（包含 `ProviderExtension`, `ModeExtension`, `SkillExtension`）的 TypeScript 接口。
  - [x] SubTask 4.2: 在 `packages/core` 中实现一个 `ExtensionLoader`，支持从特定目录（如 `extensions/`）或通过 NPM 模块动态加载并注册这些扩展。
  - [x] SubTask 4.3: 试水迁移一个现有的 Provider（如 local-provider）为 Plugin 形式，验证架构可行性。

- [x] Task 5: 修复与验证 Monorepo 构建
  - [x] SubTask 5.1: 修复拆分后所有模块之间的 `import` 路径（使用类似 `@openclaw/core`, `@openclaw/shared-types` 的命名空间）。
  - [x] SubTask 5.2: 配置子模块各自的 `package.json` 依赖和 `tsconfig.json`（可从根目录继承）。
  - [x] SubTask 5.3: 更新全局和局部的构建脚本（`build`, `dev`, `test`）。
  - [x] SubTask 5.4: 确保 `pnpm test` 通过，前后端能够通过 `pnpm dev` 正常启动运行。

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 3] and [Task 4]
