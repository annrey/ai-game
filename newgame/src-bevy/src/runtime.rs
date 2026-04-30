use game_core::{
    engine_factory::{BackendKind, EngineBundle, EngineFactory, EngineFactoryConfig},
    events::GameEvent,
    state_store::{StateStore, WorldState},
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::thread;

/// 发送到引擎后台的命令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineCommand {
    PlayerInput(String),
    ChoiceSelected { id: String, text: String },
    Bootstrap(BootstrapPayload),
    Save(String),
    Load(String),
    Reset,
    RequestSnapshot,
    Shutdown,
}

/// 启动时可选的 payload
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BootstrapPayload {
    pub save_id: Option<String>,
    pub mode: Option<String>,
    pub world_name: Option<String>,
    pub genre: Option<String>,
    pub tone: Option<String>,
    pub location: Option<String>,
    pub location_description: Option<String>,
    pub weather: Option<String>,
    pub scene_type: Option<String>,
    pub player_name: Option<String>,
    pub player_role: Option<String>,
    pub player_background: Option<String>,
}

/// 从引擎后台拉取的快照（单一事实源）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineSnapshot {
    pub narrative_delta: Option<NarrativeEntry>,
    pub world: WorldStateSummary,
    pub last_error: Option<String>,
    pub pending: bool,
    /// 当前实际生效的后端（Ollama / Echo / 等等）
    pub backend: BackendKind,
    /// 触发此快照的事件 ID，用于客户端去重
    pub last_event_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NarrativeEntry {
    pub content: String,
    pub is_player: bool,
    pub timestamp: i64,
}

