# Design: UI-Backend Gap Fix

## Overview

The game has a TypeScript backend (`src/engine/game-engine.ts`, `src/server.ts`) that exposes rich state — NPC rosters with disposition/activity, active plot threads, in-game world time, agent reasoning details, and provider configuration — but the single-page frontend (`ui/index.html`) either ignores, partially renders, or misrenders this data. This design closes all confirmed gaps with minimal, targeted changes to the existing HTML/JS file.

No new files are introduced. All changes are surgical edits to `ui/index.html`.

---

## Architecture

The frontend is a self-contained SPA with no build step. All logic lives in a single `<script>` block. The backend exposes a REST + SSE-style streaming API.

```
Browser (ui/index.html)
  ├── updateUI(state)          ← called after every turn and on init
  ├── addReasoningLog(role, content)  ← called per agent payload
  ├── processInput(text)       ← handles streaming and non-streaming turns
  └── refreshServerConfig()   ← loads /api/config on init and settings open

Backend (src/server.ts)
  ├── GET  /api/state          → SceneState (includes worldTime, presentNPCs, activePlots)
  ├── GET  /api/config         → GameConfig + providerRouting + availability
  ├── POST /api/turn           → TurnResult { narrative, agentDetails, stateSnapshot }
  ├── POST /api/turn/stream    → NDJSON stream of { type: 'agent'|'chunk'|'done' }
  └── GET  /api/turn-count     → { success, data: { turnCount } }  ✓ exists
```

The data flow for each gap:

| Gap | Data Source | Current State | Fix |
|-----|-------------|---------------|-----|
| CSS var bug | n/a | `--accent-color`, `--text-color` undefined | Replace with `--jade-500`, `--jade-900` |
| NPC roster | `state.presentNPCs[]` | Only count shown | Render name/disposition/activity list |
| Active plots | `state.activePlots[]` | Not rendered at all | Add plots panel section |
| World time | `state.worldTime` | Not rendered | Format and show in scene meta |
| Interactive inventory | `playerState.inventory[]` | `title` tooltip only | Add click handler → `processInput` |
| Provider indicator | `/api/config` response | Not shown | Add indicator element in sidebar |
| Turn count (streaming) | `/api/turn-count` | Already called, works | Verify — no change needed |
| Agent double-render | `agentDetails` in non-streaming | Called twice on same array | Remove duplicate `.forEach` call |

---

## Components and Interfaces

### 1. `addReasoningLog(role, content)` — CSS fix

Current (broken):
```js
entry.style.borderLeft = '2px solid var(--accent-color)';
// ...
entry.innerHTML = `<div style="color: var(--accent-color);">...</div>
  <div style="color: var(--text-color);">...</div>`;
```

Fixed:
```js
entry.style.borderLeft = '2px solid var(--jade-500)';
// ...
entry.innerHTML = `<div style="color: var(--jade-500);">...</div>
  <div style="color: var(--jade-900);">...</div>`;
```

### 2. NPC Roster — `updateUI(state)`

Add a new `<details>` panel in the right panel HTML:
```html
<details class="panel-section" data-panel="npcs" open>
  <summary class="panel-summary-row focus-ring">
    <span class="panel-title">在场 NPC</span>
    <span class="panel-brief" id="summaryNPCs"></span>
    <span class="panel-chevron" aria-hidden="true">⌄</span>
  </summary>
  <div class="panel-content">
    <div id="npcRoster" style="display:flex;flex-direction:column;gap:8px;"></div>
  </div>
</details>
```

In `updateUI`, render each NPC:
```js
if (Array.isArray(state.presentNPCs)) {
  const roster = document.getElementById('npcRoster');
  if (roster) {
    roster.innerHTML = state.presentNPCs.length === 0
      ? '<div class="quest-desc" style="text-align:center;padding:10px 0;">当前无 NPC</div>'
      : state.presentNPCs.map(npc => `
          <div class="quest-item">
            <div class="quest-title">
              <span>${escapeHtml(npc.name)}</span>
              <span class="quest-status ${npc.disposition}">${dispositionLabel(npc.disposition)}</span>
            </div>
            <div class="quest-desc">${escapeHtml(npc.currentActivity || '—')}</div>
          </div>`).join('');
  }
}
```

`dispositionLabel` maps `'friendly'→'友好'`, `'neutral'→'中立'`, `'hostile'→'敌对'`, `'unknown'→'未知'`.

