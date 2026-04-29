use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BuildingType {
    Tavern,
    House,
    Shop,
    Temple,
    Castle,
    Dungeon,
    Tower,
    CaveSystem,
    Ruins,
    Camp,
    Fort,
    Mansion,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SpaceType {
    Room,
    Hall,
    Corridor,
    Courtyard,
    Cellar,
    Tower,
    Cave,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Door,
    StairsUp,
    StairsDown,
    Ladder,
    Passage,
    Gate,
    Hidden,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Lighting {
    Bright,
    Dim,
    Dark,
    PitchBlack,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BuildingCondition {
    Intact,
    Damaged,
    Ruined,
    Burned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractableObject {
    pub id: String,
    pub name: String,
    pub object_type: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceConnection {
    pub target_space_id: String,
    pub connection_type: ConnectionType,
    pub locked: bool,
    pub requires_key: Option<String>,
    pub hidden: bool,
    pub traversal_difficulty: f32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceNode {
    pub id: String,
    pub name: String,
    pub description: String,
    pub building_id: String,
    pub space_type: SpaceType,
    pub connections: Vec<SpaceConnection>,
    pub objects: Vec<InteractableObject>,
    pub lighting: Lighting,
    pub capacity: usize,
    pub occupants: Vec<String>,
    pub terrain_override: Option<super::terrain::TerrainType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Building {
    pub id: String,
    pub building_type: BuildingType,
    pub name: String,
    pub description: String,
    pub location_id: String,
    pub spaces: HashMap<String, SpaceNode>,
    pub entrance_space_id: String,
    pub condition: BuildingCondition,
    pub owner_id: Option<String>,
    pub controlling_faction_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacePath {
    pub spaces: Vec<String>,
    pub total_difficulty: f32,
    pub requires_keys: Vec<String>,
    pub has_hidden_paths: bool,
}

impl SpaceNode {
    pub fn new(id: impl Into<String>, name: impl Into<String>, description: impl Into<String>, building_id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: description.into(),
            building_id: building_id.into(),
            space_type: SpaceType::Room,
            connections: vec![],
            objects: vec![],
            lighting: Lighting::Dim,
            capacity: 10,
            occupants: vec![],
            terrain_override: None,
        }
    }

    pub fn with_type(mut self, space_type: SpaceType) -> Self {
        self.space_type = space_type;
        self
    }

    pub fn with_connections(mut self, connections: Vec<SpaceConnection>) -> Self {
        self.connections = connections;
        self
    }

    pub fn with_objects(mut self, objects: Vec<InteractableObject>) -> Self {
        self.objects = objects;
        self
    }

    pub fn with_lighting(mut self, lighting: Lighting) -> Self {
        self.lighting = lighting;
        self
    }

    pub fn with_capacity(mut self, capacity: usize) -> Self {
        self.capacity = capacity;
        self
    }

    pub fn get_available_connections(&self, keys: Option<&[String]>) -> Vec<&SpaceConnection> {
        self.connections.iter().filter(|conn| {
            if conn.hidden {
                return false;
            }
            if conn.locked {
                if let Some(req_key) = &conn.requires_key {
                    if let Some(keys) = keys {
                        return keys.contains(req_key);
                    }
                    return false;
                }
            }
            true
        }).collect()
    }

    pub fn reveal_hidden_connection(&mut self, target_space_id: &str) -> bool {
        for conn in &mut self.connections {
            if conn.target_space_id == target_space_id && conn.hidden {
                conn.hidden = false;
                return true;
            }
        }
        false
    }

    pub fn add_occupant(&mut self, occupant_id: impl Into<String>) -> bool {
        let id = occupant_id.into();
        if self.occupants.len() >= self.capacity || self.occupants.contains(&id) {
            return false;
        }
        self.occupants.push(id);
        true
    }

    pub fn remove_occupant(&mut self, occupant_id: &str) -> bool {
        if let Some(pos) = self.occupants.iter().position(|o| o == occupant_id) {
            self.occupants.remove(pos);
            true
        } else {
            false
        }
    }
}

impl Building {
    pub fn new(id: impl Into<String>, building_type: BuildingType, name: impl Into<String>, description: impl Into<String>, location_id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            building_type,
            name: name.into(),
            description: description.into(),
            location_id: location_id.into(),
            spaces: HashMap::new(),
            entrance_space_id: String::new(),
            condition: BuildingCondition::Intact,
            owner_id: None,
            controlling_faction_id: None,
        }
    }

    pub fn with_entrance(mut self, entrance_id: impl Into<String>) -> Self {
        self.entrance_space_id = entrance_id.into();
        self
    }

    pub fn add_space(&mut self, space: SpaceNode) {
        self.spaces.insert(space.id.clone(), space);
    }

    pub fn get_space(&self, space_id: &str) -> Option<&SpaceNode> {
        self.spaces.get(space_id)
    }

    pub fn get_space_mut(&mut self, space_id: &str) -> Option<&mut SpaceNode> {
        self.spaces.get_mut(space_id)
    }

    pub fn get_entrance(&self) -> Option<&SpaceNode> {
        self.spaces.get(&self.entrance_space_id)
    }
}

pub struct SpaceManager {
    buildings: HashMap<String, Building>,
    space_to_building: HashMap<String, String>,
}

impl Default for SpaceManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SpaceManager {
    pub fn new() -> Self {
        let mut manager = Self {
            buildings: HashMap::new(),
            space_to_building: HashMap::new(),
        };
        manager.register_defaults();
        manager
    }

    pub fn register_building(&mut self, building: Building) {
        for space_id in building.spaces.keys() {
            self.space_to_building.insert(space_id.clone(), building.id.clone());
        }
        self.buildings.insert(building.id.clone(), building);
    }

    pub fn get_building(&self, building_id: &str) -> Option<&Building> {
        self.buildings.get(building_id)
    }

    pub fn get_building_mut(&mut self, building_id: &str) -> Option<&mut Building> {
        self.buildings.get_mut(building_id)
    }

    pub fn get_space(&self, space_id: &str) -> Option<&SpaceNode> {
        self.space_to_building
            .get(space_id)
            .and_then(|bid| self.buildings.get(bid))
            .and_then(|b| b.spaces.get(space_id))
    }

    pub fn get_space_mut(&mut self, space_id: &str) -> Option<&mut SpaceNode> {
        self.space_to_building
            .get(space_id)
            .cloned()
            .and_then(|bid| self.buildings.get_mut(&bid))
            .and_then(|b| b.spaces.get_mut(space_id))
    }

    pub fn find_path(&self, from_space_id: &str, to_space_id: &str, keys: Option<&[String]>) -> Option<SpacePath> {
        use std::collections::{VecDeque, HashSet};

        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();
        let mut parent_map: HashMap<String, (String, f32, bool, Option<String>)> = HashMap::new();

        queue.push_back(from_space_id.to_string());
        visited.insert(from_space_id.to_string());

        while let Some(current_id) = queue.pop_front() {
            if current_id == to_space_id {
                let mut path = vec![];
                let mut current = to_space_id.to_string();
                let mut total_difficulty = 0.0;
                let mut requires_keys = vec![];
                let mut has_hidden = false;

                while current != from_space_id {
                    path.push(current.clone());
                    if let Some((parent, diff, hidden, key)) = parent_map.get(&current) {
                        total_difficulty += diff;
                        if *hidden {
                            has_hidden = true;
                        }
                        if let Some(k) = key {
                            requires_keys.push(k.clone());
                        }
                        current = parent.clone();
                    } else {
                        break;
                    }
                }
                path.push(from_space_id.to_string());
                path.reverse();

                return Some(SpacePath {
                    spaces: path,
                    total_difficulty,
                    requires_keys,
                    has_hidden_paths: has_hidden,
                });
            }

            if let Some(space) = self.get_space(&current_id) {
                for conn in space.get_available_connections(keys) {
                    if !visited.contains(&conn.target_space_id) {
                        visited.insert(conn.target_space_id.clone());
                        parent_map.insert(
                            conn.target_space_id.clone(),
                            (current_id.clone(), conn.traversal_difficulty, conn.hidden, conn.requires_key.clone()),
                        );
                        queue.push_back(conn.target_space_id.clone());
                    }
                }
            }
        }

        None
    }

    pub fn move_occupant(&mut self, occupant_id: &str, from_space_id: &str, to_space_id: &str) -> bool {
        let from_building = self.space_to_building.get(from_space_id).cloned();
        let to_building = self.space_to_building.get(to_space_id).cloned();

        if from_building != to_building {
            return false;
        }

        if let Some(bid) = from_building {
            if let Some(building) = self.buildings.get_mut(&bid) {
                if let Some(from_space) = building.spaces.get_mut(from_space_id) {
                    if !from_space.remove_occupant(occupant_id) {
                        return false;
                    }
                }
                if let Some(to_space) = building.spaces.get_mut(to_space_id) {
                    return to_space.add_occupant(occupant_id.to_string());
                }
            }
        }

        false
    }

    pub fn get_buildings_at_location(&self, location_id: &str) -> Vec<&Building> {
        self.buildings
            .values()
            .filter(|b| b.location_id == location_id)
            .collect()
    }

    pub fn generate_space_description(&self, space_id: &str) -> String {
        if let Some(space) = self.get_space(space_id) {
            let mut desc = format!("{} - {}", space.name, space.description);
            
            if !space.objects.is_empty() {
                let objects: Vec<_> = space.objects.iter().map(|o| format!("{} {}", o.icon, o.name)).collect();
                desc.push_str(&format!("\n可见物品: {}", objects.join(", ")));
            }

            let visible_conns: Vec<_> = space.connections.iter()
                .filter(|c| !c.hidden)
                .map(|c| format!("{} ({})", c.description, c.connection_type))
                .collect();
            
            if !visible_conns.is_empty() {
                desc.push_str(&format!("\n通道: {}", visible_conns.join(", ")));
            }

            desc
        } else {
            "未知空间。".to_string()
        }
    }

    fn register_defaults(&mut self) {
        let mut tavern = Building::new(
            "building_tavern_main",
            BuildingType::Tavern,
            "银酒杯酒馆",
            "镇上最受欢迎的酒馆，木质结构的二层建筑。",
            "town_center",
        );

        let main_hall = SpaceNode::new(
            "tavern_main_hall",
            "酒馆大厅",
            "温暖的火光映照着木质桌椅，空气中弥漫着麦酒和烤肉的香气。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Hall)
        .with_lighting(Lighting::Dim)
        .with_capacity(20)
        .with_objects(vec![
            InteractableObject { id: "fireplace".to_string(), name: "壁炉".to_string(), object_type: "furniture".to_string(), icon: "🔥".to_string() },
            InteractableObject { id: "piano".to_string(), name: "旧钢琴".to_string(), object_type: "instrument".to_string(), icon: "🎹".to_string() },
            InteractableObject { id: "bar_counter".to_string(), name: "吧台".to_string(), object_type: "furniture".to_string(), icon: "🍺".to_string() },
        ])
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_private_room".to_string(), connection_type: ConnectionType::Door, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "一扇通往私人包厢的门".to_string() },
            SpaceConnection { target_space_id: "tavern_kitchen".to_string(), connection_type: ConnectionType::Door, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "通往厨房的门".to_string() },
            SpaceConnection { target_space_id: "tavern_stairs_up".to_string(), connection_type: ConnectionType::StairsUp, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "通往二楼的楼梯".to_string() },
            SpaceConnection { target_space_id: "tavern_cellar".to_string(), connection_type: ConnectionType::StairsDown, locked: true, requires_key: Some("tavern_cellar_key".to_string()), hidden: false, traversal_difficulty: 1.0, description: "通往地窖的活板门".to_string() },
        ]);

        let private_room = SpaceNode::new(
            "tavern_private_room",
            "私人包厢",
            "安静的包厢，适合密谈。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Room)
        .with_lighting(Lighting::Dim)
        .with_capacity(6)
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_main_hall".to_string(), connection_type: ConnectionType::Door, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "回到大厅".to_string() },
        ]);

        let kitchen = SpaceNode::new(
            "tavern_kitchen",
            "厨房",
            "热气腾腾的厨房，厨师们忙碌着。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Room)
        .with_lighting(Lighting::Bright)
        .with_capacity(5)
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_main_hall".to_string(), connection_type: ConnectionType::Door, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "回到大厅".to_string() },
        ]);

        let stairs_up = SpaceNode::new(
            "tavern_stairs_up",
            "二楼走廊",
            "狭窄的走廊，两侧是客房。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Corridor)
        .with_lighting(Lighting::Dim)
        .with_capacity(4)
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_main_hall".to_string(), connection_type: ConnectionType::StairsDown, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "回到一楼".to_string() },
            SpaceConnection { target_space_id: "tavern_room_1".to_string(), connection_type: ConnectionType::Door, locked: true, requires_key: Some("room_1_key".to_string()), hidden: false, traversal_difficulty: 1.0, description: "客房1号".to_string() },
            SpaceConnection { target_space_id: "tavern_room_2".to_string(), connection_type: ConnectionType::Door, locked: true, requires_key: Some("room_2_key".to_string()), hidden: false, traversal_difficulty: 1.0, description: "客房2号".to_string() },
        ]);

        let cellar = SpaceNode::new(
            "tavern_cellar",
            "地窖",
            "阴暗潮湿的地窖，存放着酒桶。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Cellar)
        .with_lighting(Lighting::Dark)
        .with_capacity(4)
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_main_hall".to_string(), connection_type: ConnectionType::StairsUp, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "回到大厅".to_string() },
            SpaceConnection { target_space_id: "tavern_secret_tunnel".to_string(), connection_type: ConnectionType::Hidden, locked: false, requires_key: None, hidden: true, traversal_difficulty: 1.0, description: "一面松动的石墙后面似乎有通道".to_string() },
        ]);

        let secret_tunnel = SpaceNode::new(
            "tavern_secret_tunnel",
            "秘密通道",
            "狭窄的地下通道，不知通向何处。",
            "building_tavern_main",
        )
        .with_type(SpaceType::Corridor)
        .with_lighting(Lighting::PitchBlack)
        .with_capacity(2)
        .with_connections(vec![
            SpaceConnection { target_space_id: "tavern_cellar".to_string(), connection_type: ConnectionType::Hidden, locked: false, requires_key: None, hidden: false, traversal_difficulty: 1.0, description: "回到地窖".to_string() },
        ]);

        tavern.add_space(main_hall);
        tavern.add_space(private_room);
        tavern.add_space(kitchen);
        tavern.add_space(stairs_up);
        tavern.add_space(cellar);
        tavern.add_space(secret_tunnel);
        tavern.entrance_space_id = "tavern_main_hall".to_string();

        self.register_building(tavern);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_building_creation() {
        let building = Building::new("test", BuildingType::Tavern, "测试酒馆", "描述", "loc1");
        assert_eq!(building.name, "测试酒馆");
    }

    #[test]
    fn test_space_manager() {
        let manager = SpaceManager::new();
        let tavern = manager.get_building("building_tavern_main").unwrap();
        assert_eq!(tavern.spaces.len(), 6);
    }

    #[test]
    fn test_pathfinding() {
        let manager = SpaceManager::new();
        let path = manager.find_path("tavern_main_hall", "tavern_room_1", None);
        assert!(path.is_none()); // 需要钥匙

        let path_with_key = manager.find_path("tavern_main_hall", "tavern_room_1", Some(&["room_1_key".to_string()]));
        assert!(path_with_key.is_some());
    }

    #[test]
    fn test_occupant_movement() {
        let mut manager = SpaceManager::new();
        assert!(manager.move_occupant("npc_1", "tavern_main_hall", "tavern_private_room"));
        
        let hall = manager.get_space("tavern_main_hall").unwrap();
        assert!(!hall.occupants.contains(&"npc_1".to_string()));
        
        let room = manager.get_space("tavern_private_room").unwrap();
        assert!(room.occupants.contains(&"npc_1".to_string()));
    }
}
