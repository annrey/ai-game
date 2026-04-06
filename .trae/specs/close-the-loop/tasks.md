# Tasks

- [x] Task 1: 右侧面板动态数据绑定
  - [x] SubTask 1.1: 扩展后端的 `GameEngine.getState()` 或场景数据结构，确保能输出标准的 Player Stats 和 Inventory。
  - [x] SubTask 1.2: 修改 `ui/index.html` 中的 `updateUI` 函数，解析真实状态并更新生命值、魔力和体力进度条。
  - [x] SubTask 1.3: 动态渲染右侧物品栏列表和世界统计（如地点、探索度）。

- [x] Task 2: Provider 高级配置接入
  - [x] SubTask 2.1: 在后端的 Provider 配置中明确支持 `baseURL` 和 `apiKey` 的动态更新（目前已部分支持，需确认 API 接收逻辑）。
  - [x] SubTask 2.2: 在 `ui/index.html` 的“设置”面板中，为选中的 Provider 动态显示“API Key”和“自定义接口地址”输入框。
  - [x] SubTask 2.3: 联调配置保存逻辑，确保自定义 URL 能正确让请求路由到指定地址（如局域网内的 LM Studio）。

- [x] Task 3: 代理推理透明化（思维链展示）
  - [x] SubTask 3.1: 拦截后端 Agent 委员会在生成最终旁白前的内部消息或流式中间态。
  - [x] SubTask 3.2: 在前端 UI 增加一个“查看推演”的折叠面板或侧边抽屉。
  - [x] SubTask 3.3: 将代理的内部对话（例如 Rule Arbiter 的检定结果）实时或在回合结束后推送到前端展示。

- [x] Task 4: 体验增强：自动存档、健康指示灯与精确报错
  - [x] SubTask 4.1: 在前端顶部或侧边栏新增一个 WebSocket/轮询 指示灯，对接 `/api/health`。
  - [x] SubTask 4.2: 在设置中增加“自动存档（每 X 回合）”的开关，并在前端或引擎中实现对应触发逻辑。
  - [x] SubTask 4.3: 优化前端 `safeApi` 封装，解析后端的 400/500 错误 JSON，将具体 `message` 弹窗提示给用户。

# Task Dependencies
- [Task 1] depends on nothing.
- [Task 2] depends on nothing.
- [Task 3] depends on Backend Agent logging architecture.
- [Task 4] depends on existing UI layout.