CSS reuses existing `.quest-item`, `.quest-title`, `.quest-status`, `.quest-desc` classes. Add disposition color variants:
```css
.quest-status.friendly  { background: rgba(92,171,124,0.3); color: var(--jade-800); }
.quest-status.neutral   { background: rgba(183,229,186,0.4); color: var(--jade-700); }
.quest-status.hostile   { background: rgba(239,68,68,0.2); color: #b91c1c; }
.quest-status.unknown   { background: rgba(156,163,175,0.3); color: #6b7280; }
```

### 3. Active Plots Panel — `updateUI(state)`

Add a `<details>` panel after the quests panel:
```html
<details class="panel-section" data-panel="plots" open>
  <summary class="panel-summary-row focus-ring">
    <span class="panel-title">活跃剧情</span>
    <span class="panel-brief" id="summaryPlots"></span>
    <span class="panel-chevron" aria-hidden="true">⌄</span>
  </summary>
  <div class="panel-content">
    <div id="plotList" style="display:flex;flex-direction:column;gap:8px;"></div>
  </div>
</details>
```

In `updateUI`:
```js
if (Array.isArray(state.activePlots)) {
  const plotList = document.getElementById('plotList');
  if (plotList) {
    plotList.innerHTML = state.activePlots.length === 0
      ? '<div class="quest-desc" style="text-align:center;padding:10px 0;">暂无活跃剧情</div>'
      : state.activePlots.map(p => `
          <div class="quest-item ${p.status === 'active' ? '' : 'completed'}">
            <div class="quest-title">
              <span>${escapeHtml(p.name)}</span>
              <span class="quest-status ${p.status === 'active' ? 'active' : 'completed'}">${plotStatusLabel(p.status)}</span>
            </div>
            <div class="quest-desc">${escapeHtml(p.description || '')}</div>
          </div>`).join('');
  }
}
```

`plotStatusLabel` maps `'active'→'进行中'`, `'foreshadowed'→'伏笔'`, `'resolved'→'已解决'`, `'hidden'→'隐藏'`.

### 4. World Time Display — `updateUI(state)`

The scene meta bar currently has hardcoded text. Replace the static `<span>` elements with dynamic ones:

```html
<!-- in .scene-meta -->
<span class="meta-badge" id="metaChapter">第一章 · 觉醒</span>
<span id="metaWorldTime">⏱️ 第1天 · 清晨</span>
```

In `updateUI`:
```js
if (state.worldTime) {
  const wt = state.worldTime;
  const periodMap = {
    dawn:'黎明', morning:'清晨', noon:'正午', afternoon:'下午',
    dusk:'黄昏', evening:'傍晚', night:'夜晚', midnight:'深夜'
  };
  const label = `⏱️ 第${wt.day}天 · ${periodMap[wt.period] || wt.period}`;
  const el = document.getElementById('metaWorldTime');
  if (el) el.textContent = label;
} else {
  const el = document.getElementById('metaWorldTime');
  if (el) el.textContent = `⏱️ 第 ${gameState.turnCount} 回合`;
}
```

### 5. Interactive Inventory — click handler

In the inventory rendering loop (already in `updateUI`), add a click listener to non-empty slots:
```js
btn.addEventListener('click', () => {
  if (!gameState.isProcessing) {
    processInput(`检查 ${item.name}`);
  }
});
```

Empty slots already have no item data; their click handler is omitted (no change needed).

### 6. Provider Runtime Indicator

Add a small indicator element in the sidebar below the health dot:
```html
<div class="health-indicator" id="providerIndicator">
  <span id="providerDot" class="health-dot"></span>
  <span id="providerLabel">—</span>
</div>
```

In `refreshServerConfig` (already called on init), after the config is stored:
```js
const routing = serverConfig?.providerRouting;
const availability = serverConfig?.availability;
if (routing) {
  const p = routing.defaultProvider || '—';
  const model = getDefaultModelFromRouting(routing) || '';
  const available = availability?.[p];
  const dot = document.getElementById('providerDot');
  const label = document.getElementById('providerLabel');
  if (dot) dot.className = `health-dot ${available === true ? 'online' : available === false ? 'offline' : ''}`;
  if (label) label.textContent = model ? `${p} · ${model}` : p;
}
```

