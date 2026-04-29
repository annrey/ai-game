use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde_json::json;

/// AI 对战 / 策略游戏模式
///
/// AI 作为对手或队友参与策略对抗。
pub struct AIBattleMode {
    opponent_name: String,
    opponent_health: i32,
}

impl AIBattleMode {
    pub fn new() -> Self {
        Self {
            opponent_name: "AI 对手".to_string(),
            opponent_health: 100,
        }
    }
}

#[async_trait]
impl GameMode for AIBattleMode {
    fn name(&self) -> &'static str {
        "ai-battle"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let state = WorldState {
            time_of_day: "正午".to_string(),
            weather: "晴朗".to_string(),
            variables: json!({
                "location": "竞技场中央",
                "player_health": 100,
                "opponent_health": 100,
                "opponent_name": "AI 对手",
                "turn": 1,
                "battle_log": []
            }),
            turn_count: 0,

            narrative: "你站在竞技场中央，对面是你的 AI 对手。空气中弥漫着紧张的气息，战斗即将开始。".to_string(),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "攻击".to_string(),
                    description: Some("发动一次强力攻击".to_string()),
                    icon: Some("⚔️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "防御".to_string(),
                    description: Some("采取防御姿态".to_string()),
                    icon: Some("🛡️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "蓄力".to_string(),
                    description: Some("积蓄力量，准备下一回合".to_string()),
                    icon: Some("⚡".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "4".to_string(),
                    text: "观察对手".to_string(),
                    description: Some("仔细观察对手的动作".to_string()),
                    icon: Some("👁️".to_string()),
                    enabled: true,
                },
            ],
            location_name: "竞技场中央".to_string(),
            chapter: "第一回合 · 战斗开始".to_string(),

            health: 100,
            max_health: 100,
            mana: 60,
            max_mana: 100,
            energy: 40,
            max_energy: 100,

            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: 1,
            items_collected: 0,

            inventory: vec![],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: "竞技场中央".to_string(),
            location_description: "你站在竞技场中央，对面是你的 AI 对手。空气中弥漫着紧张的气息，战斗即将开始。".to_string(),
            player: crate::state_store::PlayerStats {
                name: "玩家".to_string(),
                role: "战士".to_string(),
                health: 100,
                max_health: 100,
                mana: 60,
                max_mana: 100,
                energy: 40,
                max_energy: 100,
            },
            scene_type: "dungeon".to_string(),
        };

        let intro = r#"【AI 对战模式】
你站在竞技场中央，对面是你的 AI 对手。
它面无表情地注视着你，系统提示音响起：
「第一回合 —— 战斗开始！」

可用指令：攻击、防御、蓄力、观察对手"#
            .to_string();

        Ok((state, intro))
    }

    async fn process_turn(
        &self,
        state: &mut WorldState,
        player_input: &str,
    ) -> anyhow::Result<String> {
        state.turn_count += 1;

        let input = player_input.to_lowercase();

        // 玩家行动解析
        let player_action = if input.contains("攻击") {
            "攻击"
        } else if input.contains("防御") {
            "防御"
        } else if input.contains("蓄力") {
            "蓄力"
        } else if input.contains("观察") {
            "观察"
        } else {
            "待机"
        };

        // 模拟 AI 决策（后续可接入 LLM）
        let ai_action = match state.turn_count % 3 {
            0 => "防御",
            1 => "攻击",
            _ => "蓄力",
        };

        // 简单战斗结算
        let mut narrative = format!("你选择了：{}\n", player_action);
        narrative.push_str(&format!("{} 选择了：{}\n\n", self.opponent_name, ai_action));

        match (player_action, ai_action) {
            ("攻击", "防御") => {
                narrative.push_str("你的攻击被对手格挡了！\nAI 对手冷笑一声：「就这点本事？」");
            }
            ("攻击", "攻击") => {
                narrative.push_str("双方同时出手！\n你们各受了些轻伤，但战意更盛了。");
            }
            ("防御", "攻击") => {
                narrative.push_str("你成功防御了对手的猛攻！\n反击的机会就在眼前。");
            }
            ("蓄力", "蓄力") => {
                narrative.push_str("双方都在积蓄力量……\n空气中弥漫着紧张的气息。");
            }
            _ => {
                narrative.push_str("回合结束，局势暂时僵持。\n下一回合请做好准备。");
            }
        }

        Ok(narrative)
    }
}
