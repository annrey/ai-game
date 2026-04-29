use game_core::{GameEngine, EventBus, StateStore, WorldState};
use std::sync::{Arc, Mutex};
use tokio::runtime::Runtime;
use anyhow::Result;

pub struct EngineBridge {
    runtime: Runtime,
    engine: Arc<Mutex<Option<Arc<GameEngine>>>>,
    pending_inputs: Arc<Mutex<Vec<String>>>,
}

impl EngineBridge {
    pub fn new() -> Result<Self> {
        let runtime = tokio::runtime::Runtime::new()?;

        Ok(Self {
            runtime,
            engine: Arc::new(Mutex::new(None)),
            pending_inputs: Arc::new(Mutex::new(Vec::new())),
        })
    }

    pub fn initialize_engine(&self) -> Result<()> {
        self.runtime.block_on(async {
            let event_bus = EventBus::new(1024);
            let state_store = StateStore::new("../../data/saves");
            let rule_engine = game_core::RuleEngine::new();
            let narrator = game_core::agents::narrator::NarratorAgent::new(
                std::sync::Arc::new(game_core::providers::OllamaProvider::new(
                    "llama3".to_string(),
                    Some("http://localhost:11434".to_string()),
                )),
                std::sync::Arc::new(game_core::agents::AgentManager::new()),
            );
            let memory_store: std::sync::Arc<dyn memory::store::MemoryStore> = std::sync::Arc::new(
                memory::sqlite::SqliteMemoryStore::new_in_memory().await.unwrap(),
            );

            let engine = Arc::new(GameEngine::new(
                event_bus,
                state_store,
                rule_engine,
                narrator,
                memory_store,
            ));

            let engine_clone = Arc::clone(&engine);
            tokio::spawn(async move {
                engine_clone.start().await;
            });

            *self.engine.lock().unwrap() = Some(engine);
            Ok(())
        })
    }

    pub fn process_input(&self, input: &str, _current_state: &WorldState) -> Result<String> {
        self.pending_inputs.lock().unwrap().push(input.to_string());
        Ok(format!("已提交：{}", input))
    }

    pub fn get_world_state(&self) -> Result<WorldState> {
        let engine_guard = self.engine.lock().unwrap();
        if let Some(engine) = engine_guard.as_ref() {
            let state_store = engine.state_store();
            self.runtime.block_on(async {
                let state = state_store.read(|s| s.clone()).await;
                Ok(state)
            })
        } else {
            Ok(WorldState::default())
        }
    }

    pub fn save_game(&self, name: &str, mode: &str) -> Result<String> {
        let engine_guard = self.engine.lock().unwrap();
        if let Some(engine) = engine_guard.as_ref() {
            self.runtime.block_on(async {
                engine.save(name, mode).await.map_err(|e| anyhow::anyhow!(e))
            })
        } else {
            Ok(uuid::Uuid::new_v4().to_string())
        }
    }

    pub fn load_game(&self, save_id: &str) -> Result<WorldState> {
        let engine_guard = self.engine.lock().unwrap();
        if let Some(engine) = engine_guard.as_ref() {
            self.runtime.block_on(async {
                engine.load(save_id).await.map_err(|e| anyhow::anyhow!(e))?;
                let state = engine.state_store().read(|s| s.clone()).await;
                Ok(state)
            })
        } else {
            Ok(WorldState::default())
        }
    }

    pub fn list_saves(&self) -> Result<Vec<serde_json::Value>> {
        let engine_guard = self.engine.lock().unwrap();
        if let Some(engine) = engine_guard.as_ref() {
            self.runtime.block_on(async {
                let saves_json = engine.list_saves(None).await.map_err(|e| anyhow::anyhow!(e))?;
                let saves: Vec<serde_json::Value> = serde_json::from_str(&saves_json)?;
                Ok(saves)
            })
        } else {
            Ok(vec![])
        }
    }

    pub fn dispatch_pending_inputs(&self) -> Result<()> {
        let inputs: Vec<String> = {
            let mut guard = self.pending_inputs.lock().unwrap();
            let drained = guard.drain(..).collect();
            drained
        };

        let engine_guard = self.engine.lock().unwrap();
        if let Some(engine) = engine_guard.as_ref() {
            for input in inputs {
                let _ = engine.dispatch_player_input(&input);
            }
        }
        Ok(())
    }

    pub fn try_receive_narrative(&self) -> Option<String> {
        None
    }
}

impl Default for EngineBridge {
    fn default() -> Self {
        Self::new().expect("Failed to create EngineBridge")
    }
}

#[derive(Debug, Clone)]
pub struct GameResponse {
    pub narrative: String,
    pub choices: Vec<ChoiceOption>,
    pub state_changes: StateChanges,
    pub sound_effect: Option<String>,
    pub visual_effect: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ChoiceOption {
    pub id: String,
    pub text: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Default)]
pub struct StateChanges {
    pub health_delta: i32,
    pub mana_delta: i32,
    pub energy_delta: i32,
    pub items_added: Vec<String>,
    pub items_removed: Vec<String>,
    pub location_changed: Option<String>,
    pub quest_updated: Vec<String>,
}

