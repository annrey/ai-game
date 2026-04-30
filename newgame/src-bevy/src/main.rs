use bevy::prelude::*;
use bevy_egui::EguiPlugin;

mod game_state;
mod ui;
mod visuals;
mod runtime;

use game_state::GameState;
use ui::GameUIPlugin;
use visuals::SceneBackgroundPlugin;
use runtime::{EngineBridge, EngineRuntime, RuntimeConfig, EngineCommand};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "OpenClaw - AI 说书人".to_string(),
                resolution: (1280.0, 800.0).into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(EguiPlugin)
        .add_plugins(GameUIPlugin)
        .add_plugins(SceneBackgroundPlugin)
        .insert_resource(GameStateResource::default())
        .insert_resource(EngineBridgeResource::default())
        .add_systems(Startup, setup_game)
        .add_systems(Update, (
            handle_player_input,
            drain_snapshots,
            sync_scene_visual_from_game_state,
            handle_keyboard_shortcuts,
        ))
        .run();
}

#[derive(Resource, Default)]
struct GameStateResource {
    state: GameState,
}

#[derive(Resource)]
struct EngineBridgeResource {
    bridge: EngineBridge,
}

impl Default for EngineBridgeResource {
    fn default() -> Self {
        let bridge = EngineRuntime::spawn(RuntimeConfig::default());
        Self { bridge }
    }
}

fn setup_game(
    mut commands: Commands,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    commands.spawn(Camera2d::default());

    // Request initial snapshot from engine
    let _ = engine_bridge.bridge.cmd_tx.send(EngineCommand::RequestSnapshot);

    // GameStateResource::Default 已自动初始化 state
    setup_initial_scene(&mut commands);
}

