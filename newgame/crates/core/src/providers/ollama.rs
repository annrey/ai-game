use crate::agents::{AIProvider, Message, Role};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

pub struct OllamaProvider {
    client: Client,
    model: String,
    base_url: String,
}

impl OllamaProvider {
    pub fn new(model: String, base_url: Option<String>) -> Self {
        Self {
            client: Client::new(),
            model,
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
        }
    }
}

#[async_trait]
impl AIProvider for OllamaProvider {
    async fn generate_response(&self, messages: &[Message], temperature: f32) -> Result<String> {
        let url = format!("{}/api/chat", self.base_url);

        let ollama_messages: Vec<serde_json::Value> = messages
            .iter()
            .map(|m| {
                let role_str = match m.role {
                    Role::System => "system",
                    Role::User => "user",
                    Role::Assistant => "assistant",
                };
                json!({
                    "role": role_str,
                    "content": m.content
                })
            })
            .collect();

        let payload = json!({
            "model": self.model,
            "messages": ollama_messages,
            "stream": false,
            "options": {
                "temperature": temperature
            }
        });

        let res = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        if !res.status().is_success() {
            let error_text = res.text().await?;
            return Err(anyhow!("Ollama API error: {}", error_text));
        }

        let json_res: serde_json::Value = res.json().await?;
        let content = json_res["message"]["content"]
            .as_str()
            .ok_or_else(|| anyhow!("Invalid response format from Ollama"))?;

        Ok(content.to_string())
    }
}
