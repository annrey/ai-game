/**
 * 任务与剧情系统
 *
 * 设计任务链、剧情线和事件：
 * - 主线/支线/日常任务
 * - 任务依赖关系
 * - 奖励系统
 * - 剧情分支
 */

use serde::{Deserialize, Serialize};

/// 任务定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub quest_type: QuestType,
    pub objectives: Vec<QuestObjective>,
    pub rewards: QuestRewards,
    pub prerequisites: Vec<String>,
    pub giver: Option<String>,
    pub location: Option<String>,
    pub time_limit: Option<u32>,
    pub is_repeatable: bool,
    pub branches: Vec<QuestBranch>,
    pub consequences: Vec<QuestConsequence>,
}

impl QuestDefinition {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: String::new(),
            quest_type: QuestType::Main,
            objectives: vec![],
            rewards: QuestRewards::default(),
            prerequisites: vec![],
            giver: None,
            location: None,
            time_limit: None,
            is_repeatable: false,
            branches: vec![],
            consequences: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuestType {
    Main,
    Side,
    Daily,
    Event,
    Bounty,
    Delivery,
    Investigation,
    Escort,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestObjective {
    pub id: String,
    pub description: String,
    pub objective_type: ObjectiveType,
    pub target: String,
    pub required_amount: u32,
    pub current_amount: u32,
    pub is_optional: bool,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObjectiveType {
    Kill,
    Collect,
    Deliver,
    Talk,
    Explore,
    Defend,
    Escort,
    Craft,
    Investigate,
    Solve,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestRewards {
    pub experience: u32,
    pub gold: i32,
    pub items: Vec<String>,
    pub reputation_changes: Vec<ReputationChange>,
    pub skill_rewards: Vec<SkillReward>,
    pub unlocks: Vec<String>,
}

impl Default for QuestRewards {
    fn default() -> Self {
        Self {
            experience: 0,
            gold: 0,
            items: vec![],
            reputation_changes: vec![],
            skill_rewards: vec![],
            unlocks: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationChange {
    pub faction_id: String,
    pub amount: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillReward {
    pub skill_id: String,
    pub experience: u32,
}

/// 任务分支
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestBranch {
    pub id: String,
    pub condition: String,
    pub description: String,
    pub next_quests: Vec<String>,
    pub exclusive_with: Vec<String>,
}

/// 任务后果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestConsequence {
    pub trigger: String,
    pub effect: ConsequenceEffect,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsequenceEffect {
    UnlockLocation(String),
    UnlockQuest(String),
    ChangeFactionStanding(String, i32),
    SpawnEnemy(String, u32),
    ModifyWorldState(String, String),
    Custom(String),
}
