#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use world::WorldManager;

use game_core::{
    engine_factory::{BackendKind, EngineFactory},
    engine_handle::EngineHandle,
};

struct AppState {
    world_manager: Arc<Mutex<WorldManager>>,
    engine: EngineHandle,
    backend: BackendKind,
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
    let terrain = manager.terrain.lock();
    
    if let Some(t) = terrain.get_at_location(&location_id) {
        serde_json::to_string(t).map_err(|e| e.to_string())
    } else {
        Err("地形未找到".to_string())
    }
}

#[tauri::command]
fn get_building_info(state: State<AppState>, building_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let space = manager.space.lock();
    
    if let Some(b) = space.get_building(&building_id) {
        serde_json::to_string(b).map_err(|e| e.to_string())
    } else {
        Err("建筑未找到".to_string())
    }
}

#[tauri::command]
fn get_culture_info(state: State<AppState>, region_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let culture = manager.culture.lock();
    
    if let Some(c) = culture.get_for_region(&region_id) {
        serde_json::to_string(c).map_err(|e| e.to_string())
    } else {
        Err("文化未找到".to_string())
    }
}

#[tauri::command]
fn get_creatures_in_location(state: State<AppState>, location_id: String) -> Result<String, String> {
    let manager = state.world_manager.lock().map_err(|e| e.to_string())?;
    let creature = manager.creature.lock();
    
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
    let space = manager.space.lock();
    let world_state = manager.state.lock();
    
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
    let mut world_state = manager.state.lock();
    
    world_state.add_to_inventory(world::world_state::InventoryItem {
        id: item_id,
        name,
        item_type,
        quantity,
        description,
    });
    
    Ok(())
}

/// 向引擎发送玩家输入（与 Bevy / Server / FFI 共用同一路径）
#[tauri::command]
async fn dispatch_input(state: State<'_, AppState>, text: String) -> Result<(), String> {
    state.engine.dispatch_player_input(&text).await;
    Ok(())
}

/// 返回当前生效的 backend 名称（供前端在顶部状态栏显示）
#[tauri::command]
fn get_engine_backend(state: State<AppState>) -> Result<String, String> {
    Ok(state.backend.as_str().to_string())
}

/// 返回引擎世界状态的 JSON 快照
#[tauri::command]
async fn get_engine_state(state: State<'_, AppState>) -> Result<String, String> {
    state
        .engine
        .state_store()
        .get_state_json()
        .await
        .map_err(|e| e.to_string())
}

/// 保存当前引擎状态
#[tauri::command]
async fn save_engine(state: State<'_, AppState>, name: String, mode: String) -> Result<String, String> {
    state.engine.save(&name, &mode).await.map_err(|e| e.to_string())
}

/// 加载引擎存档
#[tauri::command]
async fn load_engine(state: State<'_, AppState>, save_id: String) -> Result<(), String> {
    state.engine.load(&save_id).await.map_err(|e| e.to_string())
}

fn main() {
    let world_manager = Arc::new(Mutex::new(WorldManager::new()));

    // 在进入 Tauri runtime 前同步构造 EngineHandle。
    // EngineFactory::build 是 async，所以开一个 tokio current_thread runtime 临时跳一下。
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to build temp tokio runtime for EngineFactory");

    let bundle = rt
        .block_on(EngineFactory::build_default())
        .expect("EngineFactory::build_default must succeed (uses in-memory store fallback)");

    let engine = bundle.handle.clone();
    let backend = bundle.backend;

    // 后台事件循环：Tauri 启动后会接管 tokio runtime，这里只需保存 handle
    let setup_engine = engine.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            world_manager,
            engine,
            backend,
        })
        .setup(move |app| {
            // 在 Tauri 管理的 tokio runtime 上启动引擎事件循环
            let engine = setup_engine.clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                engine.start().await;
            });

            // 订阅事件总线并转发给前端 Web View（与 Bevy 桌面端镜像）
            let mut event_rx = setup_engine.event_bus().subscribe();
            tauri::async_runtime::spawn(async move {
                while let Ok(event) = event_rx.recv().await {
                    let _ = app_handle.emit("engine-event", &event);
                }
            });
            Ok(())
        })
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
            dispatch_input,
            get_engine_backend,
            get_engine_state,
            save_engine,
            load_engine,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
