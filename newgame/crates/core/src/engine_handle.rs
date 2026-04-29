use crate::engine::GameEngine;
use crate::event_bus::EventBus;
use crate::state_store::StateStore;
use std::sync::Arc;

/// 轻量 facade，是所有上层（Bevy / Tauri / Axum / FFI）应该持有的唯一入口。
#[derive(Clone)]
pub struct EngineHandle {
    inner: Arc<GameEngine>,
}

impl EngineHandle {
    pub fn new(engine: GameEngine) -> Self {
        Self {
            inner: Arc::new(engine),
        }
    }

    pub fn event_bus(&self) -> Arc<EventBus> {
        self.inner.event_bus()
    }

    pub fn state_store(&self) -> Arc<StateStore> {
        self.inner.state_store()
    }

    pub async fn dispatch_player_input(&self, input: &str) {
        self.inner.dispatch_player_input(input).await;
    }

    pub async fn save(&self, name: &str, mode: &str) -> anyhow::Result<String> {
        self.inner.save(name, mode).await
    }

    pub async fn load(&self, save_id: &str) -> anyhow::Result<()> {
        self.inner.load(save_id).await
    }

    pub async fn list_saves(&self, limit: Option<usize>) -> anyhow::Result<String> {
        self.inner.list_saves(limit).await
    }

    pub async fn delete_save(&self, save_id: &str) -> anyhow::Result<()> {
        self.inner.delete_save(save_id).await
    }

    pub async fn start(&self) {
        self.inner.start().await;
    }
}