fn setup_initial_scene(commands: &mut Commands) {
    commands.spawn((
        Sprite {
            color: Color::srgb(0.05, 0.05, 0.1),
            custom_size: Some(Vec2::new(1280.0, 800.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
        SceneBackground,
    ));
}

#[derive(Component)]
struct SceneBackground;

fn handle_player_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    game_state: Res<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    if keyboard.just_pressed(KeyCode::Space) {
        if !game_state.state.is_processing {
            let _ = engine_bridge.bridge.cmd_tx.send(EngineCommand::PlayerInput(
                "继续探索".to_string()
            ));
        }
    }
}

fn drain_snapshots(
    mut game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    // Drain all available snapshots from the channel
    while let Ok(snapshot) = engine_bridge.bridge.snap_rx.try_recv() {
        // Update processing state
        game_state.state.is_processing = snapshot.pending;

        // Update narrative if there's new content
        if let Some(narrative) = snapshot.narrative_delta {
            game_state.state.add_narrative(narrative.content, narrative.is_player);
        }

        // Update world state from snapshot
        game_state.state.location_name = snapshot.world.location_name.clone();
        game_state.state.chapter = snapshot.world.chapter.clone();
        game_state.state.turn_count = snapshot.world.turn_count as i32;
        game_state.state.scene_type = parse_scene_type(&snapshot.world.scene_type);
        game_state.state.weather = parse_weather(&snapshot.world.weather);
        game_state.state.game_time.time_of_day = parse_time_of_day(&snapshot.world.time_of_day);
        game_state.state.health = snapshot.world.health;
        game_state.state.max_health = snapshot.world.max_health;
        game_state.state.mana = snapshot.world.mana;
        game_state.state.max_mana = snapshot.world.max_mana;
        game_state.state.energy = snapshot.world.energy;
        game_state.state.max_energy = snapshot.world.max_energy;
        game_state.state.exploration_percent = snapshot.world.exploration_percent;
        game_state.state.locations_discovered = snapshot.world.locations_discovered;
        game_state.state.npcs_met = snapshot.world.npcs_met;
        game_state.state.items_collected = snapshot.world.items_collected;

        // Update inventory
        game_state.state.inventory = snapshot.world.inventory.iter().map(|i| {
            crate::game_state::InventoryItem {
                id: i.id.clone(),
                name: i.name.clone(),
                item_type: crate::game_state::ItemType::Misc,
                quantity: i.quantity,
                description: i.description.clone(),
                icon: i.icon.clone(),
            }
        }).collect();

        // Update quests
        game_state.state.quests = snapshot.world.quests.iter().map(|q| {
            crate::game_state::Quest {
                id: q.id.clone(),
                title: q.title.clone(),
                description: q.description.clone(),
                status: crate::game_state::QuestStatus::Active,
                objectives: vec![],
            }
        }).collect();

        // Update choices
        game_state.state.choices = snapshot.world.choices.iter().map(|c| {
            crate::game_state::PlayerChoice {
                id: c.id.clone(),
                text: c.text.clone(),
                description: c.description.clone(),
                icon: c.icon.clone(),
                enabled: c.enabled,
            }
        }).collect();

        // Update engine snapshot status
        game_state.state.engine_snapshot.backend = Some(match snapshot.backend {
            game_core::BackendKind::Ollama => crate::game_state::EngineBackend::Ollama,
            _ => crate::game_state::EngineBackend::Echo,
        });
        game_state.state.engine_snapshot.connection_status = if snapshot.last_error.is_some() {
            crate::game_state::ConnectionStatus::Error
        } else if snapshot.backend == game_core::BackendKind::Echo {
            crate::game_state::ConnectionStatus::Offline
        } else {
            crate::game_state::ConnectionStatus::Online
        };
        game_state.state.engine_snapshot.last_error = snapshot.last_error;
    }
}

fn parse_scene_type(s: &str) -> crate::game_state::SceneType {
    match s.to_lowercase().as_str() {
        "forest" => crate::game_state::SceneType::Forest,
        "town" => crate::game_state::SceneType::Town,
        "dungeon" => crate::game_state::SceneType::Dungeon,
        "beach" => crate::game_state::SceneType::Beach,
        "mountain" => crate::game_state::SceneType::Mountain,
        "custom" | _ => crate::game_state::SceneType::Custom,
    }
}

fn parse_weather(s: &str) -> crate::game_state::Weather {
    match s.to_lowercase().as_str() {
        "clear" => crate::game_state::Weather::Clear,
        "rain" => crate::game_state::Weather::Rain,
        "storm" => crate::game_state::Weather::Storm,
        "snow" => crate::game_state::Weather::Snow,
        "fog" => crate::game_state::Weather::Fog,
        "cloudy" | _ => crate::game_state::Weather::Cloudy,
    }
}

fn parse_time_of_day(s: &str) -> crate::game_state::TimeOfDay {
    match s.to_lowercase().as_str() {
        "dawn" => crate::game_state::TimeOfDay::Dawn,
        "morning" => crate::game_state::TimeOfDay::Morning,
        "noon" => crate::game_state::TimeOfDay::Noon,
        "afternoon" => crate::game_state::TimeOfDay::Afternoon,
        "dusk" => crate::game_state::TimeOfDay::Dusk,
        "night" => crate::game_state::TimeOfDay::Night,
        "midnight" | _ => crate::game_state::TimeOfDay::Midnight,
    }
}

/// 将 GameState 的场景/天气/时间同步到 SceneVisualState
fn sync_scene_visual_from_game_state(
    game_state: Res<GameStateResource>,
    mut visual_state: ResMut<crate::visuals::SceneVisualState>,
) {
    // 只在状态变化时更新
    if game_state.state.scene_type != visual_state.current_scene {
        visual_state.current_scene = game_state.state.scene_type;
    }
    if game_state.state.weather != visual_state.current_weather {
        visual_state.current_weather = game_state.state.weather;
    }
    if game_state.state.game_time.time_of_day != visual_state.current_time {
        visual_state.current_time = game_state.state.game_time.time_of_day;
    }
}

/// 处理键盘快捷键
/// - 数字键 1-4: 选择选项
/// - Esc: 取消/返回
/// - Ctrl+S: 保存游戏
fn handle_keyboard_shortcuts(
    keyboard: Res<bevy::prelude::ButtonInput<bevy::prelude::KeyCode>>,
    game_state: Res<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    use bevy::prelude::KeyCode;

    let choices: Vec<_> = game_state.state.choices.iter().take(4).cloned().collect();

    // 数字键 1-4 选择选项
    for (i, choice) in choices.iter().enumerate() {
        let key = match i {
            0 => KeyCode::Digit1,
            1 => KeyCode::Digit2,
            2 => KeyCode::Digit3,
            3 => KeyCode::Digit4,
            _ => continue,
        };

        if keyboard.just_pressed(key) {
            engine_bridge.bridge.send(runtime::EngineCommand::ChoiceSelected {
                id: choice.id.clone(),
                text: choice.text.clone(),
            });
        }
    }

    // Esc 取消当前操作
    if keyboard.just_pressed(KeyCode::Escape) {
        // 可以发送取消命令或关闭弹窗
    }

    // Ctrl+S 保存游戏
    if keyboard.pressed(KeyCode::ControlLeft) && keyboard.just_pressed(KeyCode::KeyS) {
        let save_name = format!("auto_{}", chrono::Utc::now().timestamp());
        engine_bridge.bridge.send(runtime::EngineCommand::Save(save_name));
    }
}
