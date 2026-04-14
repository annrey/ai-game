use super::{AIProvider, AgentResponse, BaseAgent, Message, Role, AgentManager};
use anyhow::Result;
use std::sync::Arc;
use futures_util::future::join_all;

pub struct NarratorAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
    agent_manager: Arc<AgentManager>,
}

impl NarratorAgent {
    pub fn new(provider: Arc<dyn AIProvider>, agent_manager: Arc<AgentManager>) -> Self {
        Self {
            provider,
            temperature: 0.8, // Default temperature for creative storytelling
            agent_manager,
        }
    }

    async fn analyze_intent(&self, player_input: &str) -> Vec<Arc<dyn BaseAgent>> {
        // Simple fallback to all agents if intent analysis fails
        // In a full port, this would call LLM to decide which agents to invoke
        self.agent_manager.get_all()
    }
}

#[async_trait::async_trait]
impl BaseAgent for NarratorAgent {
    fn name(&self) -> &str {
        "Narrator"
    }

    fn system_prompt(&self) -> String {
        r#"You are the Narrator of an interactive fiction game. 
Your goal is to describe the world vividly and react to the player's actions in an engaging way.
First, provide your internal reasoning inside 【观察】, 【分析】, and 【行动】 tags.
Then, output the narrative text that the player will see.
Keep the narrative text under 150 words."#
            .to_string()
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> Result<AgentResponse> {
        
        // 1. Analyze which sub-agents to consult
        let sub_agents = self.analyze_intent(player_input).await;

        // 2. Parallel execute sub-agents
        let mut futures = vec![];
        for agent in sub_agents {
            let ctx = context.to_string();
            let input = player_input.to_string();
            let hist = history.to_vec();
            futures.push(async move {
                let name = agent.name().to_string();
                let res = agent.process_action(&ctx, &input, &hist).await;
                (name, res)
            });
        }

        let results = join_all(futures).await;

        // 3. Combine responses
        let mut combined_context = context.to_string();
        combined_context.push_str("\n\n=== Other Storytellers' Advice ===\n");
        for (name, result) in results {
            if let Ok(resp) = result {
                combined_context.push_str(&format!("【{}】: {}\n", name, resp.content));
            }
        }

        // 4. Generate final narrative
        let messages = self.build_messages(&combined_context, player_input, history);
        let raw_response = self
            .provider
            .generate_response(&messages, self.temperature)
            .await?;

        Ok(self.extract_chain_of_thought(&raw_response))
    }
}

