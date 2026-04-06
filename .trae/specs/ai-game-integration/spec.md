# AI与游戏机制深度融合 (AI Game Integration) Spec

## Why
当前游戏已经支持了自然语言的输入和基础的环境状态更新（如位置、时间）。为了让 AI 和游戏结合得更紧密，AI 不仅应该作为“叙述者”，还应该深度参与核心游戏系统（如物品栏、任务日志、角色关系）。通过结构化解析 AI 的输出，我们可以让 AI 动态给予玩家物品、扣除道具、分配任务，从而实现真正的“AI 驱动的游戏循环”。

## What Changes
- 扩展状态解析引擎（`game-engine.ts`），支持解析 `inventoryChange`（物品变动）和 `questUpdate`（任务状态变动）。
- 在游戏状态库（`state-store.ts`）中增加 `inventory`（物品栏）和 `quests`（任务系统）的结构化存储。
- 调整主叙述者或规则仲裁者（`narrator.ts` / `rule-arbiter.ts`）的 Prompt，使其能够在叙事的同时，输出物品和任务的变动指令，并且能够感知玩家当前的背包和任务状态。
- 前端 UI 增加物品栏和任务面板的展示，实时响应 AI 带来的状态更新。

## Impact
- Affected specs: 游戏状态管理、自然语言指令解析引擎、UI 面板
- Affected code: `src/engine/game-engine.ts`, `src/engine/state-store.ts`, `src/agents/narrator.ts`, `ui/index.html`

## ADDED Requirements
### Requirement: 动态物品栏系统 (Dynamic Inventory)
系统需要能够根据 AI 的叙述动态增删玩家的物品。

#### Scenario: Success case
- **WHEN** 玩家在对话中成功说服 NPC 获得一把铁剑，或者在探索时发现一个苹果
- **THEN** AI 响应的后台意图解析中包含 `inventoryChange: { item: "铁剑", action: "add", quantity: 1 }`，并且底层 StateStore 和 UI 物品栏同步更新。

### Requirement: 动态任务系统 (Dynamic Quests)
系统需要能够追踪由 AI 动态生成的任务，并推进任务状态。

#### Scenario: Success case
- **WHEN** 玩家答应村长去清理哥布林
- **THEN** AI 响应中生成任务状态 `questUpdate: { questId: "goblin_clear", title: "清理哥布林", status: "active" }`，并在 UI 的任务日志中显示。当玩家完成时，AI 再次将其更新为 `completed`。
