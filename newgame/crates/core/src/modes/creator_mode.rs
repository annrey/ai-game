/**
 * 创世模式 (Creator Mode)
 *
 * 面向用户的创造模式，允许玩家创建自己的世界和角色，
 * 并在这个自定义世界中进行冒险。
 */

use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// 世界设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldSettings {
    pub world_name: String,
    pub genre: Option<String>,
    pub tone: Option<String>,
    pub conflict: Option<String>,
    pub magic_system: Option<String>,
    pub technology_level: Option<String>,
    pub factions: Option<String>,
    pub notable_locations: Option<String>,
    pub world_history: Option<String>,
    pub world_rules: Option<String>,
}

/// 角色设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSettings {
    pub player_name: String,
    pub player_role: Option<String>,
    pub player_background: Option<String>,
    pub appearance: Option<String>,
    pub personality: Option<String>,
    pub goals: Option<String>,
    pub skills: Option<String>,
    pub equipment: Option<String>,
    pub stats_preset: StatsPreset,
    pub custom_stats: Option<CharacterStats>,
}

/// 属性预设
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StatsPreset {
    Balanced,
    Warrior,
    Mage,
    Rogue,
    Custom,
}

impl Default for StatsPreset {
    fn default() -> Self {
        StatsPreset::Balanced
    }
}

/// 角色属性值
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStats {
    pub strength: u8,
    pub agility: u8,
    pub intelligence: u8,
    pub charisma: u8,
    pub endurance: u8,
    pub luck: u8,
}

impl Default for CharacterStats {
    fn default() -> Self {
        Self {
            strength: 12,
            agility: 12,
            intelligence: 12,
            charisma: 12,
            endurance: 12,
            luck: 12,
        }
    }
}

/// 起点场景设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSettings {
    pub location: Option<String>,
    pub weather: Option<String>,
    pub time_of_day: Option<String>,
    pub starting_npcs: Option<String>,
    pub opening_scene: Option<String>,
    pub location_description: Option<String>,
}

/// 创世模式预设模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatorPreset {
    pub name: String,
    pub description: String,
    pub world: WorldSettings,
    pub character: CharacterSettings,
    pub start: StartSettings,
}

/// 创世模式
pub struct CreatorMode {
    world: WorldSettings,
    character: CharacterSettings,
    start: StartSettings,
}

impl CreatorMode {
    pub fn new(world: WorldSettings, character: CharacterSettings, start: StartSettings) -> Self {
        Self {
            world,
            character,
            start,
        }
    }

    /// 从预设快速创建
    pub fn from_preset(preset: &CreatorPreset) -> Self {
        Self {
            world: preset.world.clone(),
            character: preset.character.clone(),
            start: preset.start.clone(),
        }
    }

