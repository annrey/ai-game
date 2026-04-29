use super::{AIProvider, AgentResponse, BaseAgent, Message, Role};
use anyhow::Result;
use std::sync::Arc;

pub struct WorldKeeperAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
    world_lore: String,
}

impl WorldKeeperAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self {
            provider,
            temperature: 0.4,
            world_lore: String::new(),
        }
    }

    pub fn set_world_lore(&mut self, lore: &str) {
        self.world_lore = lore.to_string();
    }

    pub fn check_consistency(&self, content: &str) -> bool {
        if self.world_lore.is_empty() {
            return true;
        }
        let lower_lore = self.world_lore.to_lowercase();
        let lower_content = content.to_lowercase();
        let forbidden = ["魔法", "magick", "超能力", "superpower"];
        for word in &forbidden {
            if lower_lore.contains(word) && !lower_content.contains(word) {
                continue;
            }
        }
        true
    }
}

#[async_trait::async_trait]
impl BaseAgent for WorldKeeperAgent {
    fn name(&self) -> &str {
        "WorldKeeper"
    }

    fn system_prompt(&self) -> String {
        let lore_context = if self.world_lore.is_empty() {
            "No specific world lore has been set yet.".to_string()
        } else {
            format!("World Lore:\n{}", self.world_lore)
        };

        format!(
            r#"You are the World Keeper of an interactive fiction game. Your role is to maintain the consistency of the game world and enforce its established lore.

{}

Your responsibilities:
1. Verify that player actions and narrative events conform to the world's rules and lore.
2. Provide background details about the world when asked.
3. Reject or flag content that violates established world settings.
4. Ensure continuity in geography, history, magic systems, factions, and cultures.

When responding, first provide your internal reasoning inside 【观察】, 【分析】, and 【判定】 tags.
Then, output your final assessment or world information.
Keep responses concise and focused on lore consistency."#,
            lore_context
        )
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> Result<AgentResponse> {
        let combined_context = if self.world_lore.is_empty() {
            context.to_string()
        } else {
            format!("{}\n\nWorld Lore:\n{}", context, self.world_lore)
        };

        let messages = self.build_messages(&combined_context, player_input, history);
        let raw_response = self
            .provider
            .generate_response(&messages, self.temperature)
            .await?;

        Ok(self.extract_chain_of_thought(&raw_response))
    }
}
