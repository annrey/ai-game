use crate::agents::narrator::NarratorAgent;
use crate::agents::{AgentManager, BaseAgent};
use crate::event_bus::EventBus;
use crate::events::GameEvent;
use crate::rules::RuleEngine;
use crate::state_store::StateStore;
use memory::store::MemoryStore;
use std::sync::Arc;
use tokio::sync::OnceCell;
use tokio::task;
use tokio::time::{timeout, Duration};

const NARRATIVE_TIMEOUT_SECONDS: u64 = 30;

pub struct GameEngine {
    event_bus: Arc<EventBus>,
    state_store: Arc<StateStore>,
    rule_engine: Arc<RuleEngine>,
    narrator: Arc<NarratorAgent>,
    memory_store: Arc<dyn MemoryStore>,
    agent_manager: Arc<AgentManager>,
    /// 确保 start() 只被调用一次的标志
    started: OnceCell<()>,
}

impl GameEngine {
    pub fn new(
        event_bus: EventBus,
        state_store: StateStore,
        rule_engine: RuleEngine,
        narrator: NarratorAgent,
        memory_store: Arc<dyn MemoryStore>,
        agent_manager: AgentManager,
    ) -> Self {
        Self {
            event_bus: Arc::new(event_bus),
            state_store: Arc::new(state_store),
            rule_engine: Arc::new(rule_engine),
            narrator: Arc::new(narrator),
            memory_store,
            agent_manager: Arc::new(agent_manager),
            started: OnceCell::const_new(),
        }
    }

    pub fn event_bus(&self) -> Arc<EventBus> {
        Arc::clone(&self.event_bus)
    }

    pub fn state_store(&self) -> Arc<StateStore> {
        Arc::clone(&self.state_store)
    }

    pub fn agent_manager(&self) -> Arc<AgentManager> {
        Arc::clone(&self.agent_manager)
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

    pub async fn recall_memories(&self, query: &str, options: &str) -> anyhow::Result<String> {
        let all_entries = self.memory_store.list().await?;

        // Parse options for limit
        let limit = serde_json::from_str::<serde_json::Value>(options)
            .ok()
            .and_then(|v| v.get("limit").and_then(|l| l.as_u64()))
            .unwrap_or(10) as usize;

        // Simple text-based search (case-insensitive)
        let query_lower = query.to_lowercase();
        let mut scored_entries: Vec<(f32, memory::MemoryEntry)> = all_entries
            .into_iter()
            .map(|entry| {
                let content_lower = entry.content.to_lowercase();
                let score = if content_lower.contains(&query_lower) {
                    // Exact match gets higher score
                    if content_lower == query_lower {
                        1.0
                    } else {
                        0.8
                    }
                } else {
                    // Check for partial word matches
                    let query_words: Vec<&str> = query_lower.split_whitespace().collect();
                    let matches = query_words.iter().filter(|w| content_lower.contains(**w)).count();
                    if matches > 0 {
                        0.5 * (matches as f32 / query_words.len() as f32)
                    } else {
                        0.0
                    }
                };
                (score, entry)
            })
            .filter(|(score, _)| *score > 0.0)
            .collect();

        // Sort by score descending
        scored_entries.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Take top results
        let results: Vec<memory::MemoryEntry> = scored_entries
            .into_iter()
            .take(limit)
            .map(|(_, entry)| entry)
            .collect();

        Ok(serde_json::to_string(&results)?)
    }

    pub async fn clear_memories(&self) -> anyhow::Result<()> {
        self.memory_store.clear().await?;
        Ok(())
    }

    pub async fn get_memory_count(&self) -> anyhow::Result<i32> {
        let entries = self.memory_store.list().await?;
        Ok(entries.len() as i32)
    }

    pub async fn start(&self) {
        // 使用 OnceCell 确保只启动一次
        if self.started.get().is_some() {
            return;
        }

        let _ = self.started.set(());

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
            // 兼容两种 payload 格式: {"content": str} 或直接字符串
            let input = event
                .payload
                .get("content")
                .and_then(|v| v.as_str())
                .or_else(|| event.payload.as_str())
                .unwrap_or("");

            let narrative_result = timeout(
                Duration::from_secs(NARRATIVE_TIMEOUT_SECONDS),
                self.narrator.process_action(&state_snapshot, input, &[]),
            )
            .await;

            match narrative_result {
                Ok(Ok(response)) => {
                    let narrative_text = response.content.clone();
                    // 写入 state_store：更新 narrative、history、turn_count
                    self.state_store.mutate(|s| {
                        s.narrative = narrative_text.clone();
                        s.narrative_history.push(crate::state_store::NarrativeEntry {
                            content: narrative_text.clone(),
                            is_player: false,
                            timestamp: chrono::Utc::now().timestamp_millis(),
                        });
                        s.turn_count += 1;
                    }).await;
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
                    let fallback_text = format!("说书人似乎陷入了沉思……（错误：{}）", e);
                    // 写入 state_store
                    self.state_store.mutate(|s| {
                        s.narrative = fallback_text.clone();
                        s.narrative_history.push(crate::state_store::NarrativeEntry {
                            content: fallback_text.clone(),
                            is_player: false,
                            timestamp: chrono::Utc::now().timestamp_millis(),
                        });
                        s.turn_count += 1;
                    }).await;
                    let fallback_event = GameEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: "narrative_generated".to_string(),
                        payload: serde_json::json!({
                            "content": fallback_text,
                            "thought_process": None::<String>,
                        }),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = self.event_bus.publish(fallback_event);
                }
                Err(_) => {
                    println!("Narrator timed out after {}s", NARRATIVE_TIMEOUT_SECONDS);
                    let timeout_text = "说书人沉思良久，却未能及时回应。世界似乎在等待你的下一步……".to_string();
                    // 写入 state_store
                    self.state_store.mutate(|s| {
                        s.narrative = timeout_text.clone();
                        s.narrative_history.push(crate::state_store::NarrativeEntry {
                            content: timeout_text.clone(),
                            is_player: false,
                            timestamp: chrono::Utc::now().timestamp_millis(),
                        });
                        s.turn_count += 1;
                    }).await;
                    let timeout_event = GameEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: "narrative_generated".to_string(),
                        payload: serde_json::json!({
                            "content": timeout_text,
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
            agent_manager: Arc::clone(&self.agent_manager),
            started: self.started.clone(),
        }
    }
}
