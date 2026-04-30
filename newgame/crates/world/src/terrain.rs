use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TerrainType {
    Plains,
    Forest,
    Mountain,
    Hill,
    Desert,
    Swamp,
    River,
    Lake,
    Coast,
    Cave,
    Jungle,
    Tundra,
    Volcanic,
    Ruins,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Wood,
    Stone,
    Ore,
    Herb,
    Water,
    Food,
    Hide,
    Fiber,
    Gem,
    ManaCrystal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ClimateType {
    Temperate,
    Tropical,
    Cold,
    Arid,
    Polar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum WeatherType {
    Sunny,
    Rainy,
    Cloudy,
    Foggy,
    Stormy,
    Snowy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerrainProperties {
    pub move_difficulty: f32,
    pub visibility_multiplier: f32,
    pub concealment: f32,
    pub harvestable_resources: Vec<ResourceType>,
    pub climate_bias: ClimateType,
    pub danger_level: f32,
    pub build_difficulty: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerrainEffect {
    pub id: String,
    pub trigger: EffectTrigger,
    pub target: EffectTarget,
    pub effect_type: EffectType,
    pub value: f32,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EffectTrigger {
    Enter,
    Stay,
    Exit,
    Combat,
    Rest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EffectTarget {
    Player,
    Npc,
    All,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EffectType {
    Health,
    Stamina,
    Mood,
    Visibility,
    CombatBonus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Terrain {
    pub id: String,
    pub terrain_type: TerrainType,
    pub name: String,
    pub description: String,
    pub properties: TerrainProperties,
    pub effects: Vec<TerrainEffect>,
    pub weather_bias: HashMap<WeatherType, f32>,
}

impl Default for TerrainProperties {
    fn default() -> Self {
        Self {
            move_difficulty: 1.0,
            visibility_multiplier: 1.0,
            concealment: 0.0,
            harvestable_resources: vec![],
            climate_bias: ClimateType::Temperate,
            danger_level: 0.0,
            build_difficulty: 1.0,
        }
    }
}

impl Terrain {
    pub fn new(id: impl Into<String>, terrain_type: TerrainType, name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            terrain_type,
            name: name.into(),
            description: description.into(),
            properties: TerrainProperties::default(),
            effects: vec![],
            weather_bias: HashMap::new(),
        }
    }

    pub fn with_properties(mut self, properties: TerrainProperties) -> Self {
        self.properties = properties;
        self
    }

    pub fn with_effects(mut self, effects: Vec<TerrainEffect>) -> Self {
        self.effects = effects;
        self
    }

    pub fn with_weather_bias(mut self, bias: HashMap<WeatherType, f32>) -> Self {
        self.weather_bias = bias;
        self
    }

    pub fn get_effects_for_trigger(&self, trigger: EffectTrigger) -> Vec<&TerrainEffect> {
        self.effects.iter().filter(|e| e.trigger == trigger).collect()
    }

    pub fn get_move_cost(&self) -> f32 {
        self.properties.move_difficulty
    }

    pub fn get_combat_modifiers(&self) -> Vec<&TerrainEffect> {
        self.effects.iter().filter(|e| e.trigger == EffectTrigger::Combat).collect()
    }
}

pub struct TerrainManager {
    terrains: HashMap<String, Terrain>,
    location_terrain_map: HashMap<String, String>,
}

impl Default for TerrainManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TerrainManager {
    pub fn new() -> Self {
        let mut manager = Self {
            terrains: HashMap::new(),
            location_terrain_map: HashMap::new(),
        };
        manager.register_defaults();
        manager
    }

    pub fn register(&mut self, terrain: Terrain) {
        self.terrains.insert(terrain.id.clone(), terrain);
    }

    pub fn assign_to_location(&mut self, location_id: impl Into<String>, terrain_id: impl Into<String>) {
        self.location_terrain_map.insert(location_id.into(), terrain_id.into());
    }

    pub fn get(&self, terrain_id: &str) -> Option<&Terrain> {
        self.terrains.get(terrain_id)
    }

    pub fn get_at_location(&self, location_id: &str) -> Option<&Terrain> {
        self.location_terrain_map
            .get(location_id)
            .and_then(|tid| self.terrains.get(tid))
    }

    pub fn calculate_move_cost(&self, from_location: &str, to_location: &str) -> f32 {
        let from_cost = self.get_at_location(from_location)
            .map(|t| t.properties.move_difficulty)
            .unwrap_or(1.0);
        let to_cost = self.get_at_location(to_location)
            .map(|t| t.properties.move_difficulty)
            .unwrap_or(1.0);
        (from_cost + to_cost) / 2.0
    }

    pub fn get_combat_modifiers(&self, location_id: &str) -> Vec<&TerrainEffect> {
        self.get_at_location(location_id)
            .map(|t| t.get_combat_modifiers())
            .unwrap_or_default()
    }

    pub fn get_harvestable_resources(&self, location_id: &str) -> Vec<ResourceType> {
        self.get_at_location(location_id)
            .map(|t| t.properties.harvestable_resources.clone())
            .unwrap_or_default()
    }

    pub fn generate_description(&self, location_id: &str) -> String {
        self.get_at_location(location_id)
            .map(|t| t.description.clone())
            .unwrap_or_else(|| "一片未知的土地。".to_string())
    }

    fn register_defaults(&mut self) {
        use EffectTrigger::*;
        use EffectTarget::*;
        use EffectType::*;
        use ResourceType::*;
        use WeatherType::*;

        let plains = Terrain::new(
            "terrain_plains",
            TerrainType::Plains,
            "平原",
            "一望无际的草原，视野开阔，适合快速移动。",
        )
        .with_properties(TerrainProperties {
            move_difficulty: 1.0,
            visibility_multiplier: 1.5,
            concealment: 0.1,
            harvestable_resources: vec![Food, Herb, Fiber],
            climate_bias: ClimateType::Temperate,
            danger_level: 0.2,
            build_difficulty: 1.0,
        })
        .with_effects(vec![
            TerrainEffect {
                id: "plains_open".to_string(),
                trigger: Combat,
                target: All,
                effect_type: Visibility,
                value: 1.0,
                description: "开阔地形，远程攻击获得优势".to_string(),
            },
        ])
        .with_weather_bias(HashMap::from([
            (Sunny, 0.3),
            (Rainy, 0.2),
            (Cloudy, 0.3),
        ]));

        let forest = Terrain::new(
            "terrain_forest",
            TerrainType::Forest,
            "森林",
            "茂密的树林，提供了良好的隐蔽但限制了视野。",
        )
        .with_properties(TerrainProperties {
            move_difficulty: 1.4,
            visibility_multiplier: 0.6,
            concealment: 0.7,
            harvestable_resources: vec![Wood, Herb, Food, Hide],
            climate_bias: ClimateType::Temperate,
            danger_level: 0.4,
            build_difficulty: 1.2,
        })
        .with_effects(vec![
            TerrainEffect {
                id: "forest_cover".to_string(),
                trigger: Combat,
                target: All,
                effect_type: CombatBonus,
                value: -0.2,
                description: "树木遮挡，远程攻击命中率降低".to_string(),
            },
            TerrainEffect {
                id: "forest_rest".to_string(),
                trigger: Rest,
                target: All,
                effect_type: Mood,
                value: 3.0,
                description: "林间休息令人心旷神怡".to_string(),
            },
        ])
        .with_weather_bias(HashMap::from([
            (Rainy, 0.3),
            (Foggy, 0.2),
            (Sunny, 0.2),
        ]));

        let mountain = Terrain::new(
            "terrain_mountain",
            TerrainType::Mountain,
            "山地",
            "陡峭的山峰，攀登困难但视野极佳。",
        )
        .with_properties(TerrainProperties {
            move_difficulty: 2.2,
            visibility_multiplier: 2.0,
            concealment: 0.3,
            harvestable_resources: vec![Stone, Ore, Gem],
            climate_bias: ClimateType::Cold,
            danger_level: 0.6,
            build_difficulty: 2.0,
        })
        .with_effects(vec![
            TerrainEffect {
                id: "mountain_climb".to_string(),
                trigger: Stay,
                target: All,
                effect_type: Stamina,
                value: -2.0,
                description: "攀登消耗额外体力".to_string(),
            },
            TerrainEffect {
                id: "mountain_vantage".to_string(),
                trigger: Combat,
                target: All,
                effect_type: CombatBonus,
                value: 0.3,
                description: "高地优势，攻击获得加成".to_string(),
            },
        ])
        .with_weather_bias(HashMap::from([
            (Snowy, 0.3),
            (Stormy, 0.2),
            (Foggy, 0.2),
        ]));

        let desert = Terrain::new(
            "terrain_desert",
            TerrainType::Desert,
            "沙漠",
            "炙热的沙海，白天酷热夜晚寒冷，水源稀缺。",
        )
        .with_properties(TerrainProperties {
            move_difficulty: 1.8,
            visibility_multiplier: 1.8,
            concealment: 0.1,
            harvestable_resources: vec![Stone, Gem],
            climate_bias: ClimateType::Arid,
            danger_level: 0.5,
            build_difficulty: 1.5,
        })
        .with_effects(vec![
            TerrainEffect {
                id: "desert_heat".to_string(),
                trigger: Stay,
                target: All,
                effect_type: Stamina,
                value: -3.0,
                description: "酷热消耗体力".to_string(),
            },
        ])
        .with_weather_bias(HashMap::from([
            (Sunny, 0.5),
            (Stormy, 0.1),
        ]));

        let swamp = Terrain::new(
            "terrain_swamp",
            TerrainType::Swamp,
            "沼泽",
            "湿滑的泥沼，弥漫着瘴气，危险重重。",
        )
        .with_properties(TerrainProperties {
            move_difficulty: 2.5,
            visibility_multiplier: 0.5,
            concealment: 0.5,
            harvestable_resources: vec![Herb, Water],
            climate_bias: ClimateType::Tropical,
            danger_level: 0.7,
            build_difficulty: 2.5,
        })
        .with_effects(vec![
            TerrainEffect {
                id: "swamp_miasma".to_string(),
                trigger: Stay,
                target: All,
                effect_type: Health,
                value: -1.0,
                description: "瘴气侵蚀健康".to_string(),
            },
        ])
        .with_weather_bias(HashMap::from([
            (Foggy, 0.4),
            (Rainy, 0.3),
        ]));

        self.register(plains);
        self.register(forest);
        self.register(mountain);
        self.register(desert);
        self.register(swamp);
    }
}

/// 地形类型映射到场景类型 (用于 Bevy 前端显示)
impl TerrainType {
    pub fn to_scene_type(&self) -> &'static str {
        match self {
            TerrainType::Forest | TerrainType::Jungle => "forest",
            TerrainType::Plains | TerrainType::Hill => "town",
            TerrainType::Cave | TerrainType::Ruins => "dungeon",
            TerrainType::Coast | TerrainType::Lake | TerrainType::River => "beach",
            TerrainType::Mountain | TerrainType::Volcanic => "mountain",
            TerrainType::Desert | TerrainType::Swamp | TerrainType::Tundra => "custom",
        }
    }
}

/// 气候类型生成对应天气
impl ClimateType {
    pub fn generate_weather(&self) -> WeatherType {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        match self {
            ClimateType::Temperate => match rng.gen_range(0..3) {
                0 => WeatherType::Sunny,
                1 => WeatherType::Cloudy,
                _ => WeatherType::Rainy,
            },
            ClimateType::Tropical => match rng.gen_range(0..3) {
                0 => WeatherType::Sunny,
                1 => WeatherType::Rainy,
                _ => WeatherType::Stormy,
            },
            ClimateType::Cold => match rng.gen_range(0..2) {
                0 => WeatherType::Snowy,
                _ => WeatherType::Cloudy,
            },
            // 干旱气候：2/3 晴天 + 1/3 雾 (Sunny 偏多为特色)
            ClimateType::Arid => match rng.gen_range(0..4) {
                0 | 1 | 2 => WeatherType::Sunny,
                _ => WeatherType::Foggy,
            },
            ClimateType::Polar => WeatherType::Snowy,
        }
    }
}

/// 天气类型的字符串转换
impl WeatherType {
    /// 返回英文 key，用于前端解析 (与 Bevy parse_weather 对齐)
    pub fn to_key(&self) -> &'static str {
        match self {
            WeatherType::Sunny => "clear",
            WeatherType::Rainy => "rain",
            WeatherType::Cloudy => "cloudy",
            WeatherType::Foggy => "fog",
            WeatherType::Stormy => "storm",
            WeatherType::Snowy => "snow",
        }
    }

    /// 返回中文显示字符串，用于 UI 显示
    pub fn to_string_zh(&self) -> &'static str {
        match self {
            WeatherType::Sunny => "晴朗",
            WeatherType::Rainy => "下雨",
            WeatherType::Cloudy => "多云",
            WeatherType::Foggy => "雾",
            WeatherType::Stormy => "暴风雨",
            WeatherType::Snowy => "下雪",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terrain_creation() {
        let terrain = Terrain::new("test", TerrainType::Plains, "测试平原", "测试描述");
        assert_eq!(terrain.name, "测试平原");
        assert_eq!(terrain.properties.move_difficulty, 1.0);
    }

    #[test]
    fn test_terrain_manager() {
        let mut manager = TerrainManager::new();
        manager.assign_to_location("loc_1", "terrain_plains");
        
        let terrain = manager.get_at_location("loc_1").unwrap();
        assert_eq!(terrain.terrain_type, TerrainType::Plains);
    }

    #[test]
    fn test_move_cost() {
        let mut manager = TerrainManager::new();
        manager.assign_to_location("loc_plains", "terrain_plains");
        manager.assign_to_location("loc_mountain", "terrain_mountain");
        
        let cost = manager.calculate_move_cost("loc_plains", "loc_mountain");
        assert!((cost - 1.6).abs() < 0.01);
    }

    #[test]
    fn test_terrain_to_scene_mapping() {
        assert_eq!(TerrainType::Forest.to_scene_type(), "forest");
        assert_eq!(TerrainType::Plains.to_scene_type(), "town");
        assert_eq!(TerrainType::Cave.to_scene_type(), "dungeon");
        assert_eq!(TerrainType::Coast.to_scene_type(), "beach");
        assert_eq!(TerrainType::Mountain.to_scene_type(), "mountain");
        assert_eq!(TerrainType::Desert.to_scene_type(), "custom");
    }

    #[test]
    fn test_climate_generates_weather() {
        // 极地气候应该总是下雪
        let polar_weather = ClimateType::Polar.generate_weather();
        assert_eq!(polar_weather, WeatherType::Snowy);
        
        // 干旱气候应该生成晴天或雾
        let arid_weather = ClimateType::Arid.generate_weather();
        assert!(matches!(arid_weather, WeatherType::Sunny | WeatherType::Foggy));
    }
}
