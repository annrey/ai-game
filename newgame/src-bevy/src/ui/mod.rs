use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts};

use crate::game_state::{ConnectionStatus, EngineBackend};

pub struct GameUIPlugin;

impl Plugin for GameUIPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (
            render_top_bar,
            render_sidebar,
            render_right_panel,
            render_narrative_panel,
            render_choice_panel,
        ));
    }
}

fn render_top_bar(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
) {
    let state = game_state.state.lock().unwrap();

    egui::TopBottomPanel::top("top_bar")
        .max_height(60.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.heading(
                    egui::RichText::new("OpenClaw")
                        .color(egui::Color32::from_rgb(255, 137, 6))
                        .size(24.0)
                );

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!("回合 {}", state.turn_count))
                            .color(egui::Color32::from_rgb(200, 200, 200))
                    );
                });
            });
        });
}

fn render_sidebar(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
) {
    let state = game_state.state.lock().unwrap();

    egui::SidePanel::left("sidebar")
        .default_width(200.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new("角色状态")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            ui.label(format!("生命值: {}/{}", state.health, state.max_health));
            ui.label(format!("法力值: {}/{}", state.mana, state.max_mana));
            ui.label(format!("体力值: {}/{}", state.energy, state.max_energy));

            ui.add_space(20.0);

            ui.heading(
                egui::RichText::new("背包")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            for item in &state.inventory {
                ui.label(format!("{} x{}", item.name, item.quantity));
            }
        });
}

fn render_right_panel(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
) {
    let state = game_state.state.lock().unwrap();

    egui::SidePanel::right("right_panel")
        .default_width(200.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new("任务")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            for quest in &state.quests {
                let status = match quest.status {
                    crate::game_state::QuestStatus::Active => "进行中",
                    crate::game_state::QuestStatus::Completed => "已完成",
                    crate::game_state::QuestStatus::Failed => "失败",
                };
                ui.label(format!("{}: {}", quest.title, status));
            }

            ui.add_space(20.0);

            ui.heading(
                egui::RichText::new("引擎状态")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            let snapshot = &state.engine_snapshot;
            let backend = match snapshot.backend {
                Some(EngineBackend::Ollama) => "Ollama",
                Some(EngineBackend::Echo) => "Echo",
                None => "未连接",
            };
            let status = match snapshot.connection_status {
                ConnectionStatus::Online => "在线",
                ConnectionStatus::Offline => "离线",
                ConnectionStatus::Error => "错误",
            };
            ui.label(format!("后端: {}", backend));
            ui.label(format!("状态: {}", status));
        });
}

fn render_narrative_panel(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
) {
    let state = game_state.state.lock().unwrap();

    egui::CentralPanel::default()
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new(&state.location_name)
                    .color(egui::Color32::from_rgb(255, 137, 6))
                    .size(20.0)
            );
            ui.separator();

            egui::ScrollArea::vertical()
                .show(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(&state.current_narrative)
                            .color(egui::Color32::from_rgb(255, 255, 254))
                            .size(16.0)
                    );
                });
        });
}

fn render_choice_panel(
    mut contexts: EguiContexts,
    game_state: ResMut<crate::GameStateResource>,
    engine_bridge: ResMut<crate::EngineBridgeResource>,
) {
    let mut state = game_state.state.lock().unwrap();

    egui::TopBottomPanel::bottom("choice_panel")
        .max_height(180.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new("你的选择")
                    .color(egui::Color32::from_rgb(255, 137, 6))
                    .size(18.0)
            );
            ui.separator();
            ui.add_space(10.0);

            let choices: Vec<_> = state.choices.clone();
            let mut submitted_text: Option<String> = None;

            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                for (i, choice) in choices.iter().enumerate() {
                    let button_text = if let Some(icon) = &choice.icon {
                        format!("{} {}", icon, choice.text)
                    } else {
                        choice.text.clone()
                    };

                    let button = ui.add_sized(
                        [200.0, 60.0],
                        egui::Button::new(
                            egui::RichText::new(&button_text)
                                .color(egui::Color32::from_rgb(255, 255, 254))
                                .size(14.0)
                        )
                        .fill(egui::Color32::from_rgba_premultiplied(26, 24, 37, 255))
                        .stroke(egui::Stroke::new(1.0, egui::Color32::from_rgba_premultiplied(255, 137, 6, 100)))
                    );

                    if button.clicked() && !state.is_processing {
                        state.selected_choice = Some(i);
                        state.is_processing = true;
                        submitted_text = Some(choice.text.clone());
                    }

                    if let Some(desc) = &choice.description {
                        if ui.rect_contains_pointer(button.rect) {
                            egui::show_tooltip(ui.ctx(), ui.layer_id(), "choice_desc".into(), |ui: &mut egui::Ui| {
                                ui.label(desc);
                            });
                        }
                    }
                }
            });

            if let Some(text) = submitted_text {
                drop(state);
                let bridge = engine_bridge.bridge.lock().unwrap();
                let _ = bridge.process_input(&text, &game_core::WorldState::default());
            }
        });
}