    /// 构建规则书文本
    #[allow(dead_code)]
    fn build_rule_book(&self) -> String {
        let mut sections = Vec::new();

        sections.push(format!("[创世模式：{}]", self.world.world_name));
        sections.push(String::new());

        sections.push("【世界设定】".to_string());
        sections.push(format!("题材：{}", self.world.genre.as_deref().unwrap_or("未指定")));
        sections.push(format!("氛围：{}", self.world.tone.as_deref().unwrap_or("未指定")));
        sections.push(format!("核心冲突：{}", self.world.conflict.as_deref().unwrap_or("未指定")));

        if let Some(ref magic) = self.world.magic_system {
            sections.push(format!("魔法体系：{}", magic));
        }
        if let Some(ref tech) = self.world.technology_level {
            sections.push(format!("科技水平：{}", tech));
        }
        if let Some(ref factions) = self.world.factions {
            sections.push(format!("势力派系：{}", factions));
        }
        if let Some(ref locations) = self.world.notable_locations {
            sections.push(format!("重要地点：{}", locations));
        }
        if let Some(ref history) = self.world.world_history {
            sections.push(format!("世界历史：{}", history));
        }

        sections.push(String::new());
        sections.push("【角色设定】".to_string());
        sections.push(format!("姓名：{}", self.character.player_name));
        sections.push(format!("职业：{}", self.character.player_role.as_deref().unwrap_or("旅者")));

        if let Some(ref appearance) = self.character.appearance {
            sections.push(format!("外貌：{}", appearance));
        }
        if let Some(ref personality) = self.character.personality {
            sections.push(format!("性格：{}", personality));
        }
        if let Some(ref goals) = self.character.goals {
            sections.push(format!("目标：{}", goals));
        }
        if let Some(ref skills) = self.character.skills {
            sections.push(format!("技能：{}", skills));
        }
        if let Some(ref equipment) = self.character.equipment {
            sections.push(format!("装备：{}", equipment));
        }
        if let Some(ref background) = self.character.player_background {
            sections.push(format!("背景：{}", background));
        }

        sections.push(String::new());
        sections.push("【属性值】".to_string());
        let stats = self.get_stats();
        sections.push(format!("  力量：{}", stats.strength));
        sections.push(format!("  敏捷：{}", stats.agility));
        sections.push(format!("  智力：{}", stats.intelligence));
        sections.push(format!("  魅力：{}", stats.charisma));
        sections.push(format!("  耐力：{}", stats.endurance));
        sections.push(format!("  幸运：{}", stats.luck));

        if let Some(ref rules) = self.world.world_rules {
            sections.push(String::new());
            sections.push("【自定义规则】".to_string());
            sections.push(rules.clone());
        }

        sections.push(String::new());
        sections.push("【创世模式特殊规则】".to_string());
        sections.push("1. 这个世界完全由玩家创造，所有设定都应尊重创世时的设定。".to_string());
        sections.push("2. NPC 的行为和对话应符合世界的题材和氛围。".to_string());
        sections.push("3. 剧情发展应围绕核心冲突展开。".to_string());
        sections.push("4. 角色的背景故事应被纳入叙事考量。".to_string());
        sections.push("5. 世界应随着玩家的行动而演化，保持动态和沉浸感。".to_string());

        sections.join("\n")
    }

    fn get_stats(&self) -> CharacterStats {
        match self.character.stats_preset {
            StatsPreset::Balanced => CharacterStats::default(),
            StatsPreset::Warrior => CharacterStats {
                strength: 16,
                agility: 10,
                intelligence: 8,
                charisma: 10,
                endurance: 14,
                luck: 10,
            },
            StatsPreset::Mage => CharacterStats {
                strength: 8,
                agility: 10,
                intelligence: 16,
                charisma: 12,
                endurance: 8,
                luck: 12,
            },
            StatsPreset::Rogue => CharacterStats {
                strength: 10,
                agility: 16,
                intelligence: 12,
                charisma: 10,
                endurance: 10,
                luck: 14,
            },
            StatsPreset::Custom => self.character.custom_stats.clone().unwrap_or_default(),
        }
    }
}

#[async_trait]
impl GameMode for CreatorMode {
    fn name(&self) -> &'static str {
        "creator-mode"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let location = self
            .start
            .location
            .clone()
            .unwrap_or_else(|| format!("{}·起点", self.world.world_name));

        let location_description = self
            .start
            .location_description
            .clone()
            .or_else(|| self.start.opening_scene.clone())
            .unwrap_or_else(|| "你站在一片未知的土地上，周围充满了可能性。".to_string());

        let weather = self.start.weather.clone().unwrap_or_else(|| "晴朗".to_string());
        let time_of_day = self
            .start
            .time_of_day
            .clone()
            .unwrap_or_else(|| "早晨".to_string());

        let stats = self.get_stats();

