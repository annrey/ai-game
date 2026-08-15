use std::net::SocketAddr;

use ai_storyteller::api::{router, AppState};
use ai_storyteller::config::{game_config_from_env, provider_config_from_env, RuntimeSettings};
use ai_storyteller::engine::GameEngine;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("ai_storyteller=info".parse()?))
        .init();

    let ui_only = std::env::args().any(|a| a == "--ui-only");
    let settings = RuntimeSettings::from_env(ui_only);
    let game_cfg = game_config_from_env();
    let provider_cfg = provider_config_from_env();

    let engine = if ui_only {
        tracing::info!("UI preview mode: skipping GameEngine");
        None
    } else {
        Some(GameEngine::new(
            game_cfg.clone(),
            provider_cfg.clone(),
            settings.data_path.clone(),
            settings.memory_db_path.to_string_lossy().as_ref(),
            format!("session-{}", chrono::Utc::now().timestamp_millis()),
            None,
        )?)
    };

    let state = AppState::new(settings.clone(), engine, provider_cfg, game_cfg);

    let app = router(state.clone());
    let ticker = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let mut guard = ticker.engine.lock().await;
            if let Some(engine) = guard.as_mut() {
                if engine.should_auto_tick() {
                    if let Err(err) = engine.auto_world_tick().await {
                        tracing::warn!("auto world tick failed: {err}");
                    }
                }
            }
        }
    });
    let addr = SocketAddr::new(settings.bind_host, settings.port);
    tracing::info!("listening on http://{addr}");
    println!(
        "\nAI 说书人委员会 · Rust\n访问: http://{}:{}\n绑定: {addr}\n",
        if settings.bind_host.is_unspecified() { "127.0.0.1".to_string() } else { settings.bind_host.to_string() },
        settings.port
    );
    if !settings.is_loopback_bind() {
        println!("警告: 非回环绑定，写入 API 需要 X-Api-Token");
    }

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
