use crate::agents::{AIProvider, Message, Role};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    model: String,
    base_url: String,
}

impl OpenAIProvider {
    pub fn new(api_key: String, model: String, base_url: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
            base_url: base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        }
    }
}

#[async_trait]
impl AIProvider for OpenAIProvider {
    async fn generate_response(&self, messages: &[Message], temperature: f32) -> Result<String> {
        let url = format!("{}/chat/completions", self.base_url);

        let openai_messages: Vec<serde_json::Value> = messages
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
            "messages": openai_messages,
            "temperature": temperature,
        });

        let res = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await?;

        if !res.status().is_success() {
            let error_text = res.text().await?;
            return Err(anyhow!("OpenAI API error: {}", error_text));
        }

        let json_res: serde_json::Value = res.json().await?;
        let content = json_res["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| anyhow!("Invalid response format from OpenAI"))?;

        Ok(content.to_string())
    }
}
