use super::{AIProvider, AgentResponse, BaseAgent, Message};
use anyhow::Result;
use std::sync::Arc;

pub struct RuleArbiterAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
}

impl RuleArbiterAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self {
            provider,
            temperature: 0.3, // Lower temperature for consistent, deterministic rule adjudication
        }
    }

    /// Rolls a die with the given number of sides and returns the result.
    /// Uses a simple random number generator seeded from the current time.
    pub fn roll_dice(sides: u32) -> u32 {
        use std::time::{SystemTime, UNIX_EPOCH};
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_nanos() as u64;
        // Simple LCG random number generator to avoid extra dependency
        let rand = ((seed.wrapping_mul(1103515245).wrapping_add(12345)) >> 16) as u32;
        (rand % sides) + 1
    }
}

#[async_trait::async_trait]
impl BaseAgent for RuleArbiterAgent {
    fn name(&self) -> &str {
        "RuleArbiter"
    }

    fn system_prompt(&self) -> String {
        r#"You are the Rule Arbiter of the game. Your sole responsibility is to handle all rule-based adjudication with absolute fairness and consistency.

Your duties include:
1. **Dice Mechanics**: Interpreting dice rolls, determining success/failure thresholds, and calculating degrees of success or failure.
2. **Combat Resolution**: Adjudicating attack rolls, damage calculation, defense checks, and status effects according to the established combat rules.
3. **Skill Checks**: Evaluating skill test difficulties, applying relevant modifiers, and determining outcomes of player attempts.
4. **Rule Consistency**: Ensuring that all rulings follow the same logic and precedent. If a rule is ambiguous, make a fair and consistent interpretation and note it.

When adjudicating:
- Be precise and objective.
- Reference the relevant rule or mechanic being applied.
- Explain your reasoning clearly.
- Maintain impartiality; you are not an ally or enemy of the player, but the guardian of fair play.

First, provide your internal reasoning inside 【观察】, 【分析】, and 【判定】 tags.
Then, output the final ruling that the player will see."#
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
