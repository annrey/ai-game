# Bevy 引擎桥接文档

## 概述

本文档描述 Rust 游戏核心引擎与 Bevy 前端之间的桥接机制，包括运行时架构、状态同步和事件处理。

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Bevy Frontend                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   UI Layer  │  │  Game State │  │  Keyboard Shortcuts │  │
│  │  (Egui)     │  │  Resource   │  │  (1-4/Esc/Ctrl+S)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      EngineBridge                            │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   cmd_tx        │───▶│      EngineRuntime (Tokio)      │ │
│  │  (flume::Sender) │    │  ┌──────────┐  ┌──────────────┐ │ │
│  └─────────────────┘    │  │  Engine  │  │  StateStore   │ │ │
│  ┌─────────────────┐    │  │  Handle  │  │   (RwLock)    │ │ │
│  │   snap_rx       │◀───│  └──────────┘  └──────────────┘ │ │
│  │ (flume::Receiver)│   │         │              │          │ │
│  └─────────────────┘    │         ▼              ▼          │ │
│                         │  ┌──────────┐  ┌──────────────┐   │ │
│                         │  │  Event   │  │  Narrator    │   │ │
│                         │  │   Bus    │  │  Providers   │   │ │
│                         │  └──────────┘  └──────────────┘   │ │
│                         └─────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### EngineBridge

位于 `src-bevy/src/runtime.rs:114`，是 Bevy 与后台 Tokio 运行时的桥梁：

```rust
pub struct EngineBridge {
    pub cmd_tx: flume::Sender<EngineCommand>,      // 发送命令到引擎
    pub snap_rx: flume::Receiver<EngineSnapshot>,  // 接收状态快照
    shutdown_tx: Option<flume::Sender<()>>,       // 优雅关闭信号
    thread_handle: Option<std::thread::JoinHandle<()>>, // 运行时线程
}
```

### 命令类型

```rust
pub enum EngineCommand {
    PlayerInput(String),           // 玩家文本输入
    ChoiceSelected { id, text },   // 选择选项（支持数字键 1-4）
    Bootstrap(BootstrapPayload),   // 初始化游戏世界
    Save(String),                  // 保存游戏（Ctrl+S）
    Load(String),                  // 加载存档
    Reset,                         // 重置游戏
    RequestSnapshot,               // 请求状态快照
    Shutdown,                      // 关闭引擎
}
```

### 状态快照

```rust
pub struct EngineSnapshot {
    pub world: WorldStateSnapshot,    // 世界状态
    pub narrative_delta: Option<NarrativeDelta>, // 叙事更新
    pub error: Option<String>,        // 错误信息
    pub pending: bool,                // 是否处理中
    pub backend: BackendKind,           // AI 后端类型
}
```

## 状态同步机制

### 1. 初始化同步

```rust
fn setup_game(
    mut commands: Commands,
    mut bridge_res: ResMut<EngineBridgeResource>,
) {
    let bridge = EngineRuntime::spawn(RuntimeConfig::default());
    // 立即推送初始快照
    bridge_res.bridge = bridge;
}
```

### 2. 每帧同步 (Update)

```rust
fn drain_snapshots(
    mut game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    while let Ok(snapshot) = engine_bridge.bridge.snap_rx.try_recv() {
        let mut state = game_state.state.lock().unwrap();
        state.is_processing = snapshot.pending;
        
        if let Some(narrative) = snapshot.narrative_delta {
            state.add_narrative(narrative.content, narrative.is_player);
        }
        // ... 更新其他状态字段
    }
}
```

### 3. 视觉状态同步

```rust
fn sync_scene_visual_from_game_state(
    game_state: Res<GameStateResource>,
    mut visual_state: ResMut<SceneVisualState>,
) {
    let state = game_state.state.lock().unwrap();
    
    if state.scene_type != visual_state.current_scene {
        visual_state.current_scene = state.scene_type;
        // 触发场景切换动画
    }
}
```

## 键盘快捷键

位于 `src-bevy/src/main.rs:246`：

| 按键 | 功能 | 实现 |
|------|------|------|
| `1-4` | 选择选项 | 发送 `ChoiceSelected` 命令 |
| `Esc` | 取消/返回 | 预留接口 |
| `Ctrl+S` | 快速保存 | 发送 `Save` 命令 |

## 并发安全

### 状态访问模式

```rust
// 读操作
let state = game_state.state.lock().unwrap();
let location = state.location_name.clone();
drop(state); // 尽快释放锁

// 写操作
let mut state = game_state.state.lock().unwrap();
state.turn_count += 1;
```

### 后台运行时线程

- 独立 Tokio 运行时，2 个 worker 线程
- 使用 `flume` 无锁 channel 通信
- Semaphore 限制最大并发操作（100）

## 性能优化

1. **快照批处理**：`try_recv()` 循环消费所有可用快照
2. **条件更新**：只在状态变化时更新视觉状态
3. **非阻塞发送**：命令发送永不阻塞主线程

## 调试技巧

```bash
# 启用详细日志
RUST_LOG=debug cargo run -p openclaw-bevy

# 仅查看引擎日志
RUST_LOG=game_core=trace cargo run -p openclaw-bevy
```

## 常见问题

### Q: 快照更新延迟？
A: 检查 `Narrator` 处理超时（默认 30 秒），或查看 `pending` 状态。

### Q: 状态不一致？
A: 确保所有状态修改通过 `state_store.mutate()` 进行，而非直接修改。

### Q: 内存增长？
A: `narrative_history` 可能无限增长，建议定期清理或设置上限。
