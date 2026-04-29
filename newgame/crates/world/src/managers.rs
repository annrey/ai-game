use crate::{
    architecture::SpaceManager,
    creature::CreatureManager,
    culture::CultureManager,
    event_graph::EventGraph,
    terrain::TerrainManager,
    world_state::WorldState,
};
use std::sync::{Arc, Mutex};

pub struct WorldManager {
    pub terrain: Arc<Mutex<TerrainManager>>,
    pub space: Arc<Mutex<SpaceManager>>,
    pub culture: Arc<Mutex<CultureManager>>,
    pub creature: Arc<Mutex<CreatureManager>>,
    pub event_graph: Arc<Mutex<EventGraph>>,
    pub state: Arc<Mutex<WorldState>>,
}

impl Default for WorldManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WorldManager {
    pub fn new() -> Self {
        Self {
            terrain: Arc::new(Mutex::new(TerrainManager::new())),
            space: Arc::new(Mutex::new(SpaceManager::new())),
            culture: Arc::new(Mutex::new(CultureManager::new())),
            creature: Arc::new(Mutex::new(CreatureManager::new())),
            event_graph: Arc::new(Mutex::new(EventGraph::new())),
            state: Arc::new(Mutex::new(WorldState::default())),
        }
    }

    pub fn with_state(mut self, state: WorldState) -> Self {
        self.state = Arc::new(Mutex::new(state));
        self
    }

    pub fn get_current_location_description(&self) -> String {
        let state = self.state.lock().unwrap();
        let terrain = self.terrain.lock().unwrap();
        let space = self.space.lock().unwrap();
        let culture = self.culture.lock().unwrap();

        let mut description = String::new();

        // 地形描述
        if let Some(terrain_desc) = terrain.get_at_location(&state.current_location_id) {
            description.push_str(&format!("【地形】{}\n{}\n\n", terrain_desc.name, terrain_desc.description));
        }

        // 建筑/空间描述
        if let Some(space_id) = &state.current_space_id {
            let space_desc = space.generate_space_description(space_id);
            description.push_str(&format!("【位置】{}\n\n", space_desc));
        }

        // 文化描述
        if let Some(culture_id) = &state.region_culture_id {
            if let Some(culture_data) = culture.get(culture_id) {
                description.push_str(&format!("【文化】{}\n{}\n\n", culture_data.name, culture_data.description));
            }
        }

        // 在场生物
        let creature_manager = self.creature.lock().unwrap();
        let creatures = creature_manager.get_in_location(&state.current_location_id);
        if !creatures.is_empty() {
            description.push_str("【生物】\n");
            for creature in creatures {
                description.push_str(&format!("- {}: {}\n", creature.display_name, creature.description));
            }
        }

        description
    }

    pub fn move_player(&self, target_location: impl Into<String>, target_space: Option<impl Into<String>>) -> Result<String, String> {
        let target_loc = target_location.into();
        let target_sp = target_space.map(|s| s.into());

        let mut state = self.state.lock().unwrap();
        let terrain = self.terrain.lock().unwrap();
        let space = self.space.lock().unwrap();

        // 计算移动消耗
        let move_cost = terrain.calculate_move_cost(&state.current_location_id, &target_loc);
        
        if state.player_state.stamina < move_cost as i32 {
            return Err("体力不足，无法移动。".to_string());
        }

        // 检查空间连通性
        if let (Some(from), Some(to)) = (&state.current_space_id, &target_sp) {
            if space.find_path(from, to, Some(&state.player_state.keys)).is_none() {
                return Err("无法到达该位置，可能需要钥匙或寻找其他路径。".to_string());
            }
        }

        // 扣除体力
        state.player_state.stamina -= move_cost as i32;

        // 更新位置
        let old_location = state.current_location_id.clone();
        state.current_location_id = target_loc.clone();
        state.current_space_id = target_sp.clone();

        // 获取新位置的建筑ID
        if let Some(space_id) = &target_sp {
            if let Some(building) = space.get_buildings_at_location(&target_loc)
                .iter()
                .find(|b| b.spaces.contains_key(space_id)) {
                state.current_building_id = Some(building.id.clone());
            }
        }

        // 记录事件
        let mut event_graph = self.event_graph.lock().unwrap();
        event_graph.record_event(crate::event_graph::EventNode {
            id: format!("event_{}", chrono::Utc::now().timestamp_millis()),
            event_type: "player_move".to_string(),
            description: format!("玩家从 {} 移动到 {}", old_location, target_loc),
            timestamp: chrono::Utc::now().timestamp_millis(),
            actor_id: Some(state.player_state.player_id.clone()),
            target_id: Some(target_loc.clone()),
            location_id: Some(target_loc),
            causal_weight: 0.5,
            player_initiated: true,
            payload: std::collections::HashMap::new(),
        });

        // 推进时间
        drop(state);
        self.advance_time((move_cost * 10.0) as u32);

        Ok(format!("移动完成，消耗 {} 点体力。", move_cost))
    }

    pub fn advance_time(&self, minutes: u32) {
        let mut state = self.state.lock().unwrap();
        state.advance_time(minutes);
    }

    pub fn get_world_state_json(&self) -> Result<String, serde_json::Error> {
        let state = self.state.lock().unwrap();
        serde_json::to_string(&*state)
    }

    pub fn get_ecology_report(&self, location_id: &str) -> Option<crate::creature::EcologyReport> {
        let creature = self.creature.lock().unwrap();
        Some(creature.generate_ecology_report(location_id))
    }

    pub fn get_cultural_conflict(&self, culture_a: &str, culture_b: &str) -> Option<crate::culture::CulturalConflict> {
        let culture = self.culture.lock().unwrap();
        culture.detect_conflict(culture_a, culture_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_world_manager_creation() {
        let manager = WorldManager::new();
        let desc = manager.get_current_location_description();
        assert!(!desc.is_empty());
    }

    #[test]
    fn test_world_state_json() {
        let manager = WorldManager::new();
        let json = manager.get_world_state_json().unwrap();
        assert!(json.contains("艾瑟兰大陆"));
    }
}
