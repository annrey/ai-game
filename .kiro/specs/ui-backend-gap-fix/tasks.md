# Implementation Plan: UI-Backend Gap Fix

## Overview

Surgical edits to `ui/index.html` to close all confirmed gaps between the backend's rich state output and the frontend's rendering. No new files are introduced. All changes target the single `<script>` block and inline HTML/CSS.

## Tasks

- [x] 1. Fix CSS variable bug in `addReasoningLog`
  - Replace `var(--accent-color)` with `var(--jade-500)` for border-left and role name color
  - Replace `var(--text-color)` with `var(--jade-900)` for content text color
  - _Requirements: 1.1, 1.2_

  - [ ]* 1.1 Write unit test for CSS variable fix
    - Assert rendered entry uses `--jade-500` and `--jade-900` (not undefined vars)
    - _Requirements: 1.1, 1.2_

- [x] 2. Fix agent details double-render bug
  - In the non-streaming branch of `processInput`, remove the duplicate `.forEach` call on `agentDetails`
  - Ensure each `agentDetails` entry is passed to `addReasoningLog` exactly once
  - _Requirements: 8.1_

  - [ ]* 2.1 Write property test for agent log non-duplication
    - **Property 5: Agent log non-duplication**
    - For any array of agentDetails of length N, after a non-streaming turn completes, the reasoning log SHALL contain exactly N new entries
    - **Validates: Requirements 8.1**

- [x] 3. Add NPC roster panel HTML and CSS
  - Add `<details class="panel-section" data-panel="npcs">` block in the right panel HTML
  - Add `id="npcRoster"` container div inside the panel content
  - Add `id="summaryNPCs"` span in the summary row
  - Add CSS disposition color variants: `.quest-status.friendly`, `.quest-status.neutral`, `.quest-status.hostile`, `.quest-status.unknown`
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Implement NPC roster rendering in `updateUI`
  - Add `dispositionLabel` helper mapping `'friendly'→'友好'`, `'neutral'→'中立'`, `'hostile'→'敌对'`, `'unknown'→'未知'`
  - In `updateUI`, guard with `Array.isArray(state.presentNPCs)` and render each NPC as a `.quest-item` row showing name, disposition badge, and `currentActivity`
  - Render placeholder "当前无 NPC" when array is empty
  - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.1 Write property test for NPC roster completeness
    - **Property 1: NPC roster completeness**
    - For any non-empty array of NPCState objects, every NPC's name, disposition label, and currentActivity SHALL appear in the rendered HTML
    - **Validates: Requirements 2.1**

  - [ ]* 4.2 Write unit test for NPC empty state
    - Assert placeholder text "当前无 NPC" is rendered when `presentNPCs` is empty
    - _Requirements: 2.2_

- [x] 5. Add active plots panel HTML and implement rendering in `updateUI`
  - Add `<details class="panel-section" data-panel="plots">` block after the quests panel
  - Add `id="plotList"` container and `id="summaryPlots"` span
  - Add `plotStatusLabel` helper mapping `'active'→'进行中'`, `'foreshadowed'→'伏笔'`, `'resolved'→'已解决'`, `'hidden'→'隐藏'`
  - In `updateUI`, guard with `Array.isArray(state.activePlots)` and render each plot as a `.quest-item` with name and status badge
  - Render placeholder "暂无活跃剧情" when array is empty
  - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 5.1 Write property test for plot list completeness
    - **Property 2: Plot list completeness**
    - For any non-empty array of PlotPoint objects, every plot's name and status label SHALL appear in the rendered HTML
    - **Validates: Requirements 3.1**

  - [ ]* 5.2 Write unit test for plot empty state
    - Assert placeholder text "暂无活跃剧情" is rendered when `activePlots` is empty
    - _Requirements: 3.3_

- [x] 6. Add world time display to scene meta bar
  - Replace static time `<span>` in `.scene-meta` with `<span id="metaWorldTime">` dynamic element
  - In `updateUI`, format `state.worldTime` using `periodMap` and update `metaWorldTime` text content
  - Fall back to turn count display when `worldTime` is absent
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 6.1 Write property test for world time formatting
    - **Property 3: World time formatting**
    - For any valid GameTime object, the formatted string SHALL contain the day number and a non-empty period label
    - **Validates: Requirements 4.1**

  - [ ]* 6.2 Write unit test for world time fallback
    - Assert turn count is shown in `metaWorldTime` when `worldTime` is absent from state
    - _Requirements: 4.3_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add interactive click handler to inventory slots
  - In the inventory rendering loop inside `updateUI`, add a `click` event listener to non-empty slots
  - On click, call `processInput('检查 ' + item.name)` guarded by `!gameState.isProcessing`
  - Empty slots receive no click handler
  - _Requirements: 5.1, 5.3_

  - [ ]* 8.1 Write property test for inventory tooltip completeness
    - **Property 4: Inventory tooltip completeness**
    - For any inventory item, the rendered slot's `title` attribute SHALL contain the item's name, description (if present), and quantity
    - **Validates: Requirements 5.2**

  - [ ]* 8.2 Write unit test for inventory click handler
    - Assert `processInput` is called with `'检查 <item.name>'` when a non-empty slot is clicked
    - Assert clicking an empty slot has no effect
    - _Requirements: 5.1, 5.3_

- [x] 9. Add provider runtime indicator to sidebar
  - Add `<div class="health-indicator" id="providerIndicator">` with `id="providerDot"` and `id="providerLabel"` below the existing health dot in the sidebar HTML
  - In `refreshServerConfig`, after config is stored, read `providerRouting` and `availability` to set dot class (`online`/`offline`) and label text (`provider · model`)
  - Leave indicator in neutral state when config fetch fails
  - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.1 Write unit test for provider indicator update
    - Assert `providerLabel` text and `providerDot` class are updated correctly on config load
    - Assert neutral state when availability is unknown
    - _Requirements: 6.1, 6.3_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are confined to `ui/index.html` — no new files required
- Property tests use `fast-check` (add as dev dependency if not present)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
