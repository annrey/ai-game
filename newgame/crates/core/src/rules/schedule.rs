use super::Rule;
use crate::events::GameEvent;
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct SchedulePayload {
    pub hours: i32,
    pub description: String,
}

pub struct ScheduleRule;

#[async_trait]
impl Rule for ScheduleRule {
    fn event_type(&self) -> &str {
        "time_advance"
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        let _payload: SchedulePayload = serde_json::from_value(event.payload.clone())
            .map_err(|_| anyhow!("Invalid payload for time_advance"))?;
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let payload: SchedulePayload = serde_json::from_value(event.payload.clone()).unwrap();

        state.mutate(|world| {
            // Very simple time advancement simulation
            let current_time = world.variables["time"].as_i64().unwrap_or(8);
            let new_time = (current_time + (payload.hours as i64)) % 24;
            world.variables["time"] = serde_json::json!(new_time);

            // Determine time of day
            let time_of_day = match new_time {
                0..=5 => "Night",
                6..=11 => "Morning",
                12..=17 => "Afternoon",
                18..=23 => "Evening",
                _ => "Unknown",
            };
            world.time_of_day = time_of_day.to_string();
        }).await;

        println!("Time advanced by {} hours. Event: {}", payload.hours, payload.description);

        // Returning a notification event could be useful here
        Ok(vec![])
    }
}
