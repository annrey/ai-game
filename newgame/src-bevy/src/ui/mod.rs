use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts};

use crate::game_state::{ConnectionStatus, EngineBackend};
use crate::runtime::EngineCommand;

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
    let turn_count = game_state.state.turn_count;

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
                        egui::RichText::new(format!("回合 {}", turn_count))
                            .color(egui::Color32::from_rgb(200, 200, 200))
                    );
                });
            });
        });
}

fn render_sidebar(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
    engine_bridge: Res<crate::EngineBridgeResource>,
) {
    let health = game_state.state.health;
    let max_health = game_state.state.max_health;
    let mana = game_state.state.mana;
    let max_mana = game_state.state.max_mana;
    let energy = game_state.state.energy;
    let max_energy = game_state.state.max_energy;
    let inventory: Vec<_> = game_state.state.inventory.iter()
        .map(|i| (i.name.clone(), i.quantity))
        .collect();

    egui::SidePanel::left("sidebar")
        .default_width(200.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new("角色状态")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            ui.label(format!("生命值: {}/{}", health, max_health));
            ui.label(format!("法力值: {}/{}", mana, max_mana));
            ui.label(format!("体力值: {}/{}", energy, max_energy));

            ui.add_space(20.0);

            ui.heading(
                egui::RichText::new("背包")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            for (name, quantity) in &inventory {
                ui.label(format!("{} x{}", name, quantity));
            }

            ui.add_space(20.0);

            ui.heading(
                egui::RichText::new("引擎控制")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            let bridge = &engine_bridge.bridge;
            if ui.button("💾 快速存档").clicked() {
                let name = format!("save-{}", chrono::Utc::now().timestamp_millis());
                bridge.send(EngineCommand::Save(name));
            }
            if ui.button("🔄 重置世界").clicked() {
                bridge.send(EngineCommand::Reset);
            }
            if ui.button("⏬ 拉取快照").clicked() {
                bridge.send(EngineCommand::RequestSnapshot);
            }
        });
}

fn render_right_panel(
    mut contexts: EguiContexts,
    game_state: Res<crate::GameStateResource>,
) {
    let quests: Vec<_> = game_state.state.quests.iter()
        .map(|q| (q.title.clone(), q.status))
        .collect();
    let snapshot_backend = game_state.state.engine_snapshot.backend;
    let snapshot_status = game_state.state.engine_snapshot.connection_status;

    egui::SidePanel::right("right_panel")
        .default_width(200.0)
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new("任务")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            for (title, status) in &quests {
                let status_str = match status {
                    crate::game_state::QuestStatus::Active => "进行中",
                    crate::game_state::QuestStatus::Completed => "已完成",
                    crate::game_state::QuestStatus::Failed => "失败",
                };
                ui.label(format!("{}: {}", title, status_str));
            }

            ui.add_space(20.0);

            ui.heading(
                egui::RichText::new("引擎状态")
                    .color(egui::Color32::from_rgb(255, 137, 6))
            );
            ui.separator();

            let backend = match snapshot_backend {
                Some(EngineBackend::Ollama) => "Ollama",
                Some(EngineBackend::Echo) => "Echo",
                None => "未连接",
            };
            let status = match snapshot_status {
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
    let location_name = game_state.state.location_name.clone();
    let current_narrative = game_state.state.current_narrative.clone();

    egui::CentralPanel::default()
        .show(contexts.ctx_mut(), |ui: &mut egui::Ui| {
            ui.heading(
                egui::RichText::new(&location_name)
                    .color(egui::Color32::from_rgb(255, 137, 6))
                    .size(20.0)
            );
            ui.separator();

            egui::ScrollArea::vertical()
                .show(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(&current_narrative)
                            .color(egui::Color32::from_rgb(255, 255, 254))
                            .size(16.0)
                    );
                });
        });
}

fn render_choice_panel(
    mut contexts: EguiContexts,
    mut game_state: ResMut<crate::GameStateResource>,
    engine_bridge: ResMut<crate::EngineBridgeResource>,
) {
    // 先读取数据
    let choices: Vec<_> = game_state.state.choices.clone();
    let is_processing = game_state.state.is_processing;

    // 使用 Cell 来在闭包中存储选择结果
    let mut selected_id: Option<String> = None;
    let mut selected_text: Option<String> = None;

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

            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                for choice in &choices {
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

                    if button.clicked() && !is_processing {
                        selected_id = Some(choice.id.clone());
                        selected_text = Some(choice.text.clone());
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
        });

    // 在 UI 闭包外修改状态
    if let (Some(id), Some(text)) = (selected_id, selected_text) {
        game_state.state.is_processing = true;
        let _ = engine_bridge.bridge.cmd_tx.send(EngineCommand::ChoiceSelected { id, text });
    }
}
