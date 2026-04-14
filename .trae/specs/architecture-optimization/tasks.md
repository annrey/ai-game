# Tasks

## 前端模块化重构 (Frontend Refactoring)
- [x] Task 1: 拆分 `ui/index.html` 的结构
  - [x] SubTask 1.1: 提取内联的 `<style>` 到独立的 `ui/src/styles/main.css` 等文件中。
  - [x] SubTask 1.2: 提取主要的内联 JavaScript 逻辑（如 SSE 监听、WebSocket 连接、DOM 操作）到 `ui/src/js/` 目录中的多个模块文件。
  - [x] SubTask 1.3: 引入 Vite 作为前端构建工具（配置 `vite.config.ts` 并更新 package.json 脚本），支持前端模块化（ES Modules）。
  - [x] SubTask 1.4: 确保前端能够在 `localhost:3000` 或新端口正确加载并保持所有原有交互逻辑（包括思维链展示、动画等）。

## GameEngine 核心解耦 (Engine Decoupling)
- [x] Task 2: 提取成就系统
  - [x] SubTask 2.1: 新建 `src/engine/achievement-manager.ts` 类。
  - [x] SubTask 2.2: 将 `GameEngine` 中的 `checkTurnAchievements`, `checkSpecialAchievements` 等逻辑迁移到 `AchievementManager`，通过 `EventBus` 监听引擎事件来触发成就。
  - [x] SubTask 2.3: 更新相关的测试用例，确保成就逻辑正常。

- [x] Task 3: 提取状态解析逻辑
  - [x] SubTask 3.1: 修改 `src/agents/rule-arbiter.ts`，新增一个专门解析玩家自然语言并返回 `StateDelta`（状态变化对象）的方法。
  - [x] SubTask 3.2: 重构 `src/engine/game-engine.ts` 中的 `resolveActionAndPushState` 方法，移除直接的 LLM 提示词拼接和调用，改为调用 `rule-arbiter` 的新接口。

- [x] Task 4: 提取任务与物品生成系统
  - [x] SubTask 4.1: 新建 `src/engine/quest-manager.ts` 和 `src/engine/item-manager.ts`。
  - [x] SubTask 4.2: 迁移所有 `generateQuestFromEvent`, `triggerQuestFromPlayerAction` 及物品生成的代码。
  - [x] SubTask 4.3: 在 `GameEngine` 初始化时实例化这些 Manager，保持原有 API 接口供外部调用，或者调整外部调用方式。

## 工程结构优化 (Monorepo Preparation)
- [x] Task 5: 项目结构整理
  - [x] SubTask 5.1: 整理 `package.json` 中的依赖，将不必要的前端依赖与后端依赖分开（为未来的 Monorepo 铺垫）。
  - [x] SubTask 5.2: 检查全局的 ESLint 和 TypeScript 配置是否规范。
  - [x] SubTask 5.3: 更新现存的 `vitest` 测试用例，修复因类结构变化导致的断言错误。

# Task Dependencies
- [Task 1] 与 [Task 2/3/4] 之间可以完全并行进行。
- [Task 2] 和 [Task 4] 依赖于对 `GameEngine` 和 `EventBus` 的深刻理解。
- [Task 5] 依赖于所有代码的拆分完成，作为最后收尾。
