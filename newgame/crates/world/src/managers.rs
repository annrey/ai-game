use crate::{
    architecture::SpaceManager,
    creature::CreatureManager,
    culture::CultureManager,
    event_graph::EventGraph,
    terrain::{TerrainManager, TerrainType, WeatherType},
    world_state::WorldState,
};
use game_core::state_store::SceneType;
use game_core::StateStore;
use parking_lot::Mutex;
use std::sync::Arc;

/// 世界管理器 - 协调地形、生物、文化等子系统
/// 并与 StateStore 同步状态
pub struct WorldManager {
    pub terrain: Arc<Mutex<TerrainManager>>,
    pub space: Arc<Mutex<SpaceManager>>,
    pub culture: Arc<Mutex<CultureManager>>,
    pub creature: Arc<Mutex<CreatureManager>>,
    pub event_graph: Arc<Mutex<EventGraph>>,
    pub state: Arc<Mutex<WorldState>>,
    /// 可选的 StateStore 引用，用于与游戏核心同步
    state_store: Option<Arc<StateStore>>,
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
            state_store: None,
        }
    }

    pub fn with_state(mut self, state: WorldState) -> Self {
        self.state = Arc::new(Mutex::new(state));
        self
    }

    /// 注入 StateStore，用于与游戏核心引擎同步状态
    pub fn with_state_store(mut self, state_store: Arc<StateStore>) -> Self {
        self.state_store = Some(state_store);
        self
    }

    pub fn get_current_location_description(&self) -> String {
        let state = self.state.lock();
        let terrain = self.terrain.lock();
        let space = self.space.lock();
        let culture = self.culture.lock();

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
        let creature_manager = self.creature.lock();
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

        let mut state = self.state.lock();
        let terrain = self.terrain.lock();
        let space = self.space.lock();

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
        let mut event_graph = self.event_graph.lock();
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
        let mut state = self.state.lock();
        state.advance_time(minutes);
    }

    pub fn get_world_state_json(&self) -> Result<String, serde_json::Error> {
        let state = self.state.lock();
        serde_json::to_string(&*state)
    }

    pub fn get_ecology_report(&self, location_id: &str) -> Option<crate::creature::EcologyReport> {
        let creature = self.creature.lock();
        Some(creature.generate_ecology_report(location_id))
    }

    pub fn get_cultural_conflict(&self, culture_a: &str, culture_b: &str) -> Option<crate::culture::CulturalConflict> {
        let culture = self.culture.lock();
        culture.detect_conflict(culture_a, culture_b)
    }

    // ==================== 地形状态同步 API ====================

    /// 获取当前位置的地形类型
    pub fn get_current_terrain_type(&self) -> Option<TerrainType> {
        let state = self.state.lock();
        let terrain = self.terrain.lock();
        terrain.get_at_location(&state.current_location_id)
            .map(|t| t.terrain_type)
    }

    /// 获取当前地形对应的场景类型 key ("forest"/"town"/...)
    pub fn get_current_scene_key(&self) -> &'static str {
        self.get_current_terrain_type()
            .map(|t| t.to_scene_type())
            .unwrap_or("custom")
    }

    /// 根据当前位置的气候生成天气 (随机，仅在 roll_weather 中使用)
    fn roll_weather_for_current_location(&self) -> WeatherType {
        let state = self.state.lock();
        let terrain = self.terrain.lock();
        if let Some(terrain_data) = terrain.get_at_location(&state.current_location_id) {
            terrain_data.properties.climate_bias.generate_weather()
        } else {
            WeatherType::Sunny
        }
    }

    /// 获取当前地形的推荐 time_of_day key
    /// - Cave/Dungeon 恒为 night
    /// - Forest 在 morning/afternoon 保持原值（给 Dawn/Dusk 延长留接口）
    pub fn get_terrain_time_of_day_key(&self) -> String {
        let state = self.state.lock();
        let terrain = self.terrain.lock();
        if let Some(terrain_data) = terrain.get_at_location(&state.current_location_id) {
            if matches!(terrain_data.terrain_type, TerrainType::Cave) {
                return "night".to_string();
            }
        }
        state.game_time.time_of_day.to_string()
    }

    /// 同步地形状态到 StateStore。
    ///
    /// 设计要点：
    /// - 天气仅在缓存为空时生成一次，避免每次调用产生不同结果
    /// - scene_type 写入 WorldState 枚举字段，可供前端直接消费
    /// - weather/time_of_day 统一使用英文 key，与 Bevy parse_* 对齐
    pub async fn sync_terrain_to_state_store(&self) {
        let Some(state_store) = self.state_store.as_ref().cloned() else {
            return;
        };

        // 1. 读取/计算需要同步的值
        let scene_key = self.get_current_scene_key();
        let time_of_day = self.get_terrain_time_of_day_key();

        // 2. 天气稳定策略：只有当 StateStore 中的 weather 为空时才生成
        let needs_new_weather = state_store
            .read(|s| s.weather.is_empty() || s.weather == "未知")
            .await;
        let weather_key = if needs_new_weather {
            self.roll_weather_for_current_location().to_key().to_string()
        } else {
            state_store.read(|s| s.weather.clone()).await
        };

        // 3. 原子写入 StateStore
        state_store
            .mutate(|state| {
                state.scene_type = SceneType::from_key(scene_key);
                state.weather = weather_key;
                state.time_of_day = time_of_day;
            })
            .await;
    }

    /// 明确触发天气重新生成 (用于时间推进或玩家休息等场景)
    pub async fn refresh_weather(&self) {
        let Some(state_store) = self.state_store.as_ref().cloned() else {
            return;
        };
        let weather_key = self.roll_weather_for_current_location().to_key().to_string();
        state_store
            .mutate(|state| {
                state.weather = weather_key;
            })
            .await;
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
