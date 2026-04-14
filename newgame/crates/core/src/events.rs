use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEvent {
    pub id: String,
    pub event_type: String,
    pub payload: Value,
    pub timestamp: i64,
}

impl fmt::Display for GameEvent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Event(id: {}, type: {}, ts: {})",
            self.id, self.event_type, self.timestamp
        )
    }
}
