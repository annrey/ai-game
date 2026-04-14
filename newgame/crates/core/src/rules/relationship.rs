use super::Rule;
use crate::events::GameEvent;
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct RelationshipPayload {
    pub target_id: String,
    pub affinity_change: i32,
    pub interaction_type: String,
}

pub struct RelationshipRule;

#[async_trait]
impl Rule for RelationshipRule {
    fn event_type(&self) -> &str {
        "relationship_update"
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        let _payload: RelationshipPayload = serde_json::from_value(event.payload.clone())
            .map_err(|_| anyhow!("Invalid payload for relationship_update"))?;
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let payload: RelationshipPayload = serde_json::from_value(event.payload.clone()).unwrap();

        state.mutate(|world| {
            // Retrieve current relationships or initialize empty object
            let mut rels = world.variables["relationships"].clone();
            if !rels.is_object() {
                rels = serde_json::json!({});
            }

            let current_affinity = rels[&payload.target_id].as_i64().unwrap_or(0);
            let new_affinity = current_affinity + (payload.affinity_change as i64);
            
            // Limit affinity between -100 and 100 for example
            let bounded_affinity = std::cmp::min(100, std::cmp::max(-100, new_affinity));

            rels[&payload.target_id] = serde_json::json!(bounded_affinity);
            world.variables["relationships"] = rels;
        }).await;

        println!("Relationship with {} changed by {}. Reason: {}", payload.target_id, payload.affinity_change, payload.interaction_type);

        Ok(vec![])
    }
}
