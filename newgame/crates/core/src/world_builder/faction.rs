/**
 * 派系系统
 *
 * 管理世界中的势力、组织、国家：
 * - 派系关系网
 * - 领土控制
 * - 政治目标
 * - 成员管理
 */

use serde::{Deserialize, Serialize};

/// 派系定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactionDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub faction_type: FactionType,
    pub alignment: FactionAlignment,
    pub territory: Vec<String>,
    pub leader: Option<String>,
    pub members: Vec<String>,
    pub goals: Vec<FactionGoal>,
    pub resources: FactionResources,
    pub relationships: Vec<FactionRelationship>,
    pub hierarchy: Vec<Rank>,
    pub history: String,
    pub secrets: Vec<String>,
    pub public_image: String,
}

impl FactionDefinition {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: String::new(),
            faction_type: FactionType::Guild,
            alignment: FactionAlignment::Neutral,
            territory: vec![],
            leader: None,
            members: vec![],
            goals: vec![],
            resources: FactionResources::default(),
            relationships: vec![],
            hierarchy: vec![],
            history: String::new(),
            secrets: vec![],
            public_image: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FactionType {
    Kingdom,
    Empire,
    Guild,
    Cult,
    Tribe,
    Corporation,
    RebelGroup,
    ReligiousOrder,
    MercenaryCompany,
    MageCircle,
    ThievesGuild,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FactionAlignment {
    Lawful,
    Neutral,
    Chaotic,
    Evil,
    Good,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactionGoal {
    pub id: String,
    pub description: String,
    pub goal_type: GoalType,
    pub priority: u8,
    pub is_public: bool,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GoalType {
    Territorial,
    Economic,
    Political,
    Religious,
    Military,
    Knowledge,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactionResources {
    pub gold: i32,
    pub influence: i32,
    pub military_strength: i32,
    pub members_count: u32,
    pub territories_count: u32,
    pub special_resources: Vec<String>,
}

impl Default for FactionResources {
    fn default() -> Self {
        Self {
            gold: 0,
            influence: 0,
            military_strength: 0,
            members_count: 0,
            territories_count: 0,
            special_resources: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactionRelationship {
    pub target_faction_id: String,
    pub relationship_type: DiplomaticStatus,
    pub trust_level: i32,
    pub trade_agreement: bool,
    pub military_alliance: bool,
    pub history: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiplomaticStatus {
    Allied,
    Friendly,
    Neutral,
    Hostile,
    AtWar,
    Vassal,
    Suzerain,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rank {
    pub title: String,
    pub level: u8,
    pub privileges: Vec<String>,
    pub requirements: String,
}
