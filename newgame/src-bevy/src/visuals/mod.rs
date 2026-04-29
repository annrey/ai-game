use bevy::prelude::*;
use crate::game_state::{SceneType, Weather, TimeOfDay};

pub struct SceneBackgroundPlugin;

impl Plugin for SceneBackgroundPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(SceneVisualState::default())
            .add_systems(Startup, setup_visuals)
            .add_systems(Update, (
                update_background_color,
                update_weather_effects,
                update_time_overlay,
                animate_particles,
            ));
    }
}

#[derive(Resource)]
pub struct SceneVisualState {
    pub current_scene: SceneType,
    pub current_weather: Weather,
    pub current_time: TimeOfDay,
}

impl Default for SceneVisualState {
    fn default() -> Self {
        Self {
            current_scene: SceneType::Forest,
            current_weather: Weather::Clear,
            current_time: TimeOfDay::Morning,
        }
    }
}

#[derive(Component)]
pub struct BackgroundSprite;

#[derive(Component)]
pub struct WeatherParticle;

#[derive(Component)]
pub struct TimeOverlay;

fn setup_visuals(
    mut commands: Commands,
) {
    commands.spawn((
        Sprite {
            color: Color::srgb(0.05, 0.05, 0.1),
            custom_size: Some(Vec2::new(1280.0, 800.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, -1.0),
        BackgroundSprite,
    ));
}

fn update_background_color(
    visual_state: Res<SceneVisualState>,
    mut query: Query<&mut Sprite, With<BackgroundSprite>>,
) {
    if visual_state.is_changed() {
        for mut sprite in query.iter_mut() {
            sprite.color = match visual_state.current_scene {
                SceneType::Forest => Color::srgb(0.1, 0.25, 0.1),
                SceneType::Town => Color::srgb(0.2, 0.2, 0.15),
                SceneType::Dungeon => Color::srgb(0.05, 0.05, 0.05),
                SceneType::Beach => Color::srgb(0.3, 0.4, 0.5),
                SceneType::Mountain => Color::srgb(0.2, 0.25, 0.3),
                SceneType::Custom => Color::srgb(0.1, 0.1, 0.15),
            };
        }
    }
}

fn update_weather_effects(
    visual_state: Res<SceneVisualState>,
    mut commands: Commands,
    query: Query<Entity, With<WeatherParticle>>,
) {
    if visual_state.is_changed() {
        for entity in query.iter() {
            commands.entity(entity).despawn();
        }

        match visual_state.current_weather {
            Weather::Rain | Weather::Storm => {
                for _ in 0..50 {
                    let x = rand::random::<f32>() * 1280.0 - 640.0;
                    let y = rand::random::<f32>() * 800.0 - 400.0;
                    commands.spawn((
                        Sprite {
                            color: Color::srgba(0.6, 0.7, 0.8, 0.6),
                            custom_size: Some(Vec2::new(1.0, 8.0)),
                            ..default()
                        },
                        Transform::from_xyz(x, y, 1.0),
                        WeatherParticle,
                    ));
                }
            }
            Weather::Snow => {
                for _ in 0..30 {
                    let x = rand::random::<f32>() * 1280.0 - 640.0;
                    let y = rand::random::<f32>() * 800.0 - 400.0;
                    commands.spawn((
                        Sprite {
                            color: Color::srgba(0.9, 0.9, 0.95, 0.8),
                            custom_size: Some(Vec2::new(3.0, 3.0)),
                            ..default()
                        },
                        Transform::from_xyz(x, y, 1.0),
                        WeatherParticle,
                    ));
                }
            }
            _ => {}
        }
    }
}

fn update_time_overlay(
    visual_state: Res<SceneVisualState>,
    mut query: Query<&mut Sprite, With<TimeOverlay>>,
) {
    if visual_state.is_changed() {
        for mut sprite in query.iter_mut() {
            sprite.color = match visual_state.current_time {
                TimeOfDay::Dawn => Color::srgba(1.0, 0.8, 0.6, 0.1),
                TimeOfDay::Morning => Color::srgba(1.0, 0.95, 0.8, 0.05),
                TimeOfDay::Noon => Color::srgba(1.0, 1.0, 1.0, 0.0),
                TimeOfDay::Afternoon => Color::srgba(0.9, 0.8, 0.6, 0.1),
                TimeOfDay::Dusk => Color::srgba(0.8, 0.5, 0.3, 0.2),
                TimeOfDay::Night => Color::srgba(0.1, 0.1, 0.3, 0.4),
                TimeOfDay::Midnight => Color::srgba(0.05, 0.05, 0.2, 0.5),
            };
        }
    }
}

fn animate_particles(
    mut query: Query<&mut Transform, With<WeatherParticle>>,
    visual_state: Res<SceneVisualState>,
) {
    match visual_state.current_weather {
        Weather::Rain | Weather::Storm => {
            for mut transform in query.iter_mut() {
                transform.translation.y -= 5.0;
                if transform.translation.y < -400.0 {
                    transform.translation.y = 400.0;
                    transform.translation.x = rand::random::<f32>() * 1280.0 - 640.0;
                }
            }
        }
        Weather::Snow => {
            for mut transform in query.iter_mut() {
                transform.translation.y -= 1.0;
                transform.translation.x += (transform.translation.y * 0.01).sin() * 0.5;
                if transform.translation.y < -400.0 {
                    transform.translation.y = 400.0;
                    transform.translation.x = rand::random::<f32>() * 1280.0 - 640.0;
                }
            }
        }
        _ => {}
    }
}
