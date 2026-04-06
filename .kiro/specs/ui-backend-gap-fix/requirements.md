# Requirements: UI-Backend Gap Fix

## Overview

The backend (`src/engine/game-engine.ts`, `src/server.ts`) exposes rich game state that the frontend (`ui/index.html`) either ignores, misuses, or renders incompletely. This spec captures all confirmed gaps and the requirements to close them.

---

## Requirement 1 — CSS Variable Bug in `addReasoningLog`

**User Story:** As a player, I want the agent reasoning panel to render correctly so I can read agent deliberations without broken styling.

### Acceptance Criteria

1. WHEN `addReasoningLog` renders an entry THEN the system SHALL use `--jade-500` instead of the undefined `--accent-color` for the border and role name color.
2. WHEN `addReasoningLog` renders an entry THEN the system SHALL use `--jade-900` instead of the undefined `--text-color` for the content text color.

---

## Requirement 2 — NPC Roster Display

**User Story:** As a player, I want to see the name, disposition, and current activity of each NPC present in the scene so I can make informed decisions.

### Acceptance Criteria

1. WHEN the game state contains `presentNPCs` THEN the system SHALL render each NPC as a named row showing their `name`, `disposition`, and `currentActivity`.
2. WHEN `presentNPCs` is empty THEN the system SHALL display a placeholder message (e.g., "当前无 NPC").
3. WHEN the NPC count changes THEN the system SHALL update the roster without a full page reload.

---

## Requirement 3 — Active Plots / Drama Tracking

**User Story:** As a player, I want to see active plot threads so I can understand the current dramatic stakes.

### Acceptance Criteria

1. WHEN `activePlots` contains entries THEN the system SHALL display each plot's `name` and `status` in the right panel.
2. WHEN a plot's `status` is `active` THEN the system SHALL visually distinguish it from `foreshadowed` or `resolved` plots.
3. WHEN `activePlots` is empty THEN the system SHALL display a placeholder (e.g., "暂无活跃剧情").

---

## Requirement 4 — Game Time Display

**User Story:** As a player, I want to see the in-game time (day, hour, period) in the scene header so I have temporal context.

### Acceptance Criteria

1. WHEN `worldTime` is available in the game state THEN the system SHALL display the formatted time (e.g., "第3天 · 清晨") in the scene meta bar.
2. WHEN `worldTime` changes after a turn THEN the system SHALL update the displayed time.
3. WHEN `worldTime` is unavailable THEN the system SHALL fall back to showing the turn count.

---

## Requirement 5 — Interactive Inventory Items

**User Story:** As a player, I want to click an inventory item to use or examine it so I can interact with my belongings directly from the UI.

### Acceptance Criteria

1. WHEN a player clicks a non-empty inventory slot THEN the system SHALL submit the item name as a player action (e.g., "检查 [item name]").
2. WHEN a player hovers over an inventory slot THEN the system SHALL show a tooltip with the item's name, description, and quantity.
3. WHEN the inventory slot is empty THEN clicking it SHALL have no effect.

---

## Requirement 6 — Provider / Model Runtime Indicator

**User Story:** As a player or developer, I want to see which AI provider and model is currently active so I can understand the system's configuration at a glance.

### Acceptance Criteria

1. WHEN the server config is loaded THEN the system SHALL display the active provider name and default model in the sidebar or header.
2. WHEN the provider changes via settings THEN the system SHALL update the indicator without a page reload.
3. WHEN provider availability is unknown THEN the system SHALL show a neutral/loading state.

---

## Requirement 7 — `/api/turn-count` Endpoint Verification

**User Story:** As a developer, I want the streaming turn flow to correctly retrieve the turn count so the UI always shows the accurate turn number.

### Acceptance Criteria

1. WHEN streaming mode completes a turn THEN the system SHALL call `/api/turn-count` and update `gameState.turnCount` with the returned value.
2. WHEN `/api/turn-count` returns an error THEN the system SHALL fall back to incrementing `gameState.turnCount` locally.
3. THE `/api/turn-count` endpoint SHALL exist in `server.ts` and return `{ success: true, data: { turnCount: number } }`.

---

## Requirement 8 — Agent Details Double-Render Bug

**User Story:** As a player, I want each agent's reasoning to appear exactly once in the reasoning panel so the log is not cluttered with duplicates.

### Acceptance Criteria

1. WHEN a non-streaming turn completes THEN each `agentDetails` entry SHALL be rendered exactly once in the reasoning log.
2. WHEN a streaming turn completes THEN agent payloads received during streaming SHALL NOT be re-rendered from the final response.
