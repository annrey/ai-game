use bevy::prelude::*;
use bevy_egui::EguiPlugin;
use std::sync::{Arc, Mutex};

mod game_state;
mod ui;
mod visuals;
mod engine_bridge;

use game_state::GameState;
use ui::GameUIPlugin;
use visuals::SceneBackgroundPlugin;
use engine_bridge::{EngineBridge, convert_world_state_to_game_state};
use game_core::WorldState;

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
            sync_engine_state,
            dispatch_inputs,
        ))
        .run();
}

#[derive(Resource, Default)]
struct GameStateResource {
    state: Arc<Mutex<GameState>>,
}

#[derive(Resource)]
struct EngineBridgeResource {
    bridge: Arc<Mutex<EngineBridge>>,
}

impl Default for EngineBridgeResource {
    fn default() -> Self {
        let bridge = EngineBridge::new().expect("Failed to create EngineBridge");
        Self {
            bridge: Arc::new(Mutex::new(bridge)),
        }
    }
}

fn setup_game(
    mut commands: Commands,
    mut game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    commands.spawn(Camera2d::default());

    let bridge = engine_bridge.bridge.lock().unwrap();
    if let Ok(world_state) = bridge.get_world_state() {
        let state = convert_world_state_to_game_state(&world_state);
        game_state.state = Arc::new(Mutex::new(state));
    } else {
        let state = GameState::new();
        game_state.state = Arc::new(Mutex::new(state));
    }

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
    game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    if keyboard.just_pressed(KeyCode::Space) {
        let state = game_state.state.lock().unwrap();
        if !state.is_processing {
            drop(state);
            let bridge = engine_bridge.bridge.lock().unwrap();
            let _ = bridge.process_input("继续探索", &WorldState::default());
        }
    }
}

fn sync_engine_state(
    game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    let bridge = engine_bridge.bridge.lock().unwrap();
    if let Ok(world_state) = bridge.get_world_state() {
        let mut state = game_state.state.lock().unwrap();
        *state = convert_world_state_to_game_state(&world_state);
    }
}

fn dispatch_inputs(
    game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    let bridge = engine_bridge.bridge.lock().unwrap();
    let _ = bridge.dispatch_pending_inputs();

    if let Some(narrative) = bridge.try_receive_narrative() {
        let mut state = game_state.state.lock().unwrap();
        state.add_narrative(narrative, false);
        state.is_processing = false;
    }
}