        let mut variables = serde_json::Map::new();
        variables.insert(
            "world_name".to_string(),
            json!(self.world.world_name),
        );
        variables.insert(
            "player_name".to_string(),
            json!(self.character.player_name),
        );
        variables.insert(
            "player_role".to_string(),
            json!(self.character.player_role.clone().unwrap_or_default()),
        );
        variables.insert(
            "player_background".to_string(),
            json!(self.character.player_background.clone().unwrap_or_default()),
        );
        variables.insert(
            "genre".to_string(),
            json!(self.world.genre.clone().unwrap_or_default()),
        );
        variables.insert(
            "tone".to_string(),
            json!(self.world.tone.clone().unwrap_or_default()),
        );
        variables.insert(
            "conflict".to_string(),
            json!(self.world.conflict.clone().unwrap_or_default()),
        );
        variables.insert(
            "current_location".to_string(),
            json!(location.clone()),
        );
        variables.insert(
            "location_description".to_string(),
            json!(location_description.clone()),
        );
        variables.insert(
            "visited_locations".to_string(),
            json!([location]),
        );
        variables.insert(
            "stats".to_string(),
            json!({
                "strength": stats.strength,
                "agility": stats.agility,
                "intelligence": stats.intelligence,
                "charisma": stats.charisma,
                "endurance": stats.endurance,
                "luck": stats.luck,
            }),
        );
        variables.insert(
            "exploration_progress".to_string(),
            json!(0),
        );

        if let Some(ref npcs) = self.start.starting_npcs {
            variables.insert("starting_npcs".to_string(), json!(npcs));
        }

        let state = WorldState {
            time_of_day,
            weather,
            variables: serde_json::Value::Object(variables),
            turn_count: 0,
            narrative: location_description.clone(),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "探索周围".to_string(),
                    description: Some("查看周围的环境".to_string()),
                    icon: Some("🔍".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "与NPC交谈".to_string(),
                    description: Some("寻找可以对话的人".to_string()),
                    icon: Some("💬".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "自定义行动".to_string(),
                    description: Some("描述你想做的事".to_string()),
                    icon: Some("💭".to_string()),
                    enabled: true,
                },
            ],
            location_name: location.clone(),
            chapter: format!("第一章 · {}的冒险", self.character.player_name).to_string(),
            health: 85,
            max_health: 100,
            mana: 60,
            max_mana: 100,
            energy: 40,
            max_energy: 100,
            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: 0,
            items_collected: 0,
            inventory: vec![],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: location.clone(),
            location_description: location_description.clone(),
            player: crate::state_store::PlayerStats {
                name: self.character.player_name.clone(),
                role: self.character.player_role.clone().unwrap_or_else(|| "旅者".to_string()),
                health: 85,
                max_health: 100,
                mana: 60,
                max_mana: 100,
                energy: 40,
                max_energy: 100,
            },
            scene_type: crate::state_store::SceneType::Custom,
        };

        let mut intro = format!(
            "【创世模式 — {}】\n\n",
            self.world.world_name
        );

        if let Some(ref genre) = self.world.genre {
            intro.push_str(&format!("题材：{}\n", genre));
        }
        if let Some(ref tone) = self.world.tone {
            intro.push_str(&format!("氛围：{}\n", tone));
        }
        intro.push('\n');

        intro.push_str(&location_description);
        intro.push_str("\n\n");

        if let Some(ref opening) = self.start.opening_scene {
            intro.push_str(opening);
            intro.push_str("\n\n");
        }

        intro.push_str("【你的角色】\n");
        intro.push_str(&format!("姓名：{}\n", self.character.player_name));
        if let Some(ref role) = self.character.player_role {
            intro.push_str(&format!("职业：{}\n", role));
        }
        if let Some(ref background) = self.character.player_background {
            intro.push_str(&format!("背景：{}\n", background));
        }
        intro.push('\n');

        intro.push_str("（输入你的行动，开始你的冒险……）");

