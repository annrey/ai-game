use serde::{Deserialize, Serialize};

use crate::combat::CombatState;

use super::{AgentResponse, ChainOfThought};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimePeriod {
    Dawn,
    Morning,
    Noon,
    Afternoon,
    Dusk,
    Evening,
    Night,
    Midnight,
}

impl TimePeriod {
    pub fn from_hour(hour: u32) -> Self {
        match hour {
            5..=6 => Self::Dawn,
            7..=10 => Self::Morning,
            11..=12 => Self::Noon,
            13..=16 => Self::Afternoon,
            17..=18 => Self::Dusk,
            19..=21 => Self::Evening,
            22..=23 | 0 => Self::Night,
            _ => Self::Midnight,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTime {
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub period: TimePeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentState {
    pub weather: String,
    pub lighting: String,
    pub ambiance: String,
    pub hazards: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NpcDisposition {
    Friendly,
    Neutral,
    Hostile,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcState {
    pub id: String,
    pub name: String,
    pub disposition: NpcDisposition,
    pub current_activity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRelationship {
    pub a_id: String,
    pub a_name: String,
    pub b_id: String,
    pub b_name: String,
    pub kind: String,
    pub status: String,
    pub affinity: i32,
    pub description: String,
}

impl LiveRelationship {
    pub fn pair_key(a: &str, b: &str) -> String {
        let mut ids = [a, b];
        ids.sort();
        format!("{}::{}", ids[0], ids[1])
    }

    pub fn key(&self) -> String {
        Self::pair_key(&self.a_id, &self.b_id)
    }

    pub fn status_from_affinity(affinity: i32) -> &'static str {
        match affinity {
            40.. => "allied",
            15..=39 => "friendly",
            -14..=14 => "neutral",
            -39..=-15 => "strained",
            _ => "hostile",
        }
    }

    pub fn disposition_from_affinity(affinity: i32) -> NpcDisposition {
        match affinity {
            20.. => NpcDisposition::Friendly,
            ..=-20 => NpcDisposition::Hostile,
            _ => NpcDisposition::Neutral,
        }
    }

    pub fn mood_from_affinity(affinity: i32) -> &'static str {
        match affinity {
            40.. => "亲近",
            15..=39 => "友善",
            -14..=14 => "平静",
            -39..=-15 => "戒备",
            _ => "敌意",
        }
    }

    pub fn involves(&self, id: &str) -> bool {
        self.a_id == id || self.b_id == id
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionKind {
    Move,
    Talk,
    Combat,
    Use,
    Examine,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub id: String,
    pub actor: String,
    #[serde(rename = "type")]
    pub kind: ActionKind,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlotStatus {
    Hidden,
    Foreshadowed,
    Active,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlotPoint {
    pub id: String,
    pub name: String,
    pub status: PlotStatus,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuestStatus {
    Active,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Quest {
    pub id: String,
    pub quest_id: String,
    pub title: String,
    pub description: String,
    pub status: QuestStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub objectives: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InventoryItemType {
    Weapon,
    Armor,
    Consumable,
    Quest,
    Misc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EconomyItemType {
    Drink,
    Food,
    Misc,
    Service,
    Weapon,
    Armor,
    Consumable,
    Quest,
}

impl EconomyItemType {
    pub fn to_inventory(self) -> InventoryItemType {
        match self {
            Self::Weapon => InventoryItemType::Weapon,
            Self::Armor => InventoryItemType::Armor,
            Self::Consumable | Self::Drink | Self::Food => InventoryItemType::Consumable,
            Self::Quest => InventoryItemType::Quest,
            Self::Misc | Self::Service => InventoryItemType::Misc,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub quantity: u32,
    #[serde(rename = "type")]
    pub kind: InventoryItemType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub world_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tone: Option<String>,
    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub stamina: i32,
    pub max_stamina: i32,
    pub gold: i32,
    pub visited_locations: Vec<String>,
    pub exploration_progress: u32,
    pub inventory: Vec<InventoryItem>,
    pub quests: Vec<Quest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnRecord {
    pub turn: u32,
    pub input: String,
    pub narrative: String,
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chain_of_thought: Option<ChainOfThought>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub agent_thoughts: Vec<ChainOfThought>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneState {
    pub current_location: String,
    pub location_description: String,
    pub present_npcs: Vec<NpcState>,
    pub active_plots: Vec<PlotPoint>,
    pub player_actions: Vec<Action>,
    pub pending_resolutions: Vec<serde_json::Value>,
    pub world_time: GameTime,
    pub environment: EnvironmentState,
    pub player_state: PlayerState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_turn: Option<TurnRecord>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub history: Vec<TurnRecord>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_world_event: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub combat: Option<CombatState>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub relationships: Vec<LiveRelationship>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ending: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_state_error: Option<String>,
}

impl SceneState {
    pub fn default_opening() -> Self {
        Self {
            current_location: "起始之地".into(),
            location_description: "你站在一个十字路口，四条道路向不同方向延伸。".into(),
            present_npcs: vec![],
            active_plots: vec![],
            player_actions: vec![],
            pending_resolutions: vec![],
            world_time: GameTime {
                day: 1,
                hour: 8,
                minute: 0,
                period: TimePeriod::Morning,
            },
            environment: EnvironmentState {
                weather: "晴朗".into(),
                lighting: "明亮的晨光".into(),
                ambiance: "鸟鸣和微风".into(),
                hazards: vec![],
            },
            player_state: PlayerState {
                name: "冒险者".into(),
                role: None,
                background: None,
                world_name: None,
                genre: None,
                tone: None,
                health: 100,
                max_health: 100,
                mana: 50,
                max_mana: 50,
                stamina: 100,
                max_stamina: 100,
                gold: 100,
                visited_locations: vec!["起始之地".into()],
                exploration_progress: 0,
                inventory: vec![
                    InventoryItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "生锈的铁剑".into(),
                        description: Some("一把用来防身的旧武器".into()),
                        quantity: 1,
                        kind: InventoryItemType::Weapon,
                    },
                    InventoryItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "微型治疗药水".into(),
                        description: Some("恢复少量生命值".into()),
                        quantity: 3,
                        kind: InventoryItemType::Consumable,
                    },
                ],
                quests: vec![],
            },
            current_turn: None,
            history: vec![],
            last_world_event: None,
            combat: None,
            relationships: vec![],
            ending: None,
            last_state_error: None,
        }
    }

    pub fn context_summary(&self) -> serde_json::Value {
        serde_json::json!({
            "location": self.current_location,
            "locationDesc": self.location_description,
            "npcs": self.present_npcs.iter().map(|n| format!("{}({:?})", n.name, n.disposition)).collect::<Vec<_>>(),
            "time": format!("第{}天 {}:{} ({:?})", self.world_time.day, self.world_time.hour, self.world_time.minute, self.world_time.period),
            "weather": self.environment.weather,
            "inventory": self.player_state.inventory.iter().map(|i| format!("{}x{}", i.name, i.quantity)).collect::<Vec<_>>(),
            "quests": self.player_state.quests.iter().map(|q| format!("[{:?}] {}: {}", q.status, q.title, q.description)).collect::<Vec<_>>(),
            "worldEvent": self.last_world_event,
            "combat": self.combat,
            "relationships": self.relationships.iter().map(|r| {
                format!("{}↔{} {}({})", r.a_name, r.b_name, r.status, r.affinity)
            }).collect::<Vec<_>>(),
            "ending": self.ending,
            "stateError": self.last_state_error,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnResult {
    pub narrative: String,
    pub agent_details: Vec<AgentResponse>,
    pub state_snapshot: serde_json::Value,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}
