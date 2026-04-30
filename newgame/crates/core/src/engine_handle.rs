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

    pub async fn get_memories(&self, options: &str) -> anyhow::Result<String> {
        self.inner.get_memories(options).await
    }

    pub async fn recall_memories(&self, query: &str, options: &str) -> anyhow::Result<String> {
        self.inner.recall_memories(query, options).await
    }

    pub async fn clear_memories(&self) -> anyhow::Result<()> {
        self.inner.clear_memories().await
    }

    pub async fn get_memory_count(&self) -> anyhow::Result<i32> {
        self.inner.get_memory_count().await
    }

    pub async fn start(&self) {
        self.inner.start().await;
    }

    /// 派发消息给指定角色的 Agent（如 "guide"）
    pub async fn dispatch_to_agent(&self, role: &str, input: &str) -> anyhow::Result<String> {
        let agent_manager = self.inner.agent_manager();
        let agent = agent_manager
            .get(role)
            .ok_or_else(|| anyhow::anyhow!("Agent not found: {}", role))?;

        let state_snapshot = self.inner.state_store().read(|s| format!("{:?}", s)).await;
        let response = agent.process_action(&state_snapshot, input, &[]).await?;

        Ok(response.content)
    }
}
