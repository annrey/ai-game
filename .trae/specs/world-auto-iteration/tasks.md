# Tasks
- [x] Task 1: 引擎支持闲置状态（Idle/Tick）
  - [x] SubTask 1.1: 在 `src/engine/game-engine.ts` 中，修改 `processTurn` 和 `processStreamTurn` 方法，如果玩家输入为 `<WAIT>`，将其识别为“时间流逝”或“玩家在原地等待”。
  - [x] SubTask 1.2: 在这种情况下的上下文提取中，强调“时间在流逝，描写周围环境的自然演变”，并推进游戏时间（例如 10 分钟）。
  - [x] SubTask 1.3: 调整 `src/agents/narrator.ts` 的 Prompt，使其能够理解 `<WAIT>` 指令并描写环境与 NPC 的自然活动。

- [x] Task 2: 前端 UI 实现闲置检测与并发控制
  - [x] SubTask 2.1: 在 `ui/index.html` 的设置面板中，增加“开启自动世界演化”的复选框（默认开启）和“闲置触发时长（秒）”的下拉框或输入框（默认 30 秒）。
  - [x] SubTask 2.2: 在前端 JS 中引入 `idleTimer`。监听 `mousemove`, `keydown`, `click` 等事件来重置定时器。
  - [x] SubTask 2.3: 定时器触发时，检查当前是否正在等待后端响应（`isProcessing` 标志），如果是则跳过（避免阻塞和堆积请求）；如果否，则自动向后端发送内容为 `<WAIT>` 的请求。

- [x] Task 3: 本地大模型解析优化
  - [x] SubTask 3.1: 优化 `game-engine.ts` 中的 `resolveActionAndPushState` 方法，使其在处理 `<WAIT>` 产生的自然演变时，依然能够正确解析并更新底层状态。