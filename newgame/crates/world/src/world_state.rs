use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldState {
    pub world_id: String,
    pub world_name: String,
    pub current_location_id: String,
    pub current_space_id: Option<String>,
    pub current_building_id: Option<String>,
    pub current_terrain_id: Option<String>,
    pub region_culture_id: Option<String>,
    pub game_time: GameTime,
    pub weather: String,
    pub player_state: PlayerState,
    pub global_flags: HashMap<String, bool>,
    pub variables: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTime {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub time_of_day: TimeOfDay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TimeOfDay {
    Dawn,
    Morning,
    Noon,
    Afternoon,
    Dusk,
    Night,
    Midnight,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub player_id: String,
    pub name: String,
    pub health: i32,
    pub max_health: i32,
    pub stamina: i32,
    pub max_stamina: i32,
    pub inventory: Vec<InventoryItem>,
    pub known_locations: Vec<String>,
    pub known_cultures: Vec<String>,
    pub reputation: HashMap<String, f32>,
    pub keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub quantity: u32,
    pub description: String,
}

impl Default for GameTime {
    fn default() -> Self {
        Self {
            year: 1247,
            month: 3,
            day: 15,
            hour: 10,
            minute: 0,
            time_of_day: TimeOfDay::Morning,
        }
    }
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            player_id: "player_1".to_string(),
            name: "冒险者".to_string(),
            health: 100,
            max_health: 100,
            stamina: 100,
            max_stamina: 100,
            inventory: vec![
                InventoryItem {
                    id: "item_dagger".to_string(),
                    name: "生锈的匕首".to_string(),
                    item_type: "weapon".to_string(),
                    quantity: 1,
                    description: "一把普通的匕首，刃口有些钝了。".to_string(),
                },
                InventoryItem {
                    id: "item_bread".to_string(),
                    name: "干粮".to_string(),
                    item_type: "food".to_string(),
                    quantity: 3,
                    description: "可以充饥的硬面包。".to_string(),
                },
            ],
            known_locations: vec!["town_center".to_string()],
            known_cultures: vec![],
            reputation: HashMap::new(),
            keys: vec![],
        }
    }
}

impl Default for WorldState {
    fn default() -> Self {
        Self {
            world_id: "world_default".to_string(),
            world_name: "艾瑟兰大陆".to_string(),
            current_location_id: "town_center".to_string(),
            current_space_id: Some("tavern_main_hall".to_string()),
            current_building_id: Some("building_tavern_main".to_string()),
            current_terrain_id: Some("terrain_plains".to_string()),
            region_culture_id: Some("culture_southern_city".to_string()),
            game_time: GameTime::default(),
            weather: "晴朗".to_string(),
            player_state: PlayerState::default(),
            global_flags: HashMap::new(),
            variables: HashMap::new(),
        }
    }
}

impl WorldState {
    pub fn new(world_id: impl Into<String>, world_name: impl Into<String>) -> Self {
        Self {
            world_id: world_id.into(),
            world_name: world_name.into(),
            ..Default::default()
        }
    }

    pub fn advance_time(&mut self, minutes: u32) {
        self.game_time.minute += minutes;
        while self.game_time.minute >= 60 {
            self.game_time.minute -= 60;
            self.game_time.hour += 1;
        }
        while self.game_time.hour >= 24 {
            self.game_time.hour -= 24;
            self.game_time.day += 1;
        }
        while self.game_time.day > 30 {
            self.game_time.day -= 30;
            self.game_time.month += 1;
        }
        while self.game_time.month > 12 {
            self.game_time.month -= 12;
            self.game_time.year += 1;
        }

        self.update_time_of_day();
    }

    fn update_time_of_day(&mut self) {
        self.game_time.time_of_day = match self.game_time.hour {
            5..=6 => TimeOfDay::Dawn,
            7..=10 => TimeOfDay::Morning,
            11..=13 => TimeOfDay::Noon,
            14..=16 => TimeOfDay::Afternoon,
            17..=19 => TimeOfDay::Dusk,
            20..=23 => TimeOfDay::Night,
            _ => TimeOfDay::Midnight,
        };
    }

    pub fn set_location(&mut self, location_id: impl Into<String>, space_id: Option<impl Into<String>>, building_id: Option<impl Into<String>>) {
        self.current_location_id = location_id.into();
        self.current_space_id = space_id.map(|s| s.into());
        self.current_building_id = building_id.map(|b| b.into());
    }

    pub fn add_to_inventory(&mut self, item: InventoryItem) {
        if let Some(existing) = self.player_state.inventory.iter_mut().find(|i| i.id == item.id) {
            existing.quantity += item.quantity;
        } else {
            self.player_state.inventory.push(item);
        }
    }

    pub fn remove_from_inventory(&mut self, item_id: &str, quantity: u32) -> bool {
        if let Some(pos) = self.player_state.inventory.iter().position(|i| i.id == item_id) {
            let item = &mut self.player_state.inventory[pos];
            if item.quantity <= quantity {
                self.player_state.inventory.remove(pos);
            } else {
                item.quantity -= quantity;
            }
            true
        } else {
            false
        }
    }

    pub fn add_key(&mut self, key_id: impl Into<String>) {
        let key = key_id.into();
        if !self.player_state.keys.contains(&key) {
            self.player_state.keys.push(key);
        }
    }

    pub fn has_key(&self, key_id: &str) -> bool {
        self.player_state.keys.contains(&key_id.to_string())
    }

    pub fn set_flag(&mut self, flag: impl Into<String>, value: bool) {
        self.global_flags.insert(flag.into(), value);
    }

    pub fn get_flag(&self, flag: &str) -> bool {
        self.global_flags.get(flag).copied().unwrap_or(false)
    }

    pub fn update_reputation(&mut self, faction_id: impl Into<String>, delta: f32) {
        let faction = faction_id.into();
        let current = self.player_state.reputation.get(&faction).copied().unwrap_or(0.0);
        self.player_state.reputation.insert(faction, (current + delta).clamp(-100.0, 100.0));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_world_state_default() {
        let state = WorldState::default();
        assert_eq!(state.world_name, "艾瑟兰大陆");
        assert_eq!(state.game_time.year, 1247);
    }

    #[test]
    fn test_advance_time() {
        let mut state = WorldState::default();
        state.advance_time(150);
        assert_eq!(state.game_time.hour, 12);
        assert_eq!(state.game_time.minute, 30);
        assert_eq!(state.game_time.time_of_day, TimeOfDay::Noon);
    }

    #[test]
    fn test_inventory() {
        let mut state = WorldState::default();
        let item = InventoryItem {
            id: "test_item".to_string(),
            name: "测试物品".to_string(),
            item_type: "misc".to_string(),
            quantity: 2,
            description: "测试".to_string(),
        };
        state.add_to_inventory(item);
        assert_eq!(state.player_state.inventory.len(), 3);
        
        state.remove_from_inventory("test_item", 1);
        let item = state.player_state.inventory.iter().find(|i| i.id == "test_item").unwrap();
        assert_eq!(item.quantity, 1);
    }

    #[test]
    fn test_keys() {
        let mut state = WorldState::default();
        state.add_key("tavern_cellar_key");
        assert!(state.has_key("tavern_cellar_key"));
        assert!(!state.has_key("room_1_key"));
    }
}
