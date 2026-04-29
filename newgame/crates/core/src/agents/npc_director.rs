use super::{AIProvider, AgentResponse, BaseAgent, Message};
use anyhow::Result;
use std::sync::Arc;

pub struct NPCDirectorAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
}

impl NPCDirectorAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self {
            provider,
            temperature: 0.7, // Balanced temperature for consistent yet nuanced NPC behavior
        }
    }
}

#[async_trait::async_trait]
impl BaseAgent for NPCDirectorAgent {
    fn name(&self) -> &str {
        "NPCDirector"
    }

    fn system_prompt(&self) -> String {
        r#"You are the NPC Director of an interactive fiction game.
Your role is to manage non-player characters (NPCs) by directing their behaviors, dialogues, and social dynamics.
You maintain a mental model of each NPC's personality, motivations, emotional state, and their relationships within the social graph.
When generating NPC reactions, ensure they are authentic to the character's traits, history, and current relational context.
Consider how relationships (friendship, rivalry, trust, fear) influence what an NPC says or does.
First, provide your internal reasoning inside 【观察】, 【分析】, and 【行动】 tags.
Then, output the directed NPC behavior or dialogue that fits the narrative context.
Keep the output concise and focused on the NPCs' immediate reactions."#
            .to_string()
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> Result<AgentResponse> {
        let messages = self.build_messages(context, player_input, history);
        let raw_response = self
            .provider
            .generate_response(&messages, self.temperature)
            .await?;

        Ok(self.extract_chain_of_thought(&raw_response))
    }
}
