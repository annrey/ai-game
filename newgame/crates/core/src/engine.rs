use crate::agents::narrator::NarratorAgent;
use crate::agents::BaseAgent;
use crate::event_bus::EventBus;
use crate::events::GameEvent;
use crate::rules::RuleEngine;
use crate::state_store::StateStore;
use memory::store::MemoryStore;
use std::sync::Arc;
use tokio::task;

pub struct GameEngine {
    event_bus: Arc<EventBus>,
    state_store: Arc<StateStore>,
    rule_engine: Arc<RuleEngine>,
    narrator: Arc<NarratorAgent>,
    memory_store: Arc<dyn MemoryStore>,
}

impl GameEngine {
    pub fn new(
        event_bus: EventBus,
        state_store: StateStore,
        rule_engine: RuleEngine,
        narrator: NarratorAgent,
        memory_store: Arc<dyn MemoryStore>,
    ) -> Self {
        Self {
            event_bus: Arc::new(event_bus),
            state_store: Arc::new(state_store),
            rule_engine: Arc::new(rule_engine),
            narrator: Arc::new(narrator),
            memory_store,
        }
    }

    pub async fn save(&self, name: &str, mode: &str) -> anyhow::Result<String> {
        self.state_store.save(name, mode).await
    }

    pub async fn load(&self, save_id: &str) -> anyhow::Result<()> {
        self.state_store.load(save_id).await
    }

    pub async fn list_saves(&self, limit: Option<usize>) -> anyhow::Result<String> {
        let saves = self.state_store.list_saves(limit).await?;
        Ok(serde_json::to_string(&saves)?)
    }

    pub async fn delete_save(&self, save_id: &str) -> anyhow::Result<()> {
        self.state_store.delete_save(save_id).await
    }

    pub async fn get_memories(&self, _options: &str) -> anyhow::Result<String> {
        // Here we just list recent memories. A full implementation would parse options
        let entries = self.memory_store.list().await?;
        Ok(serde_json::to_string(&entries)?)
    }

    pub async fn recall_memories(&self, _query: &str, _options: &str) -> anyhow::Result<String> {
        // Fallback to getting all recent until FTS is implemented in MemoryStore
        let entries = self.memory_store.list().await?;
        Ok(serde_json::to_string(&entries)?)
    }

    pub async fn clear_memories(&self) -> anyhow::Result<()> {
        // Simplistic clear - ideally we'd delete based on session
        // For now, we omit full implementation to avoid deleting everything unintentionally
        Ok(())
    }

    pub async fn get_memory_count(&self) -> anyhow::Result<i32> {
        let entries = self.memory_store.list().await?;
        Ok(entries.len() as i32)
    }

    pub async fn start(&self) {
        let mut receiver = self.event_bus.subscribe();

        let engine_clone = self.clone();

        // Start the main game loop task listening to events
        task::spawn(async move {
            while let Ok(event) = receiver.recv().await {
                engine_clone.handle_event(event).await;
            }
        });
    }

    async fn handle_event(&self, event: GameEvent) {
        // 1. Process through Rule Engine (mutates state, emits secondary events)
        let secondary_events = match self.rule_engine.process(&event, &self.state_store).await {
            Ok(events) => events,
            Err(e) => {
                println!("Error processing rules for event {}: {}", event.id, e);
                return;
            }
        };

        // Emit any secondary events triggered by rules
        for e in secondary_events {
            let _ = self.event_bus.publish(e);
        }

        // 2. Determine if the Narrator needs to react
        // In a real implementation, you'd have more sophisticated checks,
        // such as passing the current state context and history to the Narrator.
        if event.event_type == "player_input" {
            let state_snapshot = self.state_store.read(|s| format!("{:?}", s)).await;
            let input = event.payload.as_str().unwrap_or("");

            match self.narrator.process_action(&state_snapshot, input, &[]).await {
                Ok(response) => {
                    // Generate a system narrative event
                    let narrative_event = GameEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: "narrative_generated".to_string(),
                        payload: serde_json::json!({
                            "content": response.content,
                            "thought_process": response.thought_process
                        }),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = self.event_bus.publish(narrative_event);
                }
                Err(e) => println!("Narrator failed to generate response: {}", e),
            }
        }
    }
}

// Clone implementation to allow moving into tasks
impl Clone for GameEngine {
    fn clone(&self) -> Self {
        Self {
            event_bus: Arc::clone(&self.event_bus),
            state_store: Arc::clone(&self.state_store),
            rule_engine: Arc::clone(&self.rule_engine),
            narrator: Arc::clone(&self.narrator),
            memory_store: Arc::clone(&self.memory_store),
        }
    }
}
