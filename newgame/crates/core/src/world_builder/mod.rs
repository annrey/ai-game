/**
 * World Builder - 世界构建器核心模块
 *
 * 提供深度世界编辑功能：
 * - 可视化世界地图编辑
 * - 角色创建与属性系统
 * - 派系与NPC管理
 * - 任务与剧情线设计
 * - 规则引擎集成
 */

pub mod map;
pub mod character;
pub mod faction;
pub mod quest;
pub mod timeline;
pub mod asset;

use serde::{Deserialize, Serialize};

/// 完整的世界定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldDefinition {
    pub metadata: WorldMetadata,
    pub settings: WorldSettings,
    pub map: map::WorldMap,
    pub characters: Vec<character::CharacterDefinition>,
    pub factions: Vec<faction::FactionDefinition>,
    pub quests: Vec<quest::QuestDefinition>,
    pub timeline: timeline::WorldTimeline,
    pub rules: Vec<RuleDefinition>,
    pub assets: Vec<asset::WorldAsset>,
}

/// 世界元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub genre: String,
    pub tone: String,
    pub visibility: WorldVisibility,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorldVisibility {
    Private,
    Public,
    Shared,
}

/// 世界基础设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldSettings {
    pub world_name: String,
    pub genre: String,
    pub tone: String,
    pub conflict: String,
    pub magic_system: Option<String>,
    pub technology_level: String,
    pub time_system: TimeSystem,
    pub economy_system: EconomySystem,
    pub weather_system: WeatherSystem,
    pub custom_rules: Vec<String>,
}

/// 时间系统
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSystem {
    pub day_length_minutes: u32,
    pub season_enabled: bool,
    pub seasons: Vec<String>,
    pub season_length_days: u32,
    pub year_length_days: u32,
}

/// 经济系统
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomySystem {
    pub currency_name: String,
    pub starting_gold: i32,
    pub inflation_rate: f32,
    pub trade_routes: Vec<TradeRoute>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRoute {
    pub from_location: String,
    pub to_location: String,
    pub goods: Vec<String>,
    pub risk_level: u8,
}

/// 天气系统
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherSystem {
    pub climate_type: ClimateType,
    pub weather_events: Vec<WeatherEvent>,
    pub temperature_range: (i32, i32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClimateType {
    Temperate,
    Tropical,
    Arid,
    Polar,
    Continental,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherEvent {
    pub name: String,
    pub description: String,
    pub probability: f32,
    pub duration_hours: u32,
    pub effects: Vec<String>,
}

/// 自定义规则定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleDefinition {
    pub id: String,
    pub name: String,
    pub condition: String,
    pub action: String,
    pub priority: u8,
}

impl WorldDefinition {
    pub fn new(name: &str, author: &str) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            metadata: WorldMetadata {
                id: uuid::Uuid::new_v4().to_string(),
                name: name.to_string(),
                description: String::new(),
                author: author.to_string(),
                version: "1.0.0".to_string(),
                created_at: now,
                updated_at: now,
                tags: vec![],
                genre: String::new(),
                tone: String::new(),
                visibility: WorldVisibility::Private,
            },
            settings: WorldSettings {
                world_name: name.to_string(),
                genre: String::new(),
                tone: String::new(),
                conflict: String::new(),
                magic_system: None,
                technology_level: String::new(),
                time_system: TimeSystem {
                    day_length_minutes: 1440,
                    season_enabled: true,
                    seasons: vec!["春".to_string(), "夏".to_string(), "秋".to_string(), "冬".to_string()],
                    season_length_days: 90,
                    year_length_days: 360,
                },
                economy_system: EconomySystem {
                    currency_name: "金币".to_string(),
                    starting_gold: 100,
                    inflation_rate: 0.0,
                    trade_routes: vec![],
                },
                weather_system: WeatherSystem {
                    climate_type: ClimateType::Temperate,
                    weather_events: vec![],
                    temperature_range: (0, 30),
                },
                custom_rules: vec![],
            },
            map: map::WorldMap::new(),
            characters: vec![],
            factions: vec![],
            quests: vec![],
            timeline: timeline::WorldTimeline::new(),
            rules: vec![],
            assets: vec![],
        }
    }

    /// 序列化为 JSON
    pub fn to_json(&self) -> anyhow::Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// 从 JSON 反序列化
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        Ok(serde_json::from_str(json)?)
    }

    /// 保存到文件
    pub async fn save_to_file(&self, path: &std::path::Path) -> anyhow::Result<()> {
        let json = self.to_json()?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }

    /// 从文件加载
    pub async fn load_from_file(path: &std::path::Path) -> anyhow::Result<Self> {
        let json = tokio::fs::read_to_string(path).await?;
        Self::from_json(&json)
    }

    /// 添加角色
    pub fn add_character(&mut self, character: character::CharacterDefinition) {
        self.characters.push(character);
    }

    /// 添加派系
    pub fn add_faction(&mut self, faction: faction::FactionDefinition) {
        self.factions.push(faction);
    }

    /// 添加任务
    pub fn add_quest(&mut self, quest: quest::QuestDefinition) {
        self.quests.push(quest);
    }

    /// 添加地点到地图
    pub fn add_location(&mut self, location: map::Location) {
        self.map.add_location(location);
    }

    /// 验证世界定义完整性
    pub fn validate(&self) -> Vec<ValidationError> {
        let mut errors = vec![];

        if self.settings.world_name.is_empty() {
            errors.push(ValidationError {
                field: "world_name".to_string(),
                message: "世界名称不能为空".to_string(),
                severity: ErrorSeverity::Error,
            });
        }

        if self.characters.is_empty() {
            errors.push(ValidationError {
                field: "characters".to_string(),
                message: "至少需要创建一个角色".to_string(),
                severity: ErrorSeverity::Warning,
            });
        }

        if self.map.locations.is_empty() {
            errors.push(ValidationError {
                field: "map".to_string(),
                message: "地图至少需要有一个地点".to_string(),
                severity: ErrorSeverity::Warning,
            });
        }

        errors
    }
}

#[derive(Debug, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub severity: ErrorSeverity,
}

#[derive(Debug, Clone)]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}
