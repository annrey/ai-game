use crate::agents::narrator::NarratorAgent;
use crate::agents::BaseAgent;
use crate::event_bus::EventBus;
use crate::events::GameEvent;
use crate::rules::RuleEngine;
use crate::state_store::StateStore;
use memory::store::MemoryStore;
use std::sync::Arc;
use tokio::task;
use tokio::time::{timeout, Duration};

const NARRATIVE_TIMEOUT_SECONDS: u64 = 30;

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

    pub fn event_bus(&self) -> Arc<EventBus> {
        Arc::clone(&self.event_bus)
    }

    pub fn state_store(&self) -> Arc<StateStore> {
        Arc::clone(&self.state_store)
    }

    pub async fn dispatch_player_input(&self, input: &str) {
        let event = GameEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: "player_input".to_string(),
            payload: serde_json::json!({ "content": input }),
            timestamp: chrono::Utc::now().timestamp_millis(),
        };
        let _ = self.event_bus.publish(event);
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
        let entries = self.memory_store.list().await?;
        Ok(serde_json::to_string(&entries)?)
    }

    pub async fn recall_memories(&self, _query: &str, _options: &str) -> anyhow::Result<String> {
        let entries = self.memory_store.list().await?;
        Ok(serde_json::to_string(&entries)?)
    }

    pub async fn clear_memories(&self) -> anyhow::Result<()> {
        Ok(())
    }

    pub async fn get_memory_count(&self) -> anyhow::Result<i32> {
        let entries = self.memory_store.list().await?;
        Ok(entries.len() as i32)
    }

    pub async fn start(&self) {
        let mut receiver = self.event_bus.subscribe();

        let engine_clone = self.clone();

        task::spawn(async move {
            while let Ok(event) = receiver.recv().await {
                engine_clone.handle_event(event).await;
            }
        });
    }

    async fn handle_event(&self, event: GameEvent) {
        let secondary_events = match self.rule_engine.process(&event, &self.state_store).await {
            Ok(events) => events,
            Err(e) => {
                println!("Error processing rules for event {}: {}", event.id, e);
                return;
            }
        };

        for e in secondary_events {
            let _ = self.event_bus.publish(e);
        }

        if event.event_type == "player_input" {
            let state_snapshot = self.state_store.read(|s| format!("{:?}", s)).await;
            let input = event.payload.as_str().unwrap_or("");

            let narrative_result = timeout(
                Duration::from_secs(NARRATIVE_TIMEOUT_SECONDS),
                self.narrator.process_action(&state_snapshot, input, &[]),
            )
            .await;

            match narrative_result {
                Ok(Ok(response)) => {
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
                Ok(Err(e)) => {
                    println!("Narrator failed to generate response: {}", e);
                    let fallback_event = GameEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: "narrative_generated".to_string(),
                        payload: serde_json::json!({
                            "content": format!(
                                "说书人似乎陷入了沉思……（错误：{}）",
                                e
                            ),
                            "thought_process": None::<String>,
                        }),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = self.event_bus.publish(fallback_event);
                }
                Err(_) => {
                    println!("Narrator timed out after {}s", NARRATIVE_TIMEOUT_SECONDS);
                    let timeout_event = GameEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: "narrative_generated".to_string(),
                        payload: serde_json::json!({
                            "content": "说书人沉思良久，却未能及时回应。世界似乎在等待你的下一步……".to_string(),
                            "thought_process": None::<String>,
                        }),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = self.event_bus.publish(timeout_event);
                }
            }
        }
    }
}

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
