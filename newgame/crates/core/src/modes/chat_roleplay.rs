use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde_json::json;

/// 聊天角色扮演模式
///
/// 轻量级角色扮演对话，AI 扮演多种角色。
pub struct ChatRoleplayMode {
    template: RoleplayTemplate,
}

#[derive(Debug, Clone)]
pub struct CharacterInfo {
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone)]
pub struct RoleplayTemplate {
    pub name: String,
    pub description: String,
    pub characters: Vec<CharacterInfo>,
}

impl ChatRoleplayMode {
    pub fn detective() -> Self {
        Self {
            template: RoleplayTemplate {
                name: "侦探推理".to_string(),
                description: "你是一名侦探，正在调查一起神秘案件。与各种证人和嫌疑人对话，找出真相。".to_string(),
                characters: vec![
                    CharacterInfo { name: "管家阿福".to_string(), role: "忠诚但知道秘密的老管家".to_string() },
                    CharacterInfo { name: "小姐爱丽丝".to_string(), role: "看似无辜但行为可疑的千金".to_string() },
                    CharacterInfo { name: "园丁老张".to_string(), role: "沉默寡言但观察力惊人的园丁".to_string() },
                ],
            },
        }
    }

    pub fn tavern() -> Self {
        Self {
            template: RoleplayTemplate {
                name: "酒馆奇谈".to_string(),
                description: "你走进一家异世界的酒馆，这里聚集了各种各样的旅人。每个人都有自己的故事。".to_string(),
                characters: vec![
                    CharacterInfo { name: "吟游诗人・银弦".to_string(), role: "四处旅行收集故事的精灵诗人".to_string() },
                    CharacterInfo { name: "赏金猎人・铁拳".to_string(), role: "沉默寡言的矮人战士".to_string() },
                    CharacterInfo { name: "神秘商人・面纱".to_string(), role: "贩卖奇特道具的蒙面商人".to_string() },
                ],
            },
        }
    }

    pub fn office() -> Self {
        Self {
            template: RoleplayTemplate {
                name: "职场风云".to_string(),
                description: "你是一家科技公司的新员工，需要处理各种职场关系和工作挑战。".to_string(),
                characters: vec![
                    CharacterInfo { name: "张总".to_string(), role: "严厉但公正的部门总监".to_string() },
                    CharacterInfo { name: "小林".to_string(), role: "热心但八卦的同事".to_string() },
                    CharacterInfo { name: "Kevin".to_string(), role: "技术大牛但社交恐惧的程序员".to_string() },
                ],
            },
        }
    }
}

#[async_trait]
impl GameMode for ChatRoleplayMode {
    fn name(&self) -> &'static str {
        "chat-roleplay"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let character_names: Vec<String> =
            self.template.characters.iter().map(|c| c.name.clone()).collect();

        let state = WorldState {
            time_of_day: "晚上".to_string(),
            weather: "室内".to_string(),
            variables: json!({
                "scenario": self.template.name,
                "characters": character_names,
                "conversation_turn": 0,
                "discovered_clues": []
            }),
            turn_count: 0,

            narrative: format!("你进入了「{}」的场景。{}周围的环境让你感到沉浸其中，故事即将展开。", self.template.name, self.template.description),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "与角色对话".to_string(),
                    description: Some("选择一位角色开始交谈".to_string()),
                    icon: Some("💬".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "观察环境".to_string(),
                    description: Some("仔细查看周围的细节".to_string()),
                    icon: Some("👁️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "自由行动".to_string(),
                    description: Some("描述你想做的事".to_string()),
                    icon: Some("💭".to_string()),
                    enabled: true,
                },
            ],
            location_name: self.template.name.clone(),
            chapter: "序章 · 角色扮演".to_string(),

            health: 85,
            max_health: 100,
            mana: 60,
            max_mana: 100,
            energy: 40,
            max_energy: 100,

            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: self.template.characters.len() as i32,
            items_collected: 0,

            inventory: vec![],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: self.template.name.clone(),
            location_description: format!("你进入了「{}」的场景。{}周围的环境让你感到沉浸其中，故事即将展开。", self.template.name, self.template.description),
            player: crate::state_store::PlayerStats::default(),
            scene_type: "town".to_string(),
        };

        let mut intro = format!(
            "【{}】\n\n{}\n\n你可以与以下角色对话：\n",
            self.template.name, self.template.description
        );

        for ch in &self.template.characters {
            intro.push_str(&format!("- {}（{}）\n", ch.name, ch.role));
        }

        intro.push_str("\n（输入你想说的话，或指定对象如「问阿福：案发时你在哪里？」）");

        Ok((state, intro))
    }

    async fn process_turn(
        &self,
        state: &mut WorldState,
        player_input: &str,
    ) -> anyhow::Result<String> {
        state.turn_count += 1;

        let input = player_input.to_lowercase();

        // 尝试匹配角色
        let mut matched: Option<&CharacterInfo> = None;
        for ch in &self.template.characters {
            if input.contains(&ch.name.to_lowercase()) {
                matched = Some(ch);
                break;
            }
        }

        let response = if let Some(ch) = matched {
            format!(
                "【{} 的回应】\n\n{} 看着你，似乎在斟酌措辞……\n\n「（根据你的提问，{} 会给出符合其身份的回答。此处为框架占位，后续接入 AI 生成完整对话。）」",
                ch.name, ch.name, ch.name
            )
        } else {
            "你环顾四周，思考着下一步该做什么。\n（试着指定一个角色进行对话吧。）".to_string()
        };

        Ok(response)
    }
}