### 7. `/api/turn-count` — already exists

Confirmed present in `server.ts` at line ~270. No backend change needed. The streaming path already calls it correctly. No fix required.

### 8. Agent Double-Render Bug

In the non-streaming branch of `processInput`, the current code:
```js
if (r.data?.agentDetails) {
  r.data.agentDetails.forEach(ad => addReasoningLog(ad.from, ad.content));
  r.data.agentDetails.forEach(ad => addReasoningLog(ad.from, ad.content)); // ← duplicate
}
```

Fix: remove the second `.forEach` call.

---

## Data Models

All data models are already defined in the backend. The UI consumes them as plain JSON:

```typescript
// Already in src/types/scene.ts
interface NPCState {
  id: string;
  name: string;
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown';
  currentActivity: string;
}

interface PlotPoint {
  id: string;
  name: string;
  status: 'hidden' | 'foreshadowed' | 'active' | 'resolved';
  description: string;
}

interface GameTime {
  day: number;
  hour: number;
  minute: number;
  period: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';
}
```

No new types are introduced.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: NPC roster completeness

*For any* non-empty array of `NPCState` objects passed to the NPC render function, every NPC's `name`, `disposition` label, and `currentActivity` SHALL appear in the rendered HTML output.

**Validates: Requirements 2.1**

### Property 2: Plot list completeness

*For any* non-empty array of `PlotPoint` objects passed to the plot render function, every plot's `name` and `status` label SHALL appear in the rendered HTML output.

**Validates: Requirements 3.1**

### Property 3: World time formatting

*For any* valid `GameTime` object, `formatWorldTime(t)` SHALL return a string containing the day number and a non-empty period label.

**Validates: Requirements 4.1**

### Property 4: Inventory tooltip completeness

*For any* inventory item, the rendered slot's `title` attribute SHALL contain the item's `name`, `description` (if present), and `quantity`.

**Validates: Requirements 5.2**

### Property 5: Agent log non-duplication

*For any* array of `agentDetails` of length N, after a non-streaming turn completes, the reasoning log SHALL contain exactly N new entries (not 2N).

**Validates: Requirements 8.1**

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| `presentNPCs` missing from state | Guard with `Array.isArray` check; skip render silently |
| `activePlots` missing from state | Guard with `Array.isArray` check; skip render silently |
| `worldTime` missing from state | Fall back to turn count display |
| Provider indicator: config fetch fails | Leave indicator in neutral/loading state |
| Inventory click while processing | Guard with `gameState.isProcessing` check |

---

## Testing Strategy

PBT is applicable for the pure rendering/formatting functions (Properties 1–5 above). The UI interaction tests (click handlers, reactivity) are better covered by example-based tests.

**Property-based testing library:** `fast-check` (already available in the JS ecosystem; can be added as a dev dependency).

**Unit tests** (example-based):
- CSS variable fix: assert rendered entry uses `--jade-500` and `--jade-900`
- NPC empty state: assert placeholder text rendered
- Plot empty state: assert placeholder text rendered
- World time fallback: assert turn count shown when `worldTime` absent
- Inventory click: assert `processInput` called with correct string
- Provider indicator: assert label and dot class update on config load
- Agent double-render: assert `addReasoningLog` called exactly N times for N agent details

**Property tests** (fast-check, min 100 iterations each):
- Property 1: `fc.array(npcArb)` → render → all names/dispositions/activities present
  - Tag: `Feature: ui-backend-gap-fix, Property 1: NPC roster completeness`
- Property 2: `fc.array(plotArb)` → render → all names/statuses present
  - Tag: `Feature: ui-backend-gap-fix, Property 2: Plot list completeness`
- Property 3: `fc.record({ day: fc.integer({min:1}), period: fc.constantFrom(...periods) })` → format → contains day + period
  - Tag: `Feature: ui-backend-gap-fix, Property 3: World time formatting`
- Property 4: `fc.record({ name: fc.string(), description: fc.option(fc.string()), quantity: fc.integer({min:1}) })` → render slot → title contains all fields
  - Tag: `Feature: ui-backend-gap-fix, Property 4: Inventory tooltip completeness`
- Property 5: `fc.array(agentDetailArb, {minLength:1})` → non-streaming turn → log entry count === array length
  - Tag: `Feature: ui-backend-gap-fix, Property 5: Agent log non-duplication`
