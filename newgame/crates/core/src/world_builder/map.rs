/**
 * 世界地图系统
 *
 * 支持可视化地图编辑：
 * - 节点-连接图表示地点关系
 * - 区域划分与地形类型
 * - 路径与传送点
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 世界地图
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldMap {
    pub locations: Vec<Location>,
    pub connections: Vec<Connection>,
    pub regions: Vec<Region>,
    pub default_start_location: String,
    pub map_style: MapStyle,
}

impl WorldMap {
    pub fn new() -> Self {
        Self {
            locations: vec![],
            connections: vec![],
            regions: vec![],
            default_start_location: String::new(),
            map_style: MapStyle::default(),
        }
    }

    pub fn add_location(&mut self, location: Location) {
        if self.default_start_location.is_empty() {
            self.default_start_location = location.id.clone();
        }
        self.locations.push(location);
    }

    pub fn connect(&mut self, from: &str, to: &str, connection_type: ConnectionType) {
        self.connections.push(Connection {
            id: uuid::Uuid::new_v4().to_string(),
            from_location: from.to_string(),
            to_location: to.to_string(),
            connection_type,
            distance: None,
            travel_time: None,
            requirements: vec![],
        });
    }

    pub fn get_location(&self, id: &str) -> Option<&Location> {
        self.locations.iter().find(|l| l.id == id)
    }

    pub fn get_neighbors(&self, location_id: &str) -> Vec<&Location> {
        let neighbor_ids: Vec<String> = self
            .connections
            .iter()
            .filter(|c| c.from_location == location_id || c.to_location == location_id)
            .map(|c| {
                if c.from_location == location_id {
                    c.to_location.clone()
                } else {
                    c.from_location.clone()
                }
            })
            .collect();

        self.locations
            .iter()
            .filter(|l| neighbor_ids.contains(&l.id))
            .collect()
    }
}

/// 地点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub id: String,
    pub name: String,
    pub description: String,
    pub location_type: LocationType,
    pub terrain: TerrainType,
    pub coordinates: Coordinates,
    pub size: LocationSize,
    pub danger_level: u8,
    pub resources: Vec<String>,
    pub npcs: Vec<String>,
    pub points_of_interest: Vec<PointOfInterest>,
    pub weather_override: Option<String>,
    pub is_hidden: bool,
    pub discovery_requirements: Vec<String>,
}

impl Location {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: String::new(),
            location_type: LocationType::Settlement,
            terrain: TerrainType::Plains,
            coordinates: Coordinates { x: 0.0, y: 0.0 },
            size: LocationSize::Medium,
            danger_level: 1,
            resources: vec![],
            npcs: vec![],
            points_of_interest: vec![],
            weather_override: None,
            is_hidden: false,
            discovery_requirements: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coordinates {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LocationType {
    Settlement,
    Dungeon,
    Wilderness,
    Landmark,
    Shop,
    Tavern,
    Temple,
    Castle,
    Cave,
    Forest,
    Mountain,
    Water,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TerrainType {
    Plains,
    Forest,
    Mountain,
    Desert,
    Swamp,
    Water,
    Snow,
    Volcanic,
    Magical,
    Urban,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LocationSize {
    Tiny,
    Small,
    Medium,
    Large,
    Huge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointOfInterest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub poi_type: PoiType,
    pub is_interactive: bool,
    pub required_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PoiType {
    Container,
    Door,
    NPC,
    Sign,
    Trap,
    Secret,
    Resource,
    Teleport,
    Custom(String),
}

/// 地点连接
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub id: String,
    pub from_location: String,
    pub to_location: String,
    pub connection_type: ConnectionType,
    pub distance: Option<u32>,
    pub travel_time: Option<u32>,
    pub requirements: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionType {
    Road,
    Path,
    River,
    Portal,
    Secret,
    Locked,
    Custom(String),
}

/// 区域
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub id: String,
    pub name: String,
    pub description: String,
    pub location_ids: Vec<String>,
    pub region_type: RegionType,
    pub controlling_faction: Option<String>,
    pub danger_level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RegionType {
    Kingdom,
    Province,
    Territory,
    Biome,
    Zone,
    Custom(String),
}

/// 地图样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapStyle {
    pub background_color: String,
    pub location_colors: HashMap<String, String>,
    pub connection_color: String,
    pub region_opacity: f32,
}

impl Default for MapStyle {
    fn default() -> Self {
        let mut location_colors = HashMap::new();
        location_colors.insert("settlement".to_string(), "#5CAB7C".to_string());
        location_colors.insert("dungeon".to_string(), "#8B4513".to_string());
        location_colors.insert("wilderness".to_string(), "#228B22".to_string());
        location_colors.insert("landmark".to_string(), "#FFD700".to_string());

        Self {
            background_color: "#F0FAF2".to_string(),
            location_colors,
            connection_color: "#288760".to_string(),
            region_opacity: 0.3,
        }
    }
}