pub fn convert_world_state_to_game_state(world_state: &WorldState) -> crate::game_state::GameState {
    use crate::game_state::{GameState, GameTime, TimeOfDay, Weather, InventoryItem, ItemType, Quest, QuestStatus, QuestObjective, SceneType, EngineSnapshot, ConnectionStatus, EngineBackend};

    let mut game_state = GameState::new();

    game_state.game_time = GameTime {
        year: world_state.variables.get("year")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32,
        month: world_state.variables.get("month")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32,
        day: world_state.variables.get("day")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32,
        hour: world_state.variables.get("hour")
            .and_then(|v| v.as_i64())
            .unwrap_or(12) as i32,
        minute: world_state.variables.get("minute")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
        time_of_day: parse_time_of_day(&world_state.time_of_day),
    };

    game_state.weather = parse_weather(&world_state.weather);
    game_state.location_name = world_state.current_location.clone();
    game_state.current_narrative = world_state.location_description.clone();
    game_state.turn_count = world_state.turn_count as i32;
    game_state.scene_type = parse_scene_type(&world_state.scene_type);

    game_state.health = world_state.player.health;
    game_state.max_health = world_state.player.max_health;
    game_state.mana = world_state.player.mana;
    game_state.max_mana = world_state.player.max_mana;
    game_state.energy = world_state.player.energy;
    game_state.max_energy = world_state.player.max_energy;

    game_state.inventory = world_state.inventory.iter().map(|item| InventoryItem {
        id: item.id.clone(),
        name: item.name.clone(),
        item_type: parse_item_type(&item.item_type),
        quantity: item.quantity,
        description: item.description.clone(),
        icon: item.icon.clone(),
    }).collect();

    game_state.quests = world_state.quests.iter().map(|q| Quest {
        id: q.id.clone(),
        title: q.title.clone(),
        description: q.description.clone(),
        status: parse_quest_status(&q.status),
        objectives: q.objectives.iter().map(|o| QuestObjective {
            id: o.id.clone(),
            description: o.description.clone(),
            is_completed: o.is_completed,
        }).collect(),
    }).collect();

    game_state.engine_snapshot = EngineSnapshot {
        backend: Some(EngineBackend::Ollama),
        connection_status: ConnectionStatus::Online,
        last_error: None,
    };

    game_state
}

fn parse_time_of_day(time_str: &str) -> crate::game_state::TimeOfDay {
    match time_str.to_lowercase().as_str() {
        "dawn" | "黎明" => crate::game_state::TimeOfDay::Dawn,
        "morning" | "清晨" | "早晨" => crate::game_state::TimeOfDay::Morning,
        "noon" | "正午" => crate::game_state::TimeOfDay::Noon,
        "afternoon" | "下午" => crate::game_state::TimeOfDay::Afternoon,
        "dusk" | "黄昏" => crate::game_state::TimeOfDay::Dusk,
        "night" | "夜晚" => crate::game_state::TimeOfDay::Night,
        "midnight" | "午夜" => crate::game_state::TimeOfDay::Midnight,
        _ => crate::game_state::TimeOfDay::Morning,
    }
}

fn parse_weather(weather_str: &str) -> crate::game_state::Weather {
    match weather_str.to_lowercase().as_str() {
        "clear" | "晴朗" => crate::game_state::Weather::Clear,
        "cloudy" | "多云" => crate::game_state::Weather::Cloudy,
        "rain" | "下雨" | "雨" => crate::game_state::Weather::Rain,
        "storm" | "暴风雨" | "暴雨" => crate::game_state::Weather::Storm,
        "snow" | "雪" | "下雪" => crate::game_state::Weather::Snow,
        "fog" | "雾" | "雾天" => crate::game_state::Weather::Fog,
        _ => crate::game_state::Weather::Clear,
    }
}

fn parse_scene_type(scene_str: &str) -> crate::game_state::SceneType {
    match scene_str.to_lowercase().as_str() {
        "forest" | "森林" => crate::game_state::SceneType::Forest,
        "town" | "城镇" => crate::game_state::SceneType::Town,
        "dungeon" | "地牢" => crate::game_state::SceneType::Dungeon,
        "beach" | "海滩" => crate::game_state::SceneType::Beach,
        "mountain" | "山脉" => crate::game_state::SceneType::Mountain,
        _ => crate::game_state::SceneType::Custom,
    }
}

fn parse_item_type(item_type_str: &str) -> crate::game_state::ItemType {
    match item_type_str.to_lowercase().as_str() {
        "weapon" => crate::game_state::ItemType::Weapon,
        "armor" => crate::game_state::ItemType::Armor,
        "consumable" => crate::game_state::ItemType::Consumable,
        "material" => crate::game_state::ItemType::Material,
        "quest" => crate::game_state::ItemType::Quest,
        _ => crate::game_state::ItemType::Misc,
    }
}

fn parse_quest_status(status: &game_core::state_store::QuestStatus) -> crate::game_state::QuestStatus {
    match status {
        game_core::state_store::QuestStatus::Completed => crate::game_state::QuestStatus::Completed,
        game_core::state_store::QuestStatus::Failed => crate::game_state::QuestStatus::Failed,
        game_core::state_store::QuestStatus::Active => crate::game_state::QuestStatus::Active,
    }
}