        Ok((state, intro))
    }

    async fn process_turn(
        &self,
        state: &mut WorldState,
        player_input: &str,
    ) -> anyhow::Result<String> {
        state.turn_count += 1;

        // 创世模式的核心回合处理由 AI Agent 完成
        // 这里提供一个基础框架响应
        let input = player_input.to_lowercase();

        let world_name = self.world.world_name.clone();
        let player_name = self.character.player_name.clone();

        let response = if input.contains("看") || input.contains("观察") {
            format!(
                "{}环顾四周，仔细观察着这个由自己创造的世界。\n每一个细节都充满了可能性...",
                player_name
            )
        } else if input.contains("走") || input.contains("移动") || input.contains("去") {
            format!(
                "{}迈出了步伐，探索着{}的未知领域。\n前方似乎有什么在等待着...",
                player_name, world_name
            )
        } else if input.contains("检查") || input.contains("背包") || input.contains("物品") {
            format!(
                "{}检查了自己的随身物品，为接下来的冒险做好准备。",
                player_name
            )
        } else {
            format!(
                "{}在{}中行动着。\n这个世界正随着每一个选择而演化...",
                player_name, world_name
            )
        };

        Ok(response)
    }
}

/// 预设模板库
pub mod presets {
    use super::*;

    pub fn dark_fantasy() -> CreatorPreset {
        CreatorPreset {
            name: "暗黑奇幻".to_string(),
            description: "一个被永恒黑夜笼罩的世界，古老的邪恶正在苏醒".to_string(),
            world: WorldSettings {
                world_name: "永夜大陆".to_string(),
                genre: Some("暗黑奇幻".to_string()),
                tone: Some("阴郁、绝望中带着希望".to_string()),
                conflict: Some("远古的暗影之王正在苏醒，世界需要新的英雄".to_string()),
                magic_system: Some("血魔法与灵魂契约，使用魔法需要付出代价".to_string()),
                technology_level: Some("中世纪，但有古代遗迹中的神秘科技".to_string()),
                factions: Some("光明教会、暗影议会、自由佣兵团、古代守护者".to_string()),
                notable_locations: Some("永夜城、遗忘森林、龙骨荒原、灵魂之井".to_string()),
                world_history: Some("千年前，暗影之王被封印。如今封印松动，黑暗再次蔓延。".to_string()),
                world_rules: None,
            },
            character: CharacterSettings {
                player_name: "无名者".to_string(),
                player_role: Some("被诅咒的战士".to_string()),
                player_background: Some("你曾是一名荣耀的骑士，但在一次任务中被暗影诅咒。现在你必须在被黑暗吞噬之前找到解除诅咒的方法。".to_string()),
                appearance: None,
                personality: None,
                goals: None,
                skills: None,
                equipment: None,
                stats_preset: StatsPreset::Warrior,
                custom_stats: None,
            },
            start: StartSettings {
                location: Some("永夜城·破败酒馆".to_string()),
                weather: Some("永夜，血月高悬".to_string()),
                time_of_day: Some("深夜".to_string()),
                starting_npcs: None,
                opening_scene: Some("酒馆的烛光摇曳，窗外传来不祥的嚎叫。一个神秘的陌生人正注视着你...".to_string()),
                location_description: Some("破败的酒馆里弥漫着霉味和廉价麦酒的气息。几张摇摇晃晃的木桌旁坐着几个披着斗篷的身影。".to_string()),
            },
        }
    }

