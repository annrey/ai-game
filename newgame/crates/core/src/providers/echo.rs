use crate::agents::{AIProvider, Message};
use anyhow::Result;
use async_trait::async_trait;

pub struct EchoProvider {
    prefix: String,
}

impl EchoProvider {
    pub fn new() -> Self {
        Self {
            prefix: "[Echo] ".to_string(),
        }
    }

    pub fn with_prefix(prefix: impl Into<String>) -> Self {
        Self {
            prefix: prefix.into(),
        }
    }
}

impl Default for EchoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AIProvider for EchoProvider {
    async fn generate_response(&self, messages: &[Message], _temperature: f32) -> Result<String> {
        let last = messages
            .last()
            .map(|m| m.content.clone())
            .unwrap_or_else(|| "No message provided.".to_string());
        Ok(format!("{}{}", self.prefix, last))
    }
}
