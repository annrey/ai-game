use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde_json::json;

/// NPC 沙盒模式
///
/// 专注于与 AI NPC 的自由对话和互动。
pub struct NPCSandboxMode {
    npc_name: String,
    npc_role: String,
}

impl NPCSandboxMode {
    pub fn new(npc_name: impl Into<String>, npc_role: impl Into<String>) -> Self {
        Self {
            npc_name: npc_name.into(),
            npc_role: npc_role.into(),
        }
    }
}

#[async_trait]
impl GameMode for NPCSandboxMode {
    fn name(&self) -> &'static str {
        "npc-sandbox"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let state = WorldState {
            time_of_day: "下午".to_string(),
            weather: "晴朗".to_string(),
            variables: json!({
                "npc_name": self.npc_name,
                "npc_role": self.npc_role,
                "conversation_turn": 0,
                "relationship": "neutral",
            }),
            turn_count: 0,

            narrative: format!("你坐在酒馆的角落，对面是{}。{}", self.npc_name, self.npc_role),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "打招呼".to_string(),
                    description: Some("友好地问候".to_string()),
                    icon: Some("👋".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "询问名字".to_string(),
                    description: Some("了解对方身份".to_string()),
                    icon: Some("❓".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "自由对话".to_string(),
                    description: Some("输入你想说的话".to_string()),
                    icon: Some("💬".to_string()),
                    enabled: true,
                },
            ],
            location_name: "酒馆".to_string(),
            chapter: "NPC 沙盒".to_string(),

            health: 100,
            max_health: 100,
            mana: 50,
            max_mana: 100,
            energy: 80,
            max_energy: 100,

            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: 1,
            items_collected: 0,

            inventory: vec![],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: "酒馆".to_string(),
            location_description: format!("你坐在酒馆的角落，对面是{}。{}", self.npc_name, self.npc_role),
            player: crate::state_store::PlayerStats::default(),
            scene_type: "town".to_string(),
        };

        let intro = format!(
            "【NPC 沙盒模式】\n\n你坐在酒馆的角落，对面是{}。\n{}\n\n你可以自由地与{}对话，询问任何问题，或者尝试影响{}的态度。\n\n（直接输入你想说的话）",
            self.npc_name, self.npc_role, self.npc_name, self.npc_name
        );

        Ok((state, intro))
    }

    async fn process_turn(
        &self,
        state: &mut WorldState,
        player_input: &str,
    ) -> anyhow::Result<String> {
        state.turn_count += 1;

        let input = player_input.to_lowercase();

        let response = if input.contains("你好") || input.contains("hello") {
            format!("{} 微笑着点了点头：「你好，旅行者。有什么我可以帮你的吗？」", self.npc_name)
        } else if input.contains("名字") || input.contains("name") {
            format!("{} 回答：「我是{}，{}。」", self.npc_name, self.npc_name, self.npc_role)
        } else if input.contains("再见") || input.contains("bye") {
            format!("{} 挥了挥手：「再见，愿你的旅途平安。」", self.npc_name)
        } else {
            format!("{} 沉思了一会儿，然后说：「关于{}... 这是个有趣的话题。不过我现在还不能透露太多。」", self.npc_name, player_input)
        };

        Ok(response)
    }
}
