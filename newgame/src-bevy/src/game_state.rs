use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub current_narrative: String,
    pub narrative_history: Vec<NarrativeEntry>,
    pub choices: Vec<PlayerChoice>,
    pub selected_choice: Option<usize>,
    pub is_processing: bool,
    pub scene_type: SceneType,
    pub location_name: String,
    pub chapter: String,
    pub turn_count: i32,
    
    // 角色状态
    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub energy: i32,
    pub max_energy: i32,
    
    // 游戏时间
    pub game_time: GameTime,
    pub weather: Weather,
    
    // 世界状态
    pub exploration_percent: f32,
    pub locations_discovered: i32,
    pub npcs_met: i32,
    pub items_collected: i32,
    
    // 库存
    pub inventory: Vec<InventoryItem>,
    
    // 任务
    pub quests: Vec<Quest>,
    
    // 设置
    pub settings: GameSettings,

    // 引擎快照
    pub engine_snapshot: EngineSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeEntry {
    pub content: String,
    pub is_player: bool,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerChoice {
    pub id: String,
    pub text: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum SceneType {
    #[default]
    Forest,
    Town,
    Dungeon,
    Beach,
    Mountain,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTime {
    pub year: i32,
    pub month: i32,
    pub day: i32,
    pub hour: i32,
    pub minute: i32,
    pub time_of_day: TimeOfDay,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum TimeOfDay {
    #[default]
    Morning,
    Dawn,
    Noon,
    Afternoon,
    Dusk,
    Night,
    Midnight,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum Weather {
    #[default]
    Clear,
    Cloudy,
    Rain,
    Storm,
    Snow,
    Fog,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub item_type: ItemType,
    pub quantity: i32,
    pub description: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemType {
    Weapon,
    Armor,
    Consumable,
    Material,
    Quest,
    Misc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quest {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: QuestStatus,
    pub objectives: Vec<QuestObjective>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuestStatus {
    Active,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestObjective {
    pub id: String,
    pub description: String,
    pub is_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSettings {
    pub single_screen_mode: bool,
    pub compact_layout: bool,
    pub font_size: FontSize,
    pub story_clamp_lines: i32,
    pub log_preview_count: i32,
    pub hide_choice_descriptions: bool,
    pub show_sidebar: bool,
    pub show_right_panel: bool,
    pub show_scene_meta: bool,
    pub show_council: bool,
    pub show_reasoning: bool,
    pub show_cot: bool,
    pub show_world: bool,
    pub show_character: bool,
    pub show_inventory: bool,
    pub show_quests: bool,
    pub show_log: bool,
    pub auto_world_tick: bool,
    pub idle_timeout_seconds: i32,
    pub game_mode: GameMode,
    pub language: String,
    pub streaming: bool,
    pub engine_logging: bool,
    pub max_history_turns: i32,
    pub memory_max_chars: i32,
    pub auto_save_interval: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ConnectionStatus {
    Online,
    Offline,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum EngineBackend {
    Ollama,
    Echo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineSnapshot {
    pub backend: Option<EngineBackend>,
    pub connection_status: ConnectionStatus,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FontSize {
    Small,
    Normal,
    Large,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameMode {
    TextAdventure,
    AIBattle,
    NPCSandbox,
    ChatRoleplay,
    StardewValley,
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}

impl GameState {
    pub fn new() -> Self {
        Self {
            current_narrative: "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。空气中弥漫着清晨特有的清新，偶尔可以听到远处传来的鸟鸣声。\n\n四条道路由粗糙的石块铺成，两旁长满了青苔和野花。东边的道路似乎延伸得更远一些，尽头隐约可见一束微弱的光芒；而其他三条道路则显得较为平缓，没有特别明显的特征。\n\n古老的石碑矗立在西边路口，上面刻着模糊不清的符文。北边的路上有块路标，虽然有些风化，但依然清晰地写着：「未知之路」四个字。".to_string(),
            narrative_history: vec![],
            choices: vec![
                PlayerChoice {
                    id: "1".to_string(),
                    text: "向东前往古老森林".to_string(),
                    description: Some("追寻那束神秘的光芒".to_string()),
                    icon: Some("🌲".to_string()),
                    enabled: true,
                },
                PlayerChoice {
                    id: "2".to_string(),
                    text: "向北踏上未知之路".to_string(),
                    description: Some("路标所指的方向".to_string()),
                    icon: Some("🏔️".to_string()),
                    enabled: true,
                },
                PlayerChoice {
                    id: "3".to_string(),
                    text: "仔细查看石碑符文".to_string(),
                    description: Some("或许隐藏着线索".to_string()),
                    icon: Some("📜".to_string()),
                    enabled: true,
                },
                PlayerChoice {
                    id: "4".to_string(),
                    text: "自定义行动".to_string(),
                    description: Some("描述你想做的事".to_string()),
                    icon: Some("💭".to_string()),
                    enabled: true,
                },
            ],
            selected_choice: None,
            is_processing: false,
            scene_type: SceneType::Forest,
            location_name: "迷雾十字路口".to_string(),
            chapter: "第一章 · 觉醒".to_string(),
            turn_count: 12,
            health: 85,
            max_health: 100,
            mana: 60,
            max_mana: 100,
            energy: 40,
            max_energy: 100,
            game_time: GameTime {
                year: 1,
                month: 1,
                day: 1,
                hour: 8,
                minute: 0,
                time_of_day: TimeOfDay::Morning,
            },
            weather: Weather::Clear,
            exploration_percent: 15.0,
            locations_discovered: 1,
            npcs_met: 0,
            items_collected: 0,
            inventory: vec![
                InventoryItem {
                    id: "torch".to_string(),
                    name: "火把".to_string(),
                    item_type: ItemType::Misc,
                    quantity: 3,
                    description: "可以照亮黑暗".to_string(),
                    icon: "🔥".to_string(),
                },
                InventoryItem {
                    id: "map".to_string(),
                    name: "破旧地图".to_string(),
                    item_type: ItemType::Quest,
                    quantity: 1,
                    description: "似乎标记着某个地点".to_string(),
                    icon: "🗺️".to_string(),
                },
            ],
            quests: vec![],
            settings: GameSettings::default(),
            engine_snapshot: EngineSnapshot {
                backend: Some(EngineBackend::Ollama),
                connection_status: ConnectionStatus::Online,
                last_error: None,
            },
        }
    }
    
    pub fn add_narrative(&mut self, content: String, is_player: bool) {
        self.narrative_history.push(NarrativeEntry {
            content: content.clone(),
            is_player,
            timestamp: chrono::Utc::now().timestamp_millis(),
        });
        self.current_narrative = content;
    }
    
    pub fn update_choices(&mut self, choices: Vec<PlayerChoice>) {
        self.choices = choices;
        self.selected_choice = None;
    }
    
    pub fn select_choice(&mut self, index: usize) -> Option<PlayerChoice> {
        if index < self.choices.len() {
            self.selected_choice = Some(index);
            Some(self.choices[index].clone())
        } else {
            None
        }
    }
}

impl Default for GameSettings {
    fn default() -> Self {
        Self {
            single_screen_mode: false,
            compact_layout: false,
            font_size: FontSize::Normal,
            story_clamp_lines: 7,
            log_preview_count: 3,
            hide_choice_descriptions: false,
            show_sidebar: true,
            show_right_panel: true,
            show_scene_meta: true,
            show_council: true,
            show_reasoning: true,
            show_cot: false,
            show_world: true,
            show_character: true,
            show_inventory: true,
            show_quests: true,
            show_log: true,
            auto_world_tick: true,
            idle_timeout_seconds: 30,
            game_mode: GameMode::TextAdventure,
            language: "zh-CN".to_string(),
            streaming: false,
            engine_logging: false,
            max_history_turns: 20,
            memory_max_chars: 2000,
            auto_save_interval: 0,
        }
    }
}
