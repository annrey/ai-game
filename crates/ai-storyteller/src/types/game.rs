use serde::{Deserialize, Serialize};

use super::scene::{Action, SceneState};
use super::AgentRole;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GameMode {
    TextAdventure,
    ChatRoleplay,
    NpcSandbox,
    AiBattle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Easy,
    Normal,
    Hard,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub enabled: bool,
    pub level: LogLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub mode: GameMode,
    pub theme: String,
    pub enable_combat: bool,
    pub enable_save: bool,
    pub max_turns: u32,
    pub difficulty: Difficulty,
    pub memory_max_context_chars: u32,
    pub auto_world_tick: bool,
    /// Idle timeout in seconds.
    pub idle_timeout: u32,
    pub enabled_agents: Vec<AgentRole>,
    pub max_history_turns: usize,
    pub logging: LoggingConfig,
    /// Autosave every N turns. 0 disables.
    pub auto_save_interval: u32,
    pub streaming: bool,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            mode: GameMode::TextAdventure,
            theme: "fantasy".into(),
            enable_combat: true,
            enable_save: true,
            max_turns: 1000,
            difficulty: Difficulty::Normal,
            memory_max_context_chars: 2000,
            auto_world_tick: false,
            idle_timeout: 30,
            enabled_agents: AgentRole::ALL.to_vec(),
            max_history_turns: 30,
            logging: LoggingConfig {
                enabled: false,
                level: LogLevel::Info,
            },
            auto_save_interval: 0,
            streaming: true,
        }
    }
}

impl GameConfig {
    #[allow(clippy::field_reassign_with_default)]
    pub fn for_mode(mode: GameMode) -> Self {
        let mut cfg = Self::default();
        cfg.mode = mode;
        match mode {
            GameMode::TextAdventure => {
                cfg.theme = "fantasy".into();
                cfg.auto_world_tick = true;
                cfg.idle_timeout = 300;
                cfg.auto_save_interval = 10;
                cfg.enabled_agents = vec![
                    AgentRole::Narrator,
                    AgentRole::WorldKeeper,
                    AgentRole::RuleArbiter,
                    AgentRole::DramaCurator,
                ];
            }
            GameMode::AiBattle => {
                cfg.theme = "strategy".into();
                cfg.enable_combat = true;
                cfg.auto_world_tick = false;
                cfg.enabled_agents = vec![AgentRole::Narrator, AgentRole::RuleArbiter, AgentRole::NpcDirector];
                cfg.max_history_turns = 50;
            }
            GameMode::NpcSandbox => {
                cfg.theme = "sandbox".into();
                cfg.auto_world_tick = true;
                cfg.idle_timeout = 300;
                cfg.auto_save_interval = 10;
                cfg.enabled_agents = AgentRole::ALL.to_vec();
                cfg.max_history_turns = 40;
            }
            GameMode::ChatRoleplay => {
                cfg.theme = "roleplay".into();
                cfg.enable_combat = false;
                cfg.auto_world_tick = false;
                cfg.idle_timeout = 300;
                cfg.auto_save_interval = 10;
                cfg.enabled_agents = vec![AgentRole::Narrator, AgentRole::NpcDirector];
                cfg.max_history_turns = 60;
            }
        }
        cfg
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveData {
    pub id: String,
    pub name: String,
    pub mode: GameMode,
    pub scene_state: SceneState,
    pub created_at: String,
    pub updated_at: String,
    pub history: Vec<Action>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSummary {
    pub id: String,
    pub name: String,
    pub mode: GameMode,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub icon: String,
    pub unlocked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_at: Option<String>,
}