    pub fn steampunk_city() -> CreatorPreset {
        CreatorPreset {
            name: "蒸汽朋克都市".to_string(),
            description: "齿轮转动的巨型城市，蒸汽与魔法交织的工业革命".to_string(),
            world: WorldSettings {
                world_name: "齿轮城".to_string(),
                genre: Some("蒸汽朋克".to_string()),
                tone: Some("繁华与腐朽并存，充满机遇与危险".to_string()),
                conflict: Some("大企业与地下反抗组织的战争，以及神秘的\"齿轮瘟疫\"".to_string()),
                magic_system: Some("以太科技——将魔法能量通过机械装置释放".to_string()),
                technology_level: Some("蒸汽动力与魔法机械并存，有飞艇和差分机".to_string()),
                factions: Some("钢铁财团、齿轮兄弟会、以太学者协会、黑市商人联盟".to_string()),
                notable_locations: Some("中央齿轮塔、蒸汽港、地下城、以太实验室".to_string()),
                world_history: Some("工业革命由魔法驱动，城市在百年间膨胀成巨兽。但齿轮瘟疫开始让人们机械化...".to_string()),
                world_rules: None,
            },
            character: CharacterSettings {
                player_name: "侦探".to_string(),
                player_role: Some("私家侦探".to_string()),
                player_background: Some("你是一位专门调查超自然案件的侦探，拥有一只机械义眼和一把改装过的以太手枪。".to_string()),
                appearance: None,
                personality: None,
                goals: None,
                skills: None,
                equipment: None,
                stats_preset: StatsPreset::Rogue,
                custom_stats: None,
            },
            start: StartSettings {
                location: Some("蒸汽港·\"生锈齿轮\"酒馆".to_string()),
                weather: Some("雾霾，偶尔有酸雨".to_string()),
                time_of_day: Some("黄昏".to_string()),
                starting_npcs: None,
                opening_scene: Some("酒馆的蒸汽管道发出嘶嘶声，一个蒙面人塞给你一张写着\"齿轮瘟疫真相\"的纸条...".to_string()),
                location_description: Some("酒馆里充满了蒸汽和机油的味道。巨大的齿轮在天花板上缓慢转动，投下变幻的阴影。".to_string()),
            },
        }
    }

    pub fn xianxia() -> CreatorPreset {
        CreatorPreset {
            name: "修仙世界".to_string(),
            description: "灵气充沛的仙侠世界，追求长生与大道".to_string(),
            world: WorldSettings {
                world_name: "九州大陆".to_string(),
                genre: Some("仙侠修真".to_string()),
                tone: Some("逍遥自在，弱肉强食".to_string()),
                conflict: Some("千年一次的\"天劫\"即将降临，各大宗门争夺有限的渡劫资源".to_string()),
                magic_system: Some("五行灵气修炼，从炼气到渡劫共九大境界".to_string()),
                technology_level: Some("古代修仙文明，有飞剑、法宝、洞天福地".to_string()),
                factions: Some("太虚宗、魔道联盟、散修联盟、妖族圣殿".to_string()),
                notable_locations: Some("昆仑仙山、幽冥深渊、蓬莱仙境、万妖森林".to_string()),
                world_history: Some("上古时期仙魔大战，天道受损。如今灵气复苏，但天劫也变得更加凶险。".to_string()),
                world_rules: None,
            },
            character: CharacterSettings {
                player_name: "散修".to_string(),
                player_role: Some("散修".to_string()),
                player_background: Some("你没有宗门背景，靠一本偶然得到的残缺功法开始修炼。你的资质平庸，但悟性惊人。".to_string()),
                appearance: None,
                personality: None,
                goals: None,
                skills: None,
                equipment: None,
                stats_preset: StatsPreset::Balanced,
                custom_stats: None,
            },
            start: StartSettings {
                location: Some("青牛镇·破旧道观".to_string()),
                weather: Some("灵气氤氲，彩云缭绕".to_string()),
                time_of_day: Some("清晨".to_string()),
                starting_npcs: None,
                opening_scene: Some("你在破旧的道观中打坐，突然感受到一股强大的灵气波动从后山传来...".to_string()),
                location_description: Some("破旧的道观坐落在青山之间，门前有两棵千年古松。晨钟暮鼓，仙鹤飞舞。".to_string()),
            },
        }
    }

