use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde_json::json;

/// 类星露谷生活模拟模式
///
/// 农场经营、社交、探索的休闲模式。
pub struct StardewValleyMode {
    farm_name: String,
}

impl StardewValleyMode {
    pub fn new(farm_name: impl Into<String>) -> Self {
        Self {
            farm_name: farm_name.into(),
        }
    }
}

#[async_trait]
impl GameMode for StardewValleyMode {
    fn name(&self) -> &'static str {
        "stardew-valley"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let state = WorldState {
            time_of_day: "早晨".to_string(),
            weather: "晴朗".to_string(),
            variables: json!({
                "farm_name": self.farm_name,
                "day": 1,
                "season": "春",
                "gold": 500,
                "crops": [],
                "animals": [],
                "friendship": {},
            }),
            turn_count: 0,

            narrative: format!("你站在{}的门口，清晨的阳光洒在新翻的土地上。今天是个适合劳作的好日子。", self.farm_name),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "翻土".to_string(),
                    description: Some("用锄头翻松土地".to_string()),
                    icon: Some("⛏️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "播种".to_string(),
                    description: Some("将种子埋入土中".to_string()),
                    icon: Some("🌱".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "浇水".to_string(),
                    description: Some("给作物浇水".to_string()),
                    icon: Some("🚿".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "4".to_string(),
                    text: "去镇上".to_string(),
                    description: Some("探索小镇".to_string()),
                    icon: Some("🏘️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "5".to_string(),
                    text: "查看背包".to_string(),
                    description: Some("检查你的物品".to_string()),
                    icon: Some("🎒".to_string()),
                    enabled: true,
                },
            ],
            location_name: self.farm_name.clone(),
            chapter: "第一年 · 春季".to_string(),

            health: 100,
            max_health: 100,
            mana: 50,
            max_mana: 100,
            energy: 100,
            max_energy: 100,

            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: 0,
            items_collected: 3,

            inventory: vec![
                crate::state_store::InventoryItem {
                    id: "hoe".to_string(),
                    name: "锄头".to_string(),
                    item_type: "Tool".to_string(),
                    quantity: 1,
                    description: "用来翻土".to_string(),
                    icon: "⛏️".to_string(),
                },
                crate::state_store::InventoryItem {
                    id: "seeds".to_string(),
                    name: "种子".to_string(),
                    item_type: "Material".to_string(),
                    quantity: 15,
                    description: "可以种出作物".to_string(),
                    icon: "🌱".to_string(),
                },
                crate::state_store::InventoryItem {
                    id: "watering_can".to_string(),
                    name: "浇水壶".to_string(),
                    item_type: "Tool".to_string(),
                    quantity: 1,
                    description: "给作物浇水".to_string(),
                    icon: "🚿".to_string(),
                },
            ],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: self.farm_name.clone(),
            location_description: format!("你站在{}的门口，清晨的阳光洒在新翻的土地上。今天是个适合劳作的好日子。", self.farm_name),
            player: crate::state_store::PlayerStats::default(),
            scene_type: "farm".to_string(),
        };

        let intro = format!(
            "【星露谷模式】\n\n欢迎来到{}！\n\n你继承了祖父留下的老旧农场。虽然杂草丛生，但土地肥沃，充满潜力。\n\n今天是第一天，清晨的阳光温暖而明亮。\n\n可用指令：\n- 耕作：翻土 / 播种 / 浇水\n- 探索：去镇上 / 去森林 / 去矿洞\n- 社交：与 [NPC] 交谈\n- 经营：查看背包 / 查看任务\n\n（输入你的行动开始农场生活）",
            self.farm_name
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

        let response = if input.contains("翻土") || input.contains("hoe") {
            "你挥动锄头，将杂草丛生的土地翻松。泥土的芬芳扑鼻而来。".to_string()
        } else if input.contains("播种") || input.contains("plant") {
            "你小心翼翼地将种子埋入土中，期待着它们发芽成长。".to_string()
        } else if input.contains("浇水") || input.contains("water") {
            "你提着浇水壶，给干涸的土地带来滋润。".to_string()
        } else if input.contains("镇上") || input.contains("town") {
            "你沿着小路走向镇上。村民们正在各自忙碌着， Pierre 的杂货店已经开门了。".to_string()
        } else if input.contains("森林") || input.contains("forest") {
            "你走进附近的森林，采集了一些野生浆果和蘑菇。".to_string()
        } else if input.contains("矿洞") || input.contains("mine") {
            "你来到矿洞入口，里面传来滴水声和远处蝙蝠的叫声。".to_string()
        } else if input.contains("背包") || input.contains("inventory") {
            let items: Vec<String> = state.inventory.iter()
                .map(|item| format!("{} x{} ({})", item.name, item.quantity, item.description))
                .collect();
            if items.is_empty() {
                "你的背包是空的。".to_string()
            } else {
                format!("背包内容：\n{}", items.join("\n"))
            }
        } else {
            "你站在农场中，思考着今天该做些什么。".to_string()
        };

        Ok(response)
    }
}
