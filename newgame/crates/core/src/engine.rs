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

    /// 更新叙事状态并发布 narrative_generated 事件
    async fn update_narrative_and_publish_event(
        &self,
        content: String,
        thought_process: Option<String>,
    ) {
        self.state_store.mutate(|s| {
            s.narrative = content.clone();
            s.narrative_history.push(crate::state_store::NarrativeEntry {
                content: content.clone(),
                is_player: false,
                timestamp: chrono::Utc::now().timestamp_millis(),
            });
            s.turn_count += 1;
        }).await;

        let narrative_event = GameEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: "narrative_generated".to_string(),
            payload: serde_json::json!({
                "content": content,
                "thought_process": thought_process
            }),
            timestamp: chrono::Utc::now().timestamp_millis(),
        };
        let _ = self.event_bus.publish(narrative_event);
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

            let (content, thought_process) = match narrative_result {
                Ok(Ok(response)) => (response.content, response.thought_process),
                Ok(Err(e)) => {
                    println!("Narrator failed to generate response: {}", e);
                    let fallback_text = format!("说书人似乎陷入了沉思……（错误：{}）", e);
                    (fallback_text, None)
                }
                Err(_) => {
                    println!("Narrator timed out after {}s", NARRATIVE_TIMEOUT_SECONDS);
                    let timeout_text = "说书人沉思良久，却未能及时回应。世界似乎在等待你的下一步……".to_string();
                    (timeout_text, None)
                }
            };

            self.update_narrative_and_publish_event(content, thought_process).await;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::AIProvider;
    use crate::providers::EchoProvider;
    use memory::in_memory::InMemoryStore;
    use std::sync::Arc;

    fn build_test_engine(provider: Arc<dyn AIProvider>) -> GameEngine {
        let event_bus = EventBus::new(16);
        let state_store = StateStore::new("/tmp/test_engine_saves");
        let rule_engine = RuleEngine::new();
        let memory_store = Arc::new(InMemoryStore::default());
        let agent_manager = Arc::new(AgentManager::new());
        let narrator = NarratorAgent::new(provider, Arc::clone(&agent_manager));
        let agent_manager_for_engine = (*agent_manager).clone();
        GameEngine::new(event_bus, state_store, rule_engine, narrator, memory_store, agent_manager_for_engine)
    }

    #[tokio::test]
    async fn test_update_narrative_and_publish_event_core() {
        let provider = Arc::new(EchoProvider::new());
        let engine = build_test_engine(provider);

        let test_content = "测试叙事内容".to_string();
        let thought = Some("思考过程".to_string());

        engine.update_narrative_and_publish_event(
            test_content.clone(),
            thought.clone(),
        ).await;

        let narrative = engine.state_store.read(|s| s.narrative.clone()).await;
        assert_eq!(narrative, test_content);

        let history = engine.state_store.read(|s| s.narrative_history.clone()).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].content, test_content);
        assert!(!history[0].is_player);

        let turn_count = engine.state_store.read(|s| s.turn_count).await;
        assert_eq!(turn_count, 13);
    }

    #[tokio::test]
    async fn test_update_narrative_event_payload_structure() {
        let provider = Arc::new(EchoProvider::new());
        let engine = build_test_engine(provider);
        let mut rx = engine.event_bus.subscribe();

        let test_content = "结构化测试".to_string();
        let thought = Some("链式思考...".to_string());

        engine.update_narrative_and_publish_event(
            test_content.clone(),
            thought.clone(),
        ).await;

        let event = rx.recv().await.expect("should receive narrative_generated event");
        assert_eq!(event.event_type, "narrative_generated");
        assert_eq!(event.payload["content"], test_content);
        assert_eq!(event.payload["thought_process"], "链式思考...");

        let test_content2 = "无思考过程".to_string();
        engine.update_narrative_and_publish_event(
            test_content2.clone(),
            None,
        ).await;

        let event2 = rx.recv().await.expect("should receive second narrative_generated event");
        assert_eq!(event2.event_type, "narrative_generated");
        assert_eq!(event2.payload["content"], test_content2);
        assert!(event2.payload["thought_process"].is_null());
    }

    #[tokio::test]
    async fn test_update_narrative_entry_is_not_player() {
        let provider = Arc::new(EchoProvider::new());
        let engine = build_test_engine(provider);

        let test_content = "非玩家条目测试".to_string();

        engine.update_narrative_and_publish_event(test_content, None).await;

        let history = engine.state_store.read(|s| s.narrative_history.clone()).await;
        assert_eq!(history.len(), 1);
        assert!(!history[0].is_player, "NarrativeEntry.is_player should always be false");

        engine.update_narrative_and_publish_event("第二次叙事".to_string(), None).await;

        let history = engine.state_store.read(|s| s.narrative_history.clone()).await;
        assert_eq!(history.len(), 2);
        assert!(!history[0].is_player);
        assert!(!history[1].is_player);
    }
}
