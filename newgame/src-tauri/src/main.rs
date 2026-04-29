#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::State;
use world::WorldManager;

struct AppState {
    world_manager: Arc<Mutex<WorldManager>>,
}

#[tauri::command]
fn get_world_description(state: State<AppState>) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_current_location_description())
}

#[tauri::command]
fn get_world_state(state: State<AppState>) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    manager.get_world_state_json().map_err(|e| e.to_string())
}

#[tauri::command]
fn move_player(
    state: State<AppState>,
    location_id: String,
    space_id: Option<String>,
) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    manager.move_player(location_id, space_id.as_deref())
}

#[tauri::command]
fn get_terrain_info(state: State<AppState>, location_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let terrain = manager.terrain.lock().map_err(|e| e.to_string())?;
    
    if let Some(t) = terrain.get_at_location(&location_id) {
        serde_json::to_string(t).map_err(|e| e.to_string())
    } else {
        Err("地形未找到".to_string())
    }
}

#[tauri::command]
fn get_building_info(state: State<AppState>, building_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let space = manager.space.lock().map_err(|e| e.to_string())?;
    
    if let Some(b) = space.get_building(&building_id) {
        serde_json::to_string(b).map_err(|e| e.to_string())
    } else {
        Err("建筑未找到".to_string())
    }
}

#[tauri::command]
fn get_culture_info(state: State<AppState>, region_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let culture = manager.culture.lock().map_err(|e| e.to_string())?;
    
    if let Some(c) = culture.get_for_region(&region_id) {
        serde_json::to_string(c).map_err(|e| e.to_string())
    } else {
        Err("文化未找到".to_string())
    }
}

#[tauri::command]
fn get_creatures_in_location(state: State<AppState>, location_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let creature = manager.creature.lock().map_err(|e| e.to_string())?;
    
    let creatures: Vec<_> = creature.get_in_location(&location_id)
        .into_iter()
        .cloned()
        .collect();
    
    serde_json::to_string(&creatures).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_ecology_report(state: State<AppState>, location_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    if let Some(report) = manager.get_ecology_report(&location_id) {
        serde_json::to_string(&report).map_err(|e| e.to_string())
    } else {
        Err("无法生成生态报告".to_string())
    }
}

#[tauri::command]
fn get_cultural_conflict(
    state: State<AppState>,
    culture_a: String,
    culture_b: String,
) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    if let Some(conflict) = manager.get_cultural_conflict(&culture_a, &culture_b) {
        serde_json::to_string(&conflict).map_err(|e| e.to_string())
    } else {
        Ok("{\"conflict\": false}".to_string())
    }
}

#[tauri::command]
fn get_space_path(
    state: State<AppState>,
    from_space: String,
    to_space: String,
) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let space = manager.space.lock().map_err(|e| e.to_string())?;
    let world_state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if let Some(path) = space.find_path(&from_space, &to_space, Some(&world_state.player_state.keys)) {
        serde_json::to_string(&path).map_err(|e| e.to_string())
    } else {
        Err("无法找到路径".to_string())
    }
}

#[tauri::command]
fn advance_time(state: State<AppState>, minutes: u32) -> Result<(), String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    manager.advance_time(minutes);
    Ok(())
}

#[tauri::command]
fn add_to_inventory(
    state: State<AppState>,
    item_id: String,
    name: String,
    item_type: String,
    quantity: u32,
    description: String,
) -> Result<(), String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let mut world_state = manager.state.lock().map_err(|e| e.to_string())?;
    
    world_state.add_to_inventory(world::world_state::InventoryItem {
        id: item_id,
        name,
        item_type,
        quantity,
        description,
    });
    
    Ok(())
}

fn main() {
    let world_manager = Arc::new(Mutex::new(WorldManager::new()));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { world_manager })
        .invoke_handler(tauri::generate_handler![
            get_world_description,
            get_world_state,
            move_player,
            get_terrain_info,
            get_building_info,
            get_culture_info,
            get_creatures_in_location,
            get_ecology_report,
            get_cultural_conflict,
            get_space_path,
            advance_time,
            add_to_inventory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
