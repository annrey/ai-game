use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentRole {
    Narrator,
    WorldKeeper,
    NpcDirector,
    RuleArbiter,
    DramaCurator,
}

impl AgentRole {
    pub const ALL: [AgentRole; 5] = [
        Self::Narrator,
        Self::WorldKeeper,
        Self::NpcDirector,
        Self::RuleArbiter,
        Self::DramaCurator,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Narrator => "narrator",
            Self::WorldKeeper => "world-keeper",
            Self::NpcDirector => "npc-director",
            Self::RuleArbiter => "rule-arbiter",
            Self::DramaCurator => "drama-curator",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CotStepType {
    Observation,
    Analysis,
    Reasoning,
    Decision,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CotStep {
    pub step: CotStepType,
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainOfThought {
    pub id: String,
    pub agent_role: AgentRole,
    pub timestamp: u64,
    pub steps: Vec<CotStep>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentResponse {
    pub from: AgentRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chain_of_thought: Option<ChainOfThought>,
}
