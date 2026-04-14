use super::Rule;
use crate::events::GameEvent;
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct MovePayload {
    pub direction: String,
}

pub struct MovementRule;

#[async_trait]
impl Rule for MovementRule {
    fn event_type(&self) -> &str {
        "player_move"
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        let payload: MovePayload = serde_json::from_value(event.payload.clone())
            .map_err(|_| anyhow!("Invalid payload for player_move"))?;

        let valid_directions = ["north", "south", "east", "west"];
        if !valid_directions.contains(&payload.direction.to_lowercase().as_str()) {
            return Err(anyhow!("Invalid direction: {}", payload.direction));
        }
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let payload: MovePayload = serde_json::from_value(event.payload.clone()).unwrap();

        state.mutate(|world| {
            world.variables["location"] = serde_json::json!(format!("Moved {}", payload.direction));
        }).await;

        println!("Movement rule applied. New location updated in state.");

        // We can emit secondary events if needed. E.g., 'entered_new_room'
        Ok(vec![])
    }
}
