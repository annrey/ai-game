use super::Rule;
use crate::events::GameEvent;
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct EconomyPayload {
    pub amount: i32,
    pub reason: String,
}

pub struct EconomyRule;

#[async_trait]
impl Rule for EconomyRule {
    fn event_type(&self) -> &str {
        "economy_transaction"
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        let _payload: EconomyPayload = serde_json::from_value(event.payload.clone())
            .map_err(|_| anyhow!("Invalid payload for economy_transaction"))?;
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let payload: EconomyPayload = serde_json::from_value(event.payload.clone()).unwrap();

        state.mutate(|world| {
            let current_gold = world.variables["gold"].as_i64().unwrap_or(0);
            let new_gold = current_gold + (payload.amount as i64);
            // Don't allow negative gold
            world.variables["gold"] = serde_json::json!(std::cmp::max(0, new_gold));
        }).await;

        println!("Economy transaction applied. Added {} gold. Reason: {}", payload.amount, payload.reason);

        // Optionally, return an event confirming the balance update
        Ok(vec![])
    }
}
