use super::{AIProvider, AgentResponse, BaseAgent, Message};
use std::sync::Arc;

pub struct GuideAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
    current_step: String,
}

impl GuideAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self {
            provider,
            temperature: 0.6, // Lower temperature for more focused guide responses
            current_step: "intro".to_string(),
        }
    }

    pub fn set_step(&mut self, step: &str) {
        self.current_step = step.to_string();
    }
}

#[async_trait::async_trait]
impl BaseAgent for GuideAgent {
    fn name(&self) -> &str {
        "Guide"
    }

    fn system_prompt(&self) -> String {
        let base_prompt = "You are a helpful and concise guide for a new player. Answer their questions clearly without breaking character.";
        
        // In a real implementation, we'd dynamically adjust the prompt based on `self.current_step`.
        // We simulate that logic here.
        match self.current_step.as_str() {
            "intro" => format!("{} Current Goal: Introduce the game world.", base_prompt),
            "character_creation" => format!("{} Current Goal: Help the player create their character.", base_prompt),
            _ => format!("{} Current Goal: Assist the player.", base_prompt),
        }
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> anyhow::Result<AgentResponse> {
        let messages = self.build_messages(context, player_input, history);
        let raw_response = self
            .provider
            .generate_response(&messages, self.temperature)
            .await?;

        Ok(self.extract_chain_of_thought(&raw_response))
    }
}
