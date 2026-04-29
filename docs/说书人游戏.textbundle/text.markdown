# OpenClaw Rust + Bevy 修复与改造方案（纯文字版）

## 一、当前问题清单

### 1. Tauri 工程编译失败（阻塞）
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs:159` 使用了不存在的宏 `tauri::generate![…]`，Tauri 2 应为 `tauri::generate_handler![…]`。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs:173` 调用 `tauri::generate_context!()` 失败：`@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/tauri.conf.json` 缺少 Tauri 2 必填字段 `productName / identifier / version`，并且 `frontendDist: "../dist"` 指错（Vite 默认产物在 `newgame/dist`）。
- [tauri.conf.json](cci:7://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/tauri.conf.json:0:0-0:0) 的 `$schema` 指向 `../node_modules/@tauri-apps/cli/config.schema.json`，但 `newgame/` 下并未安装 `@tauri-apps/cli`（只有根工作区有）。

### 2. Bevy 前端只是“纸面骨架”
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/engine_bridge.rs:9-67` 的 `EngineBridge` 只是空壳：`process_input`、[get_world_state](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs:16:0-20:1)、`save_game`、`load_game`、[list_saves](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:357:0-365:1)、`initialize_engine` 全部返回占位数据，从未持有 [GameEngine](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:45:0-643:1)。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/main.rs:38-46` 启动时只把 [GameState::new()](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/event_bus.rs:10:4-14:5) 写进 `Arc<Mutex>`，UI 全部读硬编码字段，没有挂任何事件桥。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/main.rs:63-73` 的 `handle_player_input` 仅监听空格键且什么都不做。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/ui/mod.rs:312-315` 选择按钮点击后只设置 `is_processing = true`、`selected_choice = Some(i)`，没有把文本送进引擎，也无任何回执，UI 会永远卡死在“处理中”。
- `cargo check -p openclaw-bevy` 18 条 warning，多数是 `EngineBridge / convert_world_state_to_game_state / spawn_weather_particles / transition_to_scene` 等关键函数从未被调用，证明视觉与桥接两层都没接通。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/Cargo.toml:21-25` 的 `[profile.dev]` 写在子 crate 里，cargo 提示「profiles for the non root package will be ignored」，应挪到工作区根。

### 3. 核心引擎对外接口缺失
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/engine.rs:11-17` 把 `event_bus / state_store` 都包成私有 `Arc`，外部进程除了通过 `start()` 之外没有任何方式 publish/subscribe。
- 这直接导致 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:316-326` 在 [process_turn](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:303:0-326:1) 里写下「event_bus 是私有，我们假装不发布」并退化为 `format!("你做了: {}", input)` 回显。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8-14` 的 [WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 只有四个字段（`time_of_day / weather / variables / turn_count`），与 `engine_bridge.rs:100-135` 中 `convert_world_state_to_game_state` 期望读到的 `location / health / inventory / quests` 完全脱节，所以即使桥通了 HUD 也是空的。
- `engine.rs:65-73` 的 [clear_memories](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:418:0-423:1) 是 no-op、`recall_memories` 退化为 [list](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/memory/src/sqlite.rs:132:4-161:5)，与 TS 端 `@/Users/chengyongwei/Documents/openclaw-main/game/packages/memory/src/memory-manager.ts` 的能力不对等。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/agents/narrator.rs:43-85` 一旦 Ollama 不在线，[process_action](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/agents/guide.rs:42:4-55:5) 直接 `Err`，引擎只在控制台 `println!`，前端永远等不到 `narrative_generated` 事件——必须有超时 + 兜底叙事。

### 4. FFI / Server 接口错位
- `@/Users/chengyongwei/Documents/openclaw-main/game/apps/server/src/server.ts:6` 用 `RustGameEngineBridge as GameEngine` 别名导入，但同一文件 `:308 / :225 / :323 / :444 / :780` 等处仍调用 `bootstrapWorld / getConfig / getState / processTurn / getMemoryManager().getAllMemories(...)`，这些方法在 `@/Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/rust-bridge.ts` 中并未完全实现，运行时会报 “xxx is not a function”。
- `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/ffi/openclaw-node/src/engine.rs:84-99` 已经把 [event_bus.publish](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/event_bus.rs:23:4-30:5) 暴露给 Node 侧，但 Rust 端 axum server 没复用这条路径。

---

## 二、修复方案（最小代价让工程跑起来）

> 目标：`cargo check --workspace` 全绿；`cargo run -p openclaw-bevy` 能弹窗、能连真引擎、Ollama 缺席时也不卡死。

### F1. Tauri 编译修复
- 把 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs:159` 的 `tauri::generate![…]` 改为 `tauri::generate_handler![…]`。
- 在 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/tauri.conf.json` 顶层补：`"productName": "OpenClaw"`、`"version": "0.1.0"`、`"identifier": "com.openclaw.game"`；`"frontendDist": "../dist"` 改为 `"../dist"` 仍可（Vite 输出在 `newgame/dist`），但要保证 `vite.config.js` 的 `build.outDir` 与之一致。
- 把 `$schema` 改成相对 `newgame/node_modules` 的实际路径或直接删掉（`tauri::generate_context!` 不依赖该字段）。
- 在 `newgame/` 下新增 [package.json](cci:7://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/memory/package.json:0:0-0:0) 的 `devDependency` `@tauri-apps/cli`（如已存在则忽略），保证 `npm run tauri dev` 能找到 schema。

### F2. 工作区 profile 警告
- 把 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/Cargo.toml:21-25` 的 `[profile.dev]` / `[profile.dev.package."*"]` 整段移到 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/Cargo.toml`。

### F3. 暴露引擎对外 API（核心层）
在 `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/engine.rs` 增加：
- `pub fn event_bus(&self) -> Arc<EventBus>` / `pub fn state_store(&self) -> Arc<StateStore>` — 让外部进程能 publish 与 subscribe。
- `pub fn dispatch_player_input(&self, text: &str) -> Result<()>`：内部组装 `GameEvent { event_type: "player_input", payload: json!({ "text": text }) }` 并 [event_bus.publish](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/event_bus.rs:23:4-30:5)。
- `handle_event` 现有逻辑改为：当 [narrator.process_action](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/agents/guide.rs:42:4-55:5) 失败或超时（默认 30s），自动 publish 一个 `narrative_generated` 事件，`payload.content` 用兜底文案（如「（叙事服务暂时不可用，请稍后再试）」），保证 UI 能解锁。
- [WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 升级：新增 `current_location: String`、`location_description: String`、`player: PlayerStats { name, role, health, max_health, mana, max_mana, energy, max_energy }`、`inventory: Vec<InventoryItem>`、`quests: Vec<Quest>`、`scene_type: String`，与 Bevy 端 [GameState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/game_state.rs:3:0-40:1) 一一对应；保持向后兼容时 `Default` 仍可序列化。

### F4. Bevy 桥接落地（详见第三节方案 B）

---

## 三、Rust + Bevy 整体改造方案

> 把 Rust 核心做成"单一事实源"，Bevy / Tauri / Axum-Server / Node FFI 都是它的展示层。

### 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                   Bevy 主线程（ECS, 60fps）                    │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ UI 系统   │  │  视觉系统     │  │  输入系统               │ │
│  │ (egui)   │  │ (背景/天气/粒子)│  │ (键盘/选择按钮 → 事件)  │ │
│  └────┬─────┘  └────────┬──────┘  └───────────┬────────────┘ │
│       │ read            │ read                │ write         │
│       ▼                 ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │   EngineSnapshot (Resource)                              │ │
│  │   - narrative / choices / hud / status / settings        │ │
│  │   - 主线程只读，由后台 drain 系统每帧拉取                 │ │
│  └────────────────────▲────────────────────────────────────┘ │
│                       │ snapshot push                         │
│  ┌────────────────────┴────────────────────────────────────┐ │
│  │   EngineBridge (Resource)                                │ │
│  │   - cmd_tx:    flume::Sender<EngineCommand>              │ │
│  │   - snap_rx:   flume::Receiver<EngineSnapshot>           │ │
│  └────────────────────┬────────────────────────────────────┘ │
└───────────────────────┼──────────────────────────────────────┘
                        │ 跨线程
┌───────────────────────┼──────────────────────────────────────┐
│                Tokio runtime（独占线程）                      │
│  ┌────────────────────▼────────────────────────────────────┐ │
│  │   EngineRuntime                                          │ │
│  │   - GameEngine.start()  → 监听 player_input            │ │
│  │   - EventBus.subscribe → 转发 narrative_generated       │ │
│  │   - StateStore         → 提供快照                        │ │
│  │   - 命令处理：Input/Bootstrap/Save/Load/Reset/Choice    │ │
│  │   - Provider 容错：Ollama 不在则用 EchoProvider          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 改造分阶段

#### 阶段 A：核心层接口与状态扩展（1-2 天）
1. `crates/core::engine.rs` 暴露 `event_bus()` / `state_store()` / `dispatch_player_input()`，并实现叙事超时兜底（见 F3）。
2. [crates/core::state_store::WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 字段扩展（同 F3），相应 Default 给出"迷雾十字路口"初始值，让 Bevy 启动即有可读数据。
3. `crates/core::providers::mod.rs` 新增 `EchoProvider`：实现 [AIProvider](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/agents/mod.rs:27:0-29:1)，把 `messages.last().content` 加上前缀返回，作为离线开发占位。
4. `crates/core::providers::provider_factory.rs` 增加 `build_with_fallback(...)`：先 ping Ollama，不通则降级到 `EchoProvider`，对 Bevy/Tauri/Axum 三处共用。
5. 新增 `crates/core::engine::EngineHandle`（轻量 facade）：包装 `Arc<GameEngine>` + `event_bus()` + `state_store()`，是所有上层（Bevy/Tauri/Axum/FFI）应该持有的唯一入口。

#### 阶段 B：Bevy 桥接落地（2-3 天）

**B1. 新建 `src-bevy/src/runtime.rs`**
- 类型：
  ```
  pub enum EngineCommand {
      PlayerInput(String),
      ChoiceSelected { id: String, text: String },
      Bootstrap(BootstrapPayload),
      Save(String),
      Load(String),
      Reset,
      RequestSnapshot,
  }
  pub struct EngineSnapshot {
      pub narrative_delta: Option<NarrativeEntry>,  // 新到的叙事
      pub world: WorldStateSummary,                 // 当前世界状态
      pub last_error: Option<String>,
      pub pending: bool,
  }
  ```
- `EngineRuntime::spawn(cfg) -> EngineBridge`：
  1. `std::thread::spawn` 一个专用线程跑 `tokio::runtime::Builder::new_multi_thread()`。
  2. 线程内构建 `EngineHandle`（含 `EchoProvider` 兜底），调用 `engine.start()`。
  3. 订阅 `event_bus`：当收到 `narrative_generated` / `state_changed` / `turn_advanced`，先读 `state_store` 快照，组装 `EngineSnapshot` 推到 `snap_tx`。
  4. 同一 task 监听 `cmd_rx`：根据命令调用 `dispatch_player_input` / [engine.save](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:416:2-419:3) / [engine.load](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:425:2-428:3) 等，并立即 push 一个含 `pending=true` 的 snapshot 让 UI 立刻进入"处理中"。

**B2. 重写 `src-bevy/src/engine_bridge.rs`**
- 删掉占位实现，留 `EngineBridge { cmd_tx, snap_rx }` 这一对 channel；提供同步入口 `send_input`、`send_choice`、`request_snapshot`、[save](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:416:2-419:3)、[load](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:425:2-428:3)、[reset](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:435:2-444:3)。
- `convert_world_state_to_game_state` 改为 `apply_snapshot(&mut GameState, &EngineSnapshot)`，按字段增量更新而不是整表替换，这样 UI 切换不会丢用户当前滚动状态。

**B3. 重写 `src-bevy/src/main.rs`**
- `setup_game` 阶段：`EngineRuntime::spawn(...)`、把 `EngineBridge` 作为 Bevy `Resource` 注入；首屏立刻 `bridge.request_snapshot()`。
- 新增 `Update` 系统 `drain_snapshots`：每帧 `try_recv` 把 `EngineSnapshot` 应用到 [GameState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/game_state.rs:3:0-40:1)；遇到 `narrative_delta` 就 [add_narrative](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/game_state.rs:277:4-284:5)、清 `is_processing`。
- `handle_player_input` 改为：键盘回车 / 数字键 1-4 触发 `bridge.send_choice(...)`；空格快进时间。
- 选择按钮（[ui/mod.rs::render_choice_panel](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/ui/mod.rs:274:0-326:1)）的 `if button.clicked()` 改为：
  ```
  state.is_processing = true;
  state.selected_choice = Some(i);
  bridge.send_choice(choice.id.clone(), choice.text.clone());
  ```
  同时要把 `EngineBridge` 通过 `ResMut` 注入到该系统签名。

**B4. UI 增量增强**
- 新增系统 `render_top_bar`：显示连接状态（Ollama / Echo / 离线），通过 `EngineSnapshot.last_error` 渲染。
- [render_right_panel](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/ui/mod.rs:135:0-205:1)：把 `WorldStateSummary` 中的 `time_of_day / weather / location / health / inventory / quests` 真正绑定到 UI（替换硬编码）。
- [visuals::update_background_color](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/visuals/mod.rs:67:0-96:1) 的 `state.scene_type` 由 `WorldStateSummary.scene_type` 字段驱动；Ollama 离线时仍能基于规则引擎更新背景。

#### 阶段 C：Tauri 与 Axum-Server 共用同一 EngineHandle（1-2 天）
1. `crates/core` 提供 `EngineFactory::build_default(save_dir, db_url) -> EngineHandle`，三处入口都调用它。
2. [apps/server/src/main.rs::process_turn](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:303:0-326:1) 改为：`state.engine.dispatch_player_input(&payload.input)?`；订阅 `event_bus` 把 `narrative_generated` 通过 SSE 推回前端，移除 echo 占位。
3. [src-tauri/src/main.rs](cci:7://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs:0:0-0:0) 的命令在最小修复后，扩展两条：`#[tauri::command] async fn dispatch_input(state, text)` 与 `subscribe_events(window)`（用 `window.emit` 把事件回送给 Web 前端），与 Bevy 桥接互为镜像。
4. `ffi/openclaw-node/src/engine.rs` 已有 `dispatch_event` / [subscribe](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/event_bus.rs:16:4-21:5)，无需改动；只把 `CoreGameEngine` 内部构造替换成 `EngineFactory::build_default`。

#### 阶段 D：可观测性 + 健壮性（1 天）
1. `crates/core` 加 `tracing` + `tracing-subscriber`，规则执行 / 叙事调用 / Provider 失败统一打日志。
2. `EngineRuntime` 加心跳 task：每 5s 把 `state_store` 当前 turn / 时间 / 位置写入 `EngineSnapshot.heartbeat`，主线程没收到心跳超过 10s 时在右上角显示"引擎线程无响应"。
3. 给 Bevy 的 `EngineBridge` 加 `Drop`：进程退出时 `cmd_tx.send(EngineCommand::Reset)` 并 join 后台线程，避免 SQLite 连接被截断。

#### 阶段 E：场景与视觉与世界数据耦合（可选，3-5 天）
1. [crates/world::WorldManager](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/world/src/managers.rs:10:0-17:1) 通过 `EngineHandle` 注入到 `state_store`，让 [WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 的 `scene_type / weather / time_of_day` 由 `world::TerrainManager + WeatherSystem` 真实演算，而非纯字符串。
2. Bevy 端 `visuals` 增加：场景背景图（`assets/scenes/{forest,town,...}.png` + `Sprite::from_image`）、天气粒子真发射（复用 [spawn_weather_particles](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/visuals/mod.rs:181:0-231:1)，目前未挂调度）、时间叠层平滑插值。
3. 新增 `assets/audio/ambient_*.ogg`，`bevy_audio` 根据 `scene_type` 切换 BGM。

---

## 四、模块对照表

| 现有文件 | 改造动作 |
|---|---|
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/engine.rs` | 暴露 bus/store；新增 `dispatch_player_input`；叙事超时兜底；包装成 `EngineHandle` |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs` | [WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 扩字段；保持 `Default` 向后兼容 |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/providers/mod.rs` | 新增 `EchoProvider` + `build_with_fallback` |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/engine_bridge.rs` | 重写为 channel 桥；删除全部 stub |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/main.rs` | `setup_game` 启动 `EngineRuntime`；新增 `drain_snapshots` 系统 |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/ui/mod.rs` | 选择按钮调 `bridge.send_choice`；右栏改读 `WorldStateSummary` |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/visuals/mod.rs` | `scene_type`/`weather`/`time` 来自 snapshot；接 [spawn_weather_particles](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/src/visuals/mod.rs:181:0-231:1) 调度 |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-bevy/Cargo.toml` | profile 段移到工作区根 |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/src/main.rs` | `generate![]` → `generate_handler![]`；后续接 `EngineFactory` |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/src-tauri/tauri.conf.json` | 补 `productName / identifier / version` |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs` | [process_turn](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/apps/server/src/main.rs:303:0-326:1) 改为发布事件 + SSE 转发 |
| `@/Users/chengyongwei/Documents/openclaw-main/game/newgame/ffi/openclaw-node/src/engine.rs` | 内部构造换成 `EngineFactory` |

---

## 五、验证清单

- **构建**：`cargo check --workspace` 0 错误；`cargo build -p openclaw-bevy --release` 通过。
- **离线运行**：未启动 Ollama 时 `cargo run -p openclaw-bevy` 仍能弹窗、点选项后 1s 内拿到 `EchoProvider` 兜底叙事，不卡死。
- **在线运行**：本地 `ollama serve` + `ollama pull llama3` 后，点击选项能拿到真实 LLM 叙事，HUD 的 `turn_count / location / weather / time_of_day` 同步更新。
- **存档**：UI 调 [bridge.save("test")](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:416:2-419:3) 后 `data/saves/*.json` 出现新文件；调 [bridge.load(id)](cci:1://file:///Users/chengyongwei/Documents/openclaw-main/game/packages/core/src/engine/game-engine.ts:425:2-428:3) 后状态回滚。
- **三端一致**：同一存档在 Bevy / Tauri / Axum-server / Node-FFI 任一端读出 `state_store` 快照字段相同。
- **回归**：Phase 1 完成后 `cargo test --workspace` 全绿（现有 `world::managers::tests` 等不破坏）。

---

## 六、风险与取舍

| 风险 | 影响 | 缓解 |
|---|---|---|
| [WorldState](cci:2://file:///Users/chengyongwei/Documents/openclaw-main/game/newgame/crates/core/src/state_store.rs:8:0-13:1) 扩字段会让旧存档失效 | 用户当前 `data/saves/*.json` 反序列化失败 | 给所有新增字段加 `#[serde(default)]`，保证向后兼容 |
| Tokio runtime 与 Bevy 主循环互相阻塞 | UI 卡顿 | 强制 `EngineRuntime` 在独立 OS 线程，主线程只走 channel `try_recv` |
| `EchoProvider` 让用户误以为是真叙事 | 体验割裂 | UI 顶栏显式标注「离线模式·示例叙事」并用不同颜色 |
| 改 `engine.rs` 可能破坏 FFI | Node 端运行失败 | 保留旧公开方法签名；新增 API 不替换旧 API |
| Tauri 2 配置升级影响图标/打包 | 打不出安装包 | 阶段 A/B 不动 `bundle`，阶段 E 时再补 `icons/identifier` 整套 |

---

## 七、推荐执行顺序

1. **半天**：F1 + F2（让工作区构建零错误，先把 Tauri 救活）
2. **1 天**：阶段 A（核心 API + WorldState 扩展 + Echo provider）
3. **2 天**：阶段 B（Bevy 真桥接，端到端跑通"输入 → 叙事 → HUD"闭环）
4. **1 天**：阶段 C（Tauri / Axum / FFI 共用 EngineFactory，去除 echo 占位）
5. **1 天**：阶段 D（tracing + 心跳 + Drop）
6. **按需**：阶段 E（视觉 / BGM / 世界系统耦合）

完成阶段 1-4 即可让 Bevy 真正成为 Rust 核心引擎的桌面客户端，且与现有 Tauri / TS 服务器同源。阶段 E 是锦上添花，可作为后续 sprint。