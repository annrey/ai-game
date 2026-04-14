pub mod movement;
pub mod economy;
pub mod relationship;
pub mod schedule;
pub mod quest;
pub mod item;

use crate::events::GameEvent;
use crate::state_store::StateStore;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Rule: Send + Sync {
    /// Returns the event type this rule handles.
    fn event_type(&self) -> &str;

    /// Validates the event payload before processing.
    /// In TS this was handled by Zod. Here we deserialize and check logic.
    fn validate(&self, event: &GameEvent) -> Result<()>;

    /// Apply the rule's logic, mutating state and possibly returning new events to dispatch.
    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>>;
}

pub struct RuleEngine {
    rules: Vec<Box<dyn Rule>>,
}

impl RuleEngine {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn register_rule(&mut self, rule: Box<dyn Rule>) {
        self.rules.push(rule);
    }

    pub async fn process(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let mut new_events = Vec::new();

        for rule in &self.rules {
            if rule.event_type() == event.event_type {
                // Validate first
                if let Err(e) = rule.validate(event) {
                    println!("Rule validation failed for event {}: {}", event.id, e);
                    continue;
                }

                // Apply
                match rule.apply(event, state).await {
                    Ok(events) => new_events.extend(events),
                    Err(e) => println!("Rule execution failed for event {}: {}", event.id, e),
                }
            }
        }

        Ok(new_events)
    }
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}
