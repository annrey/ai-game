pub mod narrator;
pub mod guide;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Role {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub content: String,
    pub thought_process: Option<String>,
}

#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn generate_response(&self, messages: &[Message], temperature: f32) -> Result<String, anyhow::Error>;
}

#[async_trait]
pub trait BaseAgent: Send + Sync {
    fn name(&self) -> &str;
    fn system_prompt(&self) -> String;
    
    fn build_messages(&self, context: &str, input: &str, history: &[Message]) -> Vec<Message> {
        let mut messages = vec![Message {
            role: Role::System,
            content: self.system_prompt(),
        }];

        if !context.is_empty() {
            messages.push(Message {
                role: Role::System,
                content: format!("Current Context:\n{}", context),
            });
        }

        messages.extend_from_slice(history);

        messages.push(Message {
            role: Role::User,
            content: input.to_string(),
        });

        messages
    }

    fn extract_chain_of_thought(&self, response: &str) -> AgentResponse {
        // A simple fallback implementation. Sub-agents can override if needed.
        if let Some(start) = response.find("【观察】") {
            let thought_process = response[start..].to_string();
            let content = response[..start].trim().to_string();
            AgentResponse {
                content,
                thought_process: Some(thought_process),
            }
        } else {
            AgentResponse {
                content: response.to_string(),
                thought_process: None,
            }
        }
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> anyhow::Result<AgentResponse>;
}

pub struct AgentManager {
    agents: HashMap<String, std::sync::Arc<dyn BaseAgent>>,
}

impl Clone for AgentManager {
    fn clone(&self) -> Self {
        Self {
            agents: self.agents.clone(),
        }
    }
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    pub fn register(&mut self, id: &str, agent: std::sync::Arc<dyn BaseAgent>) {
        self.agents.insert(id.to_string(), agent);
    }

    pub fn get(&self, id: &str) -> Option<std::sync::Arc<dyn BaseAgent>> {
        self.agents.get(id).cloned()
    }

    pub fn get_all(&self) -> Vec<std::sync::Arc<dyn BaseAgent>> {
        self.agents.values().cloned().collect()
    }
}