/// 世界状态的轻量摘要，供 Bevy UI 只读使用
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldStateSummary {
    pub time_of_day: String,
    pub weather: String,
    pub scene_type: String,
    pub turn_count: i64,
    pub location_name: String,
    pub chapter: String,
    pub narrative: String,
    pub choices: Vec<ChoiceSummary>,
    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub energy: i32,
    pub max_energy: i32,
    pub exploration_percent: f32,
    pub locations_discovered: i32,
    pub npcs_met: i32,
    pub items_collected: i32,
    pub inventory: Vec<InventoryItemSummary>,
    pub quests: Vec<QuestSummary>,
    pub settings: game_core::state_store::GameSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChoiceSummary {
    pub id: String,
    pub text: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InventoryItemSummary {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub quantity: i32,
    pub description: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QuestSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
}

/// Bevy 与 Tokio 后台之间的桥接资源
///
/// Drop 时会发送 Shutdown 命令，让后台线程自行退出。
/// 不持有 JoinHandle 避免 Drop 中阻塞主线程。
pub struct EngineBridge {
    pub cmd_tx: flume::Sender<EngineCommand>,
    pub snap_rx: flume::Receiver<EngineSnapshot>,
}

impl EngineBridge {
    /// 同步发送命令的便捷封装；忽略发送错误（接收端关闭即视为引擎已停）
    pub fn send(&self, cmd: EngineCommand) {
        let _ = self.cmd_tx.send(cmd);
    }
}

impl Drop for EngineBridge {
    fn drop(&mut self) {
        // 通知后台线程关闭；发送失败说明线程已退出，忽略即可
        let _ = self.cmd_tx.send(EngineCommand::Shutdown);
    }
}

/// 运行在独占 Tokio 线程上的引擎运行时
pub struct EngineRuntime;

impl EngineRuntime {
    pub fn spawn(cfg: RuntimeConfig) -> EngineBridge {
        let (cmd_tx, cmd_rx) = flume::unbounded::<EngineCommand>();
        let (snap_tx, snap_rx) = flume::unbounded::<EngineSnapshot>();
        // 事件循环监听一个独立的关闭通知
        let (event_shutdown_tx, event_shutdown_rx) = flume::bounded::<()>(1);

        let _handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
                .expect("Failed to build Tokio runtime");

            rt.block_on(async move {
                // 通过统一工厂构造引擎，得到 handle 与实际 backend
                let bundle = match EngineFactory::build(EngineFactoryConfig {
                    save_dir: PathBuf::from(&cfg.save_dir),
                    memory_db_url: cfg.memory_db_url.clone(),
                    provider_config: None,
                    event_bus_capacity: 256,
                    register_default_rules: true,
                })
                .await
                {
                    Ok(b) => b,
                    Err(e) => {
                        eprintln!(
                            "[EngineRuntime] Failed to build engine: {}; falling back to default in-memory",
                            e
                        );
                        EngineFactory::build_default()
                            .await
                            .expect("build_default must not fail with in-memory store")
                    }
                };

                let EngineBundle { handle, backend } = bundle;
                handle.start().await;

                let mut event_rx = handle.event_bus().subscribe();
                let state_store = handle.state_store();

                // 启动后立即推一帧（pending=false），让 UI 拿到初始 backend 与初始世界
                let initial = Self::build_snapshot(&state_store, None, false, backend, None).await;
                let _ = snap_tx.send(initial);

                let snap_tx_event = snap_tx.clone();
                let backend_for_event = backend;
                let shutdown_rx = event_shutdown_rx;
                // 为事件循环单独 clone 一份 state_store
                let state_store_for_event = state_store.clone();

                // 事件监听循环
                let _event_handle = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            Ok(event) = event_rx.recv() => {
                                match event.event_type.as_str() {
                                    "narrative_generated" | "state_changed" | "turn_advanced" => {
                                        let snapshot =
                                            Self::build_snapshot(
                                                &state_store_for_event,
                                                None,
                                                false,
                                                backend_for_event,
                                                Some(&event),
                                            )
                                            .await;
                                        let _ = snap_tx_event.send(snapshot);
                                    }
                                    _ => {}
                                }
                            }
                            _ = shutdown_rx.recv_async() => {
                                // 收到关闭信号，退出事件循环
                                break;
                            }
                        }
                    }
                });

                // 命令处理循环
                loop {
                    let cmd = match cmd_rx.recv_async().await {
                        Ok(cmd) => cmd,
                        Err(_) => break, // channel 关闭，退出循环
                    };

                    // 处理 Shutdown 命令，优雅退出
                    if let EngineCommand::Shutdown = cmd {
                        // 通知事件循环退出
                        let _ = event_shutdown_tx.send(());
                        break;
                    }

                    let snap_tx = snap_tx.clone();
                    let handle = handle.clone();
                    let state_store_clone = state_store.clone();

                    // 收到命令后立即推一个 pending=true 的快照，让 UI 进入"处理中"
                    let pending_snapshot =
                        Self::build_snapshot(&state_store, None, true, backend, None).await;
                    let _ = snap_tx.send(pending_snapshot);

                    tokio::spawn(async move {
                        let mut error: Option<String> = None;

                        match cmd {
                            EngineCommand::Shutdown => {
                                // Shutdown 已在循环外处理，这里直接返回
                            }
                            EngineCommand::PlayerInput(input) => {
                                handle.dispatch_player_input(&input).await;
                            }
                            EngineCommand::ChoiceSelected { id, text } => {
                                let input = format!("[选择 {}] {}", id, text);
                                handle.dispatch_player_input(&input).await;
                            }
                            EngineCommand::Bootstrap(ref payload) => {
                                // 优先加载存档
                                if let Some(save_id) = &payload.save_id {
                                    if let Err(e) = handle.load(save_id).await {
                                        error = Some(format!("Load failed: {}", e));
                                    }
                                }

                                // 应用 Bootstrap 参数到 world state
                                state_store_clone.mutate(|s| {
                                    if let Some(world_name) = &payload.world_name {
                                        s.chapter = world_name.clone();
                                    }
                                    if let Some(location) = &payload.location {
                                        s.location_name = location.clone();
                                        s.current_location = location.clone();
                                    }
                                    if let Some(location_desc) = &payload.location_description {
                                        s.location_description = location_desc.clone();
                                    }
                                    if let Some(weather) = &payload.weather {
                                        s.weather = weather.clone();
                                    }
                                    if let Some(scene_type_str) = &payload.scene_type {
                                        s.scene_type = parse_scene_type_core(scene_type_str);
                                    }
                                    if let Some(player_name) = &payload.player_name {
                                        s.player.name = player_name.clone();
                                    }
                                    if let Some(player_role) = &payload.player_role {
                                        s.player.role = player_role.clone();
                                    }
                                    // genre/tone/background 存入 variables
                                    if let Some(genre) = &payload.genre {
                                        if let serde_json::Value::Object(ref mut m) = s.variables {
                                            m.insert("genre".to_string(), serde_json::json!(genre));
                                        }
                                    }
                                    if let Some(tone) = &payload.tone {
                                        if let serde_json::Value::Object(ref mut m) = s.variables {
                                            m.insert("tone".to_string(), serde_json::json!(tone));
                                        }
                                    }
                                    if let Some(background) = &payload.player_background {
                                        if let serde_json::Value::Object(ref mut m) = s.variables {
                                            m.insert("player_background".to_string(), serde_json::json!(background));
                                        }
                                    }
                                }).await;
                            }
                            EngineCommand::Save(name) => {
                                let mode = "manual".to_string();
                                if let Err(e) = handle.save(&name, &mode).await {
                                    error = Some(format!("Save failed: {}", e));
                                }
                            }
                            EngineCommand::Load(save_id) => {
                                if let Err(e) = handle.load(&save_id).await {
                                    error = Some(format!("Load failed: {}", e));
                                }
                            }
                            EngineCommand::Reset => {
                                state_store_clone
                                    .mutate(|s| {
                                        *s = WorldState::default();
                                    })
                                    .await;
                            }
                            EngineCommand::RequestSnapshot => {
                                // 仅请求快照
                            }
                        }

                        let final_snapshot =
                            Self::build_snapshot(&state_store_clone, error, false, backend, None).await;
                        let _ = snap_tx.send(final_snapshot);
                    });
                }
            });
        });

        EngineBridge { cmd_tx, snap_rx }
    }

    async fn build_snapshot(
        state_store: &StateStore,
        error: Option<String>,
        pending: bool,
        backend: BackendKind,
        event: Option<&GameEvent>,
    ) -> EngineSnapshot {
        // 从 narrative_generated 事件 payload 读取叙事内容
        let narrative_from_event = event.and_then(|e| {
            if e.event_type == "narrative_generated" {
                e.payload
                    .get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| (s.to_string(), e.timestamp))
            } else {
                None
            }
        });

        let event_id = event.map(|e| e.id.clone());

        state_store
            .read(move |state| EngineSnapshot {
                narrative_delta: if pending {
                    None
                } else if let Some((content, ts)) = &narrative_from_event {
                    // 优先使用事件 payload 中的叙事（来自 narrator）
                    Some(NarrativeEntry {
                        content: content.clone(),
                        is_player: false,
                        timestamp: *ts,
                    })
                } else if !state.narrative.is_empty() {
                    // 回退到 state.narrative（用于初始加载等场景）
                    Some(NarrativeEntry {
                        content: state.narrative.clone(),
                        is_player: false,
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    })
                } else {
                    None
                },
                world: WorldStateSummary {
                    time_of_day: state.time_of_day.clone(),
                    weather: state.weather.clone(),
                    scene_type: format!("{:?}", state.scene_type).to_lowercase(),
                    turn_count: state.turn_count,
                    location_name: state.location_name.clone(),
                    chapter: state.chapter.clone(),
                    narrative: state.narrative.clone(),
                    choices: state
                        .choices
                        .iter()
                        .map(|c| ChoiceSummary {
                            id: c.id.clone(),
                            text: c.text.clone(),
                            description: c.description.clone(),
                            icon: c.icon.clone(),
                            enabled: c.enabled,
                        })
                        .collect(),
                    health: state.health,
                    max_health: state.max_health,
                    mana: state.mana,
                    max_mana: state.max_mana,
                    energy: state.energy,
                    max_energy: state.max_energy,
                    exploration_percent: state.exploration_percent,
                    locations_discovered: state.locations_discovered,
                    npcs_met: state.npcs_met,
                    items_collected: state.items_collected,
                    inventory: state
                        .inventory
                        .iter()
                        .map(|i| InventoryItemSummary {
                            id: i.id.clone(),
                            name: i.name.clone(),
                            item_type: i.item_type.clone(),
                            quantity: i.quantity,
                            description: i.description.clone(),
                            icon: i.icon.clone(),
                        })
                        .collect(),
                    quests: state
                        .quests
                        .iter()
                        .map(|q| QuestSummary {
                            id: q.id.clone(),
                            title: q.title.clone(),
                            description: q.description.clone(),
                            status: format!("{:?}", q.status),
                        })
                        .collect(),
                    settings: state.settings.clone(),
                },
                last_error: error,
                pending,
                backend,
                last_event_id: event_id,
            })
            .await
    }
}

/// 启动配置（Bevy 端层面）
#[derive(Clone)]
pub struct RuntimeConfig {
    /// 存档目录
    pub save_dir: String,
    /// SQLite 记忆数据库 URL；None 表示使用内存记忆
    pub memory_db_url: Option<String>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            save_dir: "./saves".to_string(),
            memory_db_url: None,
        }
    }
}

impl Default for EngineSnapshot {
    fn default() -> Self {
        Self {
            narrative_delta: None,
            world: WorldStateSummary::default(),
            last_error: None,
            pending: false,
            backend: BackendKind::Echo,
            last_event_id: None,
        }
    }
}

/// 将字符串解析为 core 的 SceneType
fn parse_scene_type_core(s: &str) -> game_core::state_store::SceneType {
    match s.to_lowercase().as_str() {
        "town" => game_core::state_store::SceneType::Town,
        "dungeon" => game_core::state_store::SceneType::Dungeon,
        "beach" => game_core::state_store::SceneType::Beach,
        "mountain" => game_core::state_store::SceneType::Mountain,
        "custom" => game_core::state_store::SceneType::Custom,
        "forest" | _ => game_core::state_store::SceneType::Forest,
    }
}
