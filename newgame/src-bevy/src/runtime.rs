use game_core::{
    agents::{AgentManager},
    agents::narrator::NarratorAgent,
    engine::GameEngine,
    engine_handle::EngineHandle,
    event_bus::EventBus,
    providers::ProviderFactory,
    rules::RuleEngine,
    state_store::{StateStore, WorldState},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
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
}

/// 启动时可选的 payload
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BootstrapPayload {
    pub save_id: Option<String>,
    pub mode: Option<String>,
}

/// 从引擎后台拉取的快照（单一事实源）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineSnapshot {
    pub narrative_delta: Option<NarrativeEntry>,
    pub world: WorldStateSummary,
    pub last_error: Option<String>,
    pub pending: bool,
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
#[derive(Clone)]
pub struct EngineBridge {
    pub cmd_tx: flume::Sender<EngineCommand>,
    pub snap_rx: flume::Receiver<EngineSnapshot>,
}

/// 运行在独占 Tokio 线程上的引擎运行时
pub struct EngineRuntime;

impl EngineRuntime {
    pub fn spawn(cfg: RuntimeConfig) -> EngineBridge {
        let (cmd_tx, cmd_rx) = flume::unbounded::<EngineCommand>();
        let (snap_tx, snap_rx) = flume::unbounded::<EngineSnapshot>();

        thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
                .expect("Failed to build Tokio runtime");

            rt.block_on(async {
                let engine = Self::build_engine(cfg).await;
                let handle = EngineHandle::new(engine);
                handle.start().await;

                let mut event_rx = handle.event_bus().subscribe();
                let state_store = handle.state_store();

                let snap_tx_clone = snap_tx.clone();
                let state_store_clone = state_store.clone();

                // 事件订阅任务：将 narrative_generated / state_changed / turn_advanced 转为快照推送
                tokio::spawn(async move {
                    while let Ok(event) = event_rx.recv().await {
                        match event.event_type.as_str() {
                            "narrative_generated" | "state_changed" | "turn_advanced" => {
                                let snapshot =
                                    Self::build_snapshot(&state_store_clone, None, false).await;
                                let _ = snap_tx_clone.send(snapshot);
                            }
                            _ => {}
                        }
                    }
                });

                // 命令处理任务
                while let Ok(cmd) = cmd_rx.recv_async().await {
                    let snap_tx = snap_tx.clone();
                    let handle = handle.clone();
                    let state_store = state_store.clone();

                    // 收到命令后立即推一个 pending=true 的快照，让 UI 进入"处理中"
                    let pending_snapshot = Self::build_snapshot(&state_store, None, true).await;
                    let _ = snap_tx.send(pending_snapshot);

                    tokio::spawn(async move {
                        let mut error: Option<String> = None;

                        match cmd {
                            EngineCommand::PlayerInput(input) => {
                                handle.dispatch_player_input(&input).await;
                            }
                            EngineCommand::ChoiceSelected { id, text } => {
                                let input = format!("[选择 {}] {}", id, text);
                                handle.dispatch_player_input(&input).await;
                            }
                            EngineCommand::Bootstrap(ref payload) => {
                                if let Some(save_id) = &payload.save_id {
                                    if let Err(e) = handle.load(save_id).await {
                                        error = Some(format!("Load failed: {}", e));
                                    }
                                }
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
                                // 重置：将 StateStore 恢复为默认状态
                                state_store
                                    .mutate(|s| {
                                        *s = WorldState::default();
                                    })
                                    .await;
                            }
                            EngineCommand::RequestSnapshot => {
                                // 仅请求快照，不做额外操作
                            }
                        }

                        // 命令处理完毕后推最终快照
                        let final_snapshot = Self::build_snapshot(&state_store, error, false).await;
                        let _ = snap_tx.send(final_snapshot);
                    });
                }
            });
        });

        EngineBridge { cmd_tx, snap_rx }
    }

    async fn build_engine(cfg: RuntimeConfig) -> GameEngine {
        let factory = ProviderFactory::from_env();
        let provider = factory
            .build_with_fallback()
            .await
            .unwrap_or_else(|_| Arc::new(game_core::providers::EchoProvider::new()));

        let agent_manager = Arc::new(AgentManager::new());
        let narrator = NarratorAgent::new(provider, agent_manager);

        let event_bus = EventBus::new(256);
        let state_store = StateStore::new(&cfg.save_dir);
        let rule_engine = RuleEngine::new();

        GameEngine::new(
            event_bus,
            state_store,
            rule_engine,
            narrator,
            cfg.memory_store,
        )
    }

    async fn build_snapshot(
        state_store: &StateStore,
        error: Option<String>,
        pending: bool,
    ) -> EngineSnapshot {
        state_store
            .read(|state| EngineSnapshot {
                narrative_delta: if pending || state.narrative.is_empty() {
                    None
                } else {
                    Some(NarrativeEntry {
                        content: state.narrative.clone(),
                        is_player: false,
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    })
                },
                world: WorldStateSummary {
                    time_of_day: state.time_of_day.clone(),
                    weather: state.weather.clone(),
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
            })
            .await
    }
}

/// 启动配置
#[derive(Clone)]
pub struct RuntimeConfig {
    pub save_dir: String,
    pub memory_store: Arc<dyn memory::store::MemoryStore>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            save_dir: "./saves".to_string(),
            memory_store: Arc::new(memory::InMemoryStore::default()),
        }
    }
}
