use super::Rule;
use crate::events::GameEvent;
use crate::models::{Quest, QuestStatus};
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct QuestUpdatePayload {
    pub quest_id: String,
    pub status: Option<QuestStatus>,
    pub objective_id: Option<String>,
}

#[derive(Deserialize)]
struct QuestAddPayload {
    pub quest: Quest,
}

pub struct QuestRule;

#[async_trait]
impl Rule for QuestRule {
    fn event_type(&self) -> &str {
        "quest_event" // We can multiplex adding/updating in one rule or use separate ones
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        // Just checking if it's valid JSON for our operation types
        if event.payload.get("action").is_none() {
            return Err(anyhow!("Quest event missing 'action' field"));
        }
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let action = event.payload["action"].as_str().unwrap_or("");
        let mut new_events = vec![];

        state.mutate(|world| {
            // Ensure quests object exists
            let mut quests = world.variables["quests"].clone();
            if !quests.is_object() {
                quests = serde_json::json!({});
            }

            match action {
                "add" => {
                    if let Ok(payload) = serde_json::from_value::<QuestAddPayload>(event.payload.clone()) {
                        quests[&payload.quest.id] = serde_json::to_value(&payload.quest)
                            .expect("quest serialization is infallible for Quest type");
                        println!("Quest added: {}", payload.quest.title);
                    }
                }
                "update" => {
                    if let Ok(payload) = serde_json::from_value::<QuestUpdatePayload>(event.payload.clone()) {
                        let quest_val = quests[&payload.quest_id].clone();
                        if !quest_val.is_null() {
                            if let Ok(mut quest) = serde_json::from_value::<Quest>(quest_val.clone()) {
                                
                                if let Some(new_status) = payload.status {
                                    quest.status = new_status;
                                    if quest.status == QuestStatus::Completed {
                                        // Trigger reward logic by emitting secondary events
                                        for reward in &quest.rewards {
                                            if reward.starts_with("gold:") {
                                                let amount: i32 = reward.split(':').nth(1).unwrap_or("0").parse().unwrap_or(0);
                                                new_events.push(GameEvent {
                                                    id: uuid::Uuid::new_v4().to_string(),
                                                    event_type: "economy_transaction".to_string(),
                                                    payload: serde_json::json!({
                                                        "amount": amount,
                                                        "reason": format!("Quest {} reward", quest.title)
                                                    }),
                                                    timestamp: chrono::Utc::now().timestamp_millis(),
                                                });
                                            }
                                            // Can add item reward logic here later
                                        }
                                    }
                                }

                                if let Some(obj_id) = payload.objective_id {
                                    for obj in &mut quest.objectives {
                                        if obj.id == obj_id {
                                            obj.is_completed = true;
                                        }
                                    }
                                }

                                quests[&payload.quest_id] = serde_json::to_value(&quest)
                                    .expect("quest serialization is infallible for Quest type");
                                println!("Quest updated: {}", payload.quest_id);
                            }
                        }
                    }
                }
                _ => {
                    println!("Unknown quest action: {}", action);
                }
            }

            world.variables["quests"] = quests;
        }).await;

        Ok(new_events)
    }
}
