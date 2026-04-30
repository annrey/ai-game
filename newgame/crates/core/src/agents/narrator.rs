use super::{AIProvider, AgentResponse, BaseAgent, Message, AgentManager};
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
        let input_lower = player_input.to_lowercase();
        let all_agents = self.agent_manager.get_all();

        // Keyword-based intent detection
        let relevant_agents: Vec<Arc<dyn BaseAgent>> = all_agents
            .into_iter()
            .filter(|agent| {
                let name = agent.name().to_lowercase();
                match name.as_str() {
                    "worldkeeper" | "world_keeper" => {
                        // Environment/location related
                        input_lower.contains("去") ||
                        input_lower.contains("走") ||
                        input_lower.contains("移动") ||
                        input_lower.contains("location") ||
                        input_lower.contains("map") ||
                        input_lower.contains("方向") ||
                        input_lower.contains("哪里")
                    }
                    "rulearbiter" | "rule_arbiter" => {
                        // Rules/validation related
                        input_lower.contains("规则") ||
                        input_lower.contains("rule") ||
                        input_lower.contains("能") ||
                        input_lower.contains("可以") ||
                        input_lower.contains("允许")
                    }
                    "npcdirector" | "npc_director" => {
                        // NPC interaction related
                        input_lower.contains("说话") ||
                        input_lower.contains("交谈") ||
                        input_lower.contains("ask") ||
                        input_lower.contains("talk") ||
                        input_lower.contains("npc") ||
                        input_lower.contains("人") ||
                        input_lower.contains("告诉")
                    }
                    "dramacurator" | "drama_curator" => {
                        // Story/plot related
                        input_lower.contains("剧情") ||
                        input_lower.contains("story") ||
                        input_lower.contains("plot") ||
                        input_lower.contains("quest") ||
                        input_lower.contains("任务") ||
                        input_lower.contains("故事")
                    }
                    "guide" => {
                        // Help/tutorial related
                        input_lower.contains("帮助") ||
                        input_lower.contains("help") ||
                        input_lower.contains("怎么") ||
                        input_lower.contains("how") ||
                        input_lower.contains("guide") ||
                        input_lower.contains("向导")
                    }
                    _ => true, // Unknown agents are included by default
                }
            })
            .collect();

        // Fallback to all agents if no specific intent detected
        if relevant_agents.is_empty() {
            self.agent_manager.get_all()
        } else {
            relevant_agents
        }
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

