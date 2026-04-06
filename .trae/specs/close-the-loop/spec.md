# Close The Loop: UI-Backend Integration Spec

## Why
目前工程的后端已经具备了复杂的委员会式代理协作、完整的世界/角色状态管理、灵活的Provider路由以及规则检定能力。然而，前端 UI 在很多地方仍是一个“看起来很炫的壳子”：右侧状态面板是静态占位符，Provider无法配置自定义URL，代理的推理过程是黑盒，缺乏健康监控和自动存档。将这些断层补齐，是让系统真正“闭环”并达到生产/沉浸可用状态的关键。

## What Changes
- **动态状态绑定**：将右侧面板的角色属性（生命/魔力等）、物品栏、世界统计数据与后端的 `/api/state` 实时打通。
- **高级模型配置**：在设置/AI架构中，为各个 Provider 增加自定义 Host/BaseURL 和 API Key 的输入接口。
- **代理推理透明化**：新增“思维链/推理日志”面板，展示各个 Agent（如 RuleArbiter 投骰子、DramaCurator 剧情评估）在后台的内部推理和争论过程。
- **健康监控与自动存档**：增加前端对 `/api/health` 的轮询指示灯，以及基于回合数触发的自动存档设置。
- **精确异常反馈**：将后端 Zod 等校验抛出的具体错误信息透传并在前端 Toast 或日志中精确显示。

## Impact
- Affected specs: UI 状态渲染机制、配置管理、日志展示。
- Affected code: `ui/index.html` (大量 UI 逻辑重构和新增), `src/server.ts` (可能的 API 补充，如暴露代理思考过程), `src/engine/game-engine.ts` (自动存档逻辑)。

## ADDED Requirements
### Requirement: 代理推理可视化 (Agent Reasoning)
The system SHALL provide a developer/debug panel or inline toggle to view the intermediate reasoning steps of the AI committee.
#### Scenario: Success case
- **WHEN** user clicks on a "View Reasoning" button for a turn.
- **THEN** the UI displays the internal thoughts of WorldKeeper, NPCDirector, RuleArbiter (including dice rolls), and DramaCurator.

### Requirement: 自动存档与健康监控
The system SHALL periodically check server health and provide an option to auto-save every N turns.
#### Scenario: Success case
- **WHEN** the server disconnects, the UI shows a red offline indicator.
- **WHEN** auto-save is enabled and N turns pass, the game saves automatically without user intervention.

## MODIFIED Requirements
### Requirement: 右侧面板数据绑定
**Original**: Right panel shows static HTML placeholders for HP, MP, Inventory, etc.
**Modified**: The UI MUST parse `stateSnapshot` from `/api/turn` and `/api/state` and dynamically update progress bars, inventory lists, and world location text.

### Requirement: Provider 接入配置
**Original**: Users can only select a Provider type and input a model name.
**Modified**: Users MUST be able to input custom BaseURLs (e.g., for LM Studio on a non-default port) and API Keys (for OpenAI or remote services).
