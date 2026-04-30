use napi::bindgen_prelude::*;
use napi_derive::napi;
use napi::threadsafe_function::{ThreadsafeFunction, ErrorStrategy};
use std::sync::Arc;
use std::path::PathBuf;

use game_core::{EventBus, GameEvent, StateStore};
use game_core::engine_factory::{EngineFactory, EngineFactoryConfig};
use game_core::engine_handle::EngineHandle;
use game_core::providers::provider_factory::{ProviderConfig, SingleProviderConfig};

#[napi]
pub struct CoreGameEngine {
    engine: EngineHandle,
    event_bus: Arc<EventBus>,
    state_store: Arc<StateStore>,
}

#[napi]
impl CoreGameEngine {
    /// Initialize the Rust GameEngine via the unified EngineFactory.
    /// Bevy / Tauri / Server / FFI 都走这个路径，保证同源。
    #[napi(factory)]
    pub async fn create(ollama_url: Option<String>, save_dir: String, db_url: String) -> Result<Self> {
        let mut provider_cfg = ProviderConfig::default();
        provider_cfg.default_provider = "ollama".to_string();
        provider_cfg.ollama = SingleProviderConfig {
            enabled: true,
            base_url: Some(ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string())),
            api_key: None,
            model: Some("llama3".to_string()),
        };

        let bundle = EngineFactory::build(EngineFactoryConfig {
            save_dir: PathBuf::from(save_dir),
            memory_db_url: Some(db_url),
            provider_config: Some(provider_cfg),
            event_bus_capacity: 1024,
            register_default_rules: true,
        })
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("EngineFactory build failed: {}", e)))?;

        let event_bus = bundle.handle.event_bus();
        let state_store = bundle.handle.state_store();

        Ok(Self {
            engine: bundle.handle,
            event_bus,
            state_store,
        })
    }

    /// Starts the engine's main event loop in the background
    #[napi]
    pub fn start(&self) {
        let engine_clone = self.engine.clone();
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
