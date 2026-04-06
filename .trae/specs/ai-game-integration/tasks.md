# Tasks
- [x] Task 1: 扩展 StateStore 以支持物品和任务管理
  - [x] SubTask 1.1: 在 `src/engine/state-store.ts` 中定义 `InventoryItem` 和 `Quest` 相关的接口和类型。
  - [x] SubTask 1.2: 在游戏状态 `GameState` 中添加 `inventory` (数组或Map) 和 `quests` (数组或Map)。
  - [x] SubTask 1.3: 增加增删物品 (`addInventoryItem`, `removeInventoryItem`) 和更新任务状态 (`updateQuest`) 的 action 方法。

- [x] Task 2: 增强 GameEngine 的意图解析能力
  - [x] SubTask 2.1: 修改 `src/engine/game-engine.ts` 中的 `resolveActionAndPushState` 方法的 Prompt，要求 AI 额外提取 `inventoryChange` 和 `questUpdate`。
  - [x] SubTask 2.2: 在解析结果处理逻辑中，调用 StateStore 对应的方法来真正更新玩家的物品和任务。

- [x] Task 3: 优化 Narrator/Rule Arbiter 的上下文
  - [x] SubTask 3.1: 修改 `src/engine/game-engine.ts`，在生成当前场景描述上下文（`context`）时，将当前的 `inventory` 和 `quests` 状态注入进去。
  - [x] SubTask 3.2: 确保 Narrator 知道玩家目前拥有什么物品、处于什么任务阶段，以便根据上下文做出合理的反应（例如：没有钥匙就打不开门）。

- [x] Task 4: 更新前端 UI 展示
  - [x] SubTask 4.1: 在 `ui/index.html` 中添加“物品栏 (Inventory)”和“任务日志 (Quests)”的 HTML 结构。
  - [x] SubTask 4.2: 监听 `gameStateUpdated` 或类似事件，动态渲染这些面板。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1 and Task 2
