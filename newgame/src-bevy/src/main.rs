use bevy::prelude::*;
use bevy_egui::EguiPlugin;
use std::sync::{Arc, Mutex};

mod game_state;
mod ui;
mod visuals;
mod engine_bridge;
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
        ))
        .run();
}

#[derive(Resource, Default)]
struct GameStateResource {
    state: Arc<Mutex<GameState>>,
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
    mut game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    commands.spawn(Camera2d::default());

    // Request initial snapshot from engine
    let _ = engine_bridge.bridge.cmd_tx.send(EngineCommand::RequestSnapshot);

    // Start with default game state
    let state = GameState::new();
    game_state.state = Arc::new(Mutex::new(state));

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
            let _ = engine_bridge.bridge.cmd_tx.send(EngineCommand::PlayerInput(
                "继续探索".to_string()
            ));
        }
    }
}

fn drain_snapshots(
    game_state: ResMut<GameStateResource>,
    engine_bridge: ResMut<EngineBridgeResource>,
) {
    // Drain all available snapshots from the channel
    while let Ok(snapshot) = engine_bridge.bridge.snap_rx.try_recv() {
        let mut state = game_state.state.lock().unwrap();

        // Update processing state
        state.is_processing = snapshot.pending;

        // Update narrative if there's new content
        if let Some(narrative) = snapshot.narrative_delta {
            state.add_narrative(narrative.content, narrative.is_player);
        }

        // Update world state from snapshot
        state.location_name = snapshot.world.location_name.clone();
        state.chapter = snapshot.world.chapter.clone();
        state.turn_count = snapshot.world.turn_count as i32;
        state.health = snapshot.world.health;
        state.max_health = snapshot.world.max_health;
        state.mana = snapshot.world.mana;
        state.max_mana = snapshot.world.max_mana;
        state.energy = snapshot.world.energy;
        state.max_energy = snapshot.world.max_energy;
        state.exploration_percent = snapshot.world.exploration_percent;
        state.locations_discovered = snapshot.world.locations_discovered;
        state.npcs_met = snapshot.world.npcs_met;
        state.items_collected = snapshot.world.items_collected;

        // Update inventory
        state.inventory = snapshot.world.inventory.iter().map(|i| {
            crate::game_state::InventoryItem {
                id: i.id.clone(),
                name: i.name.clone(),
                item_type: crate::game_state::ItemType::Misc, // Simplified mapping
                quantity: i.quantity,
                description: i.description.clone(),
                icon: i.icon.clone(),
            }
        }).collect();

        // Update quests
        state.quests = snapshot.world.quests.iter().map(|q| {
            crate::game_state::Quest {
                id: q.id.clone(),
                title: q.title.clone(),
                description: q.description.clone(),
                status: crate::game_state::QuestStatus::Active, // Simplified mapping
                objectives: vec![],
            }
        }).collect();

        // Update choices
        state.choices = snapshot.world.choices.iter().map(|c| {
            crate::game_state::PlayerChoice {
                id: c.id.clone(),
                text: c.text.clone(),
                description: c.description.clone(),
                icon: c.icon.clone(),
                enabled: c.enabled,
            }
        }).collect();

        // Update engine snapshot status
        state.engine_snapshot.connection_status = if snapshot.last_error.is_some() {
            crate::game_state::ConnectionStatus::Error
        } else {
            crate::game_state::ConnectionStatus::Online
        };
        if let Some(err) = snapshot.last_error {
            state.engine_snapshot.last_error = Some(err);
        }
    }
}