    pub fn post_apocalypse() -> CreatorPreset {
        CreatorPreset {
            name: "末日废土".to_string(),
            description: "文明崩塌后的世界，幸存者们在废墟中挣扎求生".to_string(),
            world: WorldSettings {
                world_name: "废土".to_string(),
                genre: Some("末日废土".to_string()),
                tone: Some("残酷、荒凉、人性考验".to_string()),
                conflict: Some("资源枯竭，变异生物横行，各幸存者营地之间的战争".to_string()),
                magic_system: Some("无魔法，但有辐射导致的变异能力和古代科技遗物".to_string()),
                technology_level: Some("现代武器与古代高科技遗物并存".to_string()),
                factions: Some("钢铁兄弟会、游民部落、净化者、拾荒者联盟".to_string()),
                notable_locations: Some("死亡都市、辐射沼泽、避难所72号、天空农场".to_string()),
                world_history: Some("大灾变发生在50年前，原因不明。文明倒退，但废墟中仍有宝藏。".to_string()),
                world_rules: None,
            },
            character: CharacterSettings {
                player_name: "拾荒者".to_string(),
                player_role: Some("拾荒者".to_string()),
                player_background: Some("你在废墟中长大，靠寻找古代遗物为生。你有一张旧世界地图，标记着一个传说中的\"天堂\"地点。".to_string()),
                appearance: None,
                personality: None,
                goals: None,
                skills: None,
                equipment: None,
                stats_preset: StatsPreset::Rogue,
                custom_stats: None,
            },
            start: StartSettings {
                location: Some("废墟·废弃加油站".to_string()),
                weather: Some("沙尘暴前的闷热".to_string()),
                time_of_day: Some("正午".to_string()),
                starting_npcs: None,
                opening_scene: Some("加油站的废墟中，你的辐射探测器突然发出警报。远处，一群变异生物正在接近...".to_string()),
                location_description: Some("废弃的加油站只剩下几根扭曲的钢架和破碎的玻璃。远处可以看到死亡都市的轮廓。".to_string()),
            },
        }
    }

    pub fn cosmic_horror() -> CreatorPreset {
        CreatorPreset {
            name: "宇宙恐怖".to_string(),
            description: "在浩瀚宇宙中，人类只是渺小而无关紧要的尘埃".to_string(),
            world: WorldSettings {
                world_name: "阿卡姆".to_string(),
                genre: Some("宇宙恐怖/克苏鲁".to_string()),
                tone: Some("压抑、不可名状的恐惧、疯狂边缘".to_string()),
                conflict: Some("古老的宇宙存在正在苏醒，人类的理智和存在都受到威胁".to_string()),
                magic_system: Some("禁忌知识——了解得越多，理智丧失得越快".to_string()),
                technology_level: Some("近未来，有星际航行和AI，但面对宇宙存在无能为力".to_string()),
                factions: Some("密斯卡托尼克大学、星之子教会、政府特殊部门、独立调查员".to_string()),
                notable_locations: Some("阿卡姆镇、拉莱耶遗迹、南极古城、梦境维度".to_string()),
                world_history: Some("人类只是宇宙中的短暂火花。古老的存在沉睡在深海、地心和异次元中。".to_string()),
                world_rules: None,
            },
            character: CharacterSettings {
                player_name: "调查员".to_string(),
                player_role: Some("调查员".to_string()),
                player_background: Some("你是一位专门调查超自然事件的学者。最近，你开始做一些无法解释的梦境...".to_string()),
                appearance: None,
                personality: None,
                goals: None,
                skills: None,
                equipment: None,
                stats_preset: StatsPreset::Mage,
                custom_stats: None,
            },
            start: StartSettings {
                location: Some("阿卡姆镇·密斯卡托尼克大学图书馆".to_string()),
                weather: Some("暴风雨，雷声轰鸣".to_string()),
                time_of_day: Some("深夜".to_string()),
                starting_npcs: None,
                opening_scene: Some("在整理一批新到的古籍时，你发现了一本用未知语言写成的书。当你触碰它时，书页自动翻到了某一页...".to_string()),
                location_description: Some("图书馆的古老书架高耸入顶，空气中弥漫着旧纸张和皮革的气味。烛光在穿堂风中摇曳。".to_string()),
            },
        }
    }

    /// 获取所有预设
    pub fn all_presets() -> Vec<(&'static str, CreatorPreset)> {
        vec![
            ("dark-fantasy", dark_fantasy()),
            ("steampunk-city", steampunk_city()),
            ("xianxia", xianxia()),
            ("post-apocalypse", post_apocalypse()),
            ("cosmic-horror", cosmic_horror()),
        ]
    }
}
