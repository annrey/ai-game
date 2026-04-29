use crate::modes::GameMode;
use crate::state_store::WorldState;
use async_trait::async_trait;
use serde_json::json;

/// 经典文字冒险模式
///
/// 基于文本的交互式叙事，玩家通过输入文字指令来探索世界。
pub struct TextAdventureMode {
    world_name: String,
}

impl TextAdventureMode {
    pub fn new(world_name: impl Into<String>) -> Self {
        Self {
            world_name: world_name.into(),
        }
    }
}

#[async_trait]
impl GameMode for TextAdventureMode {
    fn name(&self) -> &'static str {
        "text-adventure"
    }

    async fn initialize(&self) -> anyhow::Result<(WorldState, String)> {
        let state = WorldState {
            time_of_day: "早晨".to_string(),
            weather: "晴朗".to_string(),
            variables: json!({
                "world_name": self.world_name,
                "current_location": "迷雾十字路口",
                "location_description": "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。",
                "visited_locations": ["迷雾十字路口"],
                "exploration_progress": 0,
            }),
            turn_count: 0,

            narrative: "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。".to_string(),
            narrative_history: vec![],
            choices: vec![
                crate::state_store::Choice {
                    id: "1".to_string(),
                    text: "向北走".to_string(),
                    description: Some("穿过茂密的森林".to_string()),
                    icon: Some("🌲".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "2".to_string(),
                    text: "向南走".to_string(),
                    description: Some("来到蜿蜒的小溪".to_string()),
                    icon: Some("💧".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "3".to_string(),
                    text: "观察周围".to_string(),
                    description: Some("查看十字路口的石碑".to_string()),
                    icon: Some("👁️".to_string()),
                    enabled: true,
                },
                crate::state_store::Choice {
                    id: "4".to_string(),
                    text: "查看背包".to_string(),
                    description: Some("检查你的物品".to_string()),
                    icon: Some("🎒".to_string()),
                    enabled: true,
                },
            ],
            location_name: "迷雾十字路口".to_string(),
            chapter: "第一章 · 启程".to_string(),

            health: 100,
            max_health: 100,
            mana: 50,
            max_mana: 100,
            energy: 80,
            max_energy: 100,

            exploration_percent: 0.0,
            locations_discovered: 1,
            npcs_met: 0,
            items_collected: 2,

            inventory: vec![
                crate::state_store::InventoryItem {
                    id: "torch".to_string(),
                    name: "火把".to_string(),
                    item_type: "Misc".to_string(),
                    quantity: 3,
                    description: "可以照亮黑暗".to_string(),
                    icon: "🔥".to_string(),
                },
                crate::state_store::InventoryItem {
                    id: "map".to_string(),
                    name: "破旧地图".to_string(),
                    item_type: "Quest".to_string(),
                    quantity: 1,
                    description: "似乎标记着某个地点".to_string(),
                    icon: "🗺️".to_string(),
                },
            ],
            quests: vec![],
            settings: crate::state_store::GameSettings::default(),
            current_location: "迷雾十字路口".to_string(),
            location_description: "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。".to_string(),
            player: crate::state_store::PlayerStats::default(),
            scene_type: "forest".to_string(),
        };

        let intro = format!(
            r#"【文字冒险模式】
欢迎来到「{}」的世界。

你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。

可用指令：
- 移动方向：北 / 南 / 东 / 西
- 查看：观察 / 检查 [物品]
- 交互：与 [NPC] 对话
- 物品：使用 [物品] / 查看背包

（输入你的行动开始冒险）"#,
            self.world_name
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

        let response = if input.contains("北") || input.contains("north") {
            "你向北走去，穿过茂密的森林。阳光透过树叶洒下斑驳的光影。".to_string()
        } else if input.contains("南") || input.contains("south") {
            "你向南走去，来到一条蜿蜒的小溪边。溪水清澈见底。".to_string()
        } else if input.contains("东") || input.contains("east") {
            "你向东走去，眼前是一片广阔的平原，远处似乎有炊烟升起。".to_string()
        } else if input.contains("西") || input.contains("west") {
            "你向西走去，进入了一片幽暗的密林。这里的树木异常高大。".to_string()
        } else if input.contains("观察") || input.contains("look") {
            "你仔细观察周围的环境。十字路口中央有一块古老的石碑，上面刻着模糊的文字。".to_string()
        } else if input.contains("检查") || input.contains("examine") {
            if input.contains("石碑") || input.contains("stone") {
                "石碑上刻着：「此路通向四方，选择你的命运。」".to_string()
            } else {
                "你想检查什么？".to_string()
            }
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
            "你思考了一会儿，但不确定该怎么做。试着输入「北」「观察」或「检查石碑」。".to_string()
        };

        Ok(response)
    }
}
