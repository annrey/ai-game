use napi::bindgen_prelude::*;
use napi_derive::napi;
use napi::threadsafe_function::{ThreadsafeFunction, ErrorStrategy};
use std::sync::Arc;
use std::path::PathBuf;

use game_core::{EventBus, GameEngine, RuleEngine, StateStore, GameEvent};
use game_core::agents::{AgentManager, BaseAgent};
use game_core::agents::narrator::NarratorAgent;
use game_core::agents::guide::GuideAgent;
use game_core::providers::OllamaProvider;
use memory::sqlite::SqliteMemoryStore;
use memory::store::MemoryStore;
use sqlx::sqlite::SqlitePoolOptions;

#[napi]
pub struct CoreGameEngine {
    engine: Arc<GameEngine>,
    event_bus: Arc<EventBus>,
    state_store: Arc<StateStore>,
}

#[napi]
impl CoreGameEngine {
    /// Initialize the Rust GameEngine
    #[napi(factory)]
    pub async fn create(ollama_url: Option<String>, save_dir: String, db_url: String) -> Result<Self> {
        let event_bus = EventBus::new(1024);
        let state_store = StateStore::new(PathBuf::from(save_dir));
        
        let mut rule_engine = RuleEngine::new();
        rule_engine.register_rule(Box::new(game_core::rules::movement::MovementRule));
        rule_engine.register_rule(Box::new(game_core::rules::economy::EconomyRule));
        rule_engine.register_rule(Box::new(game_core::rules::relationship::RelationshipRule));
        rule_engine.register_rule(Box::new(game_core::rules::schedule::ScheduleRule));
        rule_engine.register_rule(Box::new(game_core::rules::quest::QuestRule));
        rule_engine.register_rule(Box::new(game_core::rules::item::ItemRule));

        let provider = Arc::new(OllamaProvider::new("llama3".to_string(), ollama_url));
        
        // Setup Sub-Agents
        let mut agent_manager = AgentManager::new();
        let guide_agent = Arc::new(GuideAgent::new(provider.clone()));
        agent_manager.register("guide", guide_agent);
        let agent_manager_arc = Arc::new(agent_manager);

        let narrator = NarratorAgent::new(provider, agent_manager_arc);

        // Setup Memory Store
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to connect to SQLite: {}", e)))?;
        
        let memory_store = SqliteMemoryStore::new(pool);
        memory_store.init().await.map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        let engine = GameEngine::new(
            event_bus.clone(),
            state_store.clone(),
            rule_engine,
            narrator,
            Arc::new(memory_store),
        );

        Ok(Self {
            engine: Arc::new(engine),
            event_bus: Arc::new(event_bus),
            state_store: Arc::new(state_store),
        })
    }

    /// Starts the engine's main event loop in the background
    #[napi]
    pub fn start(&self) {
        let engine_clone = Arc::clone(&self.engine);
        tokio::spawn(async move {
            engine_clone.start().await;
        });
    }

    /// Dispatch an event to the game engine
    #[napi]
    pub fn dispatch_event(&self, event_type: String, payload_json: String) -> Result<()> {
        let payload: serde_json::Value = serde_json::from_str(&payload_json)
            .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid JSON payload: {}", e)))?;

        let event = GameEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            payload,
            timestamp: chrono::Utc::now().timestamp_millis(),
        };

        self.event_bus.publish(event)
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(())
    }

    /// Subscribe to all events
    #[napi]
    pub fn subscribe(&self, #[napi(ts_arg_type = "(event_json: string) => void")] callback: ThreadsafeFunction<String, ErrorStrategy::Fatal>) -> Result<()> {
        let mut receiver = self.event_bus.subscribe();

        tokio::spawn(async move {
            while let Ok(event) = receiver.recv().await {
                if let Ok(json_str) = serde_json::to_string(&event) {
                    callback.call(json_str, napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking);
                }
            }
        });

        Ok(())
    }

    /// Get the current state snapshot as a JSON string
    #[napi]
    pub async fn get_state(&self) -> Result<String> {
        self.state_store.get_state_json().await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Save the game
    #[napi]
    pub async fn save(&self, name: String, mode: String) -> Result<String> {
        self.engine.save(&name, &mode).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Load the game
    #[napi]
    pub async fn load(&self, save_id: String) -> Result<()> {
        self.engine.load(&save_id).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// List all saves
    #[napi]
    pub async fn list_saves(&self, limit: Option<u32>) -> Result<String> {
        self.engine.list_saves(limit.map(|l| l as usize)).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Delete a save
    #[napi]
    pub async fn delete_save(&self, save_id: String) -> Result<()> {
        self.engine.delete_save(&save_id).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Get Memories
    #[napi]
    pub async fn get_memories(&self, options_json: String) -> Result<String> {
        self.engine.get_memories(&options_json).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Recall Memories
    #[napi]
    pub async fn recall_memories(&self, query: String, options_json: String) -> Result<String> {
        self.engine.recall_memories(&query, &options_json).await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Clear Memories
    #[napi]
    pub async fn clear_memories(&self) -> Result<()> {
        self.engine.clear_memories().await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }

    /// Get Memory Count
    #[napi]
    pub async fn get_memory_count(&self) -> Result<i32> {
        self.engine.get_memory_count().await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
    }
}
