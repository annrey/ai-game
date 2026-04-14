use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use game_core::{GameEngine, EventBus, RuleEngine, StateStore, WorldState};
use game_core::agents::narrator::NarratorAgent;
use game_core::agents::guide::GuideAgent;
use game_core::agents::AgentManager;
use game_core::providers::OllamaProvider;
use memory::sqlite::SqliteMemoryStore;
use memory::store::MemoryStore;
use sqlx::sqlite::SqlitePoolOptions;
use std::path::PathBuf;
use serde::Deserialize;

struct AppState {
    engine: Arc<GameEngine>,
    state_store: Arc<StateStore>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Setup Cors
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Initialize GameEngine (similar to what we did in FFI)
    let save_dir = PathBuf::from("../../data/saves");
    let db_url = "sqlite://../../data/memories.db";
    let ollama_url = Some("http://localhost:11434".to_string());

    // Ensure save directory exists
    tokio::fs::create_dir_all(&save_dir).await.ok();
    // Ensure memory db file exists if sqlite
    if !std::path::Path::new("../../data/memories.db").exists() {
        tokio::fs::write("../../data/memories.db", "").await.ok();
    }

    let event_bus = EventBus::new(1024);
    let state_store = StateStore::new(save_dir);
    
    let mut rule_engine = RuleEngine::new();
    rule_engine.register_rule(Box::new(game_core::rules::movement::MovementRule));
    rule_engine.register_rule(Box::new(game_core::rules::economy::EconomyRule));
    rule_engine.register_rule(Box::new(game_core::rules::relationship::RelationshipRule));
    rule_engine.register_rule(Box::new(game_core::rules::schedule::ScheduleRule));
    rule_engine.register_rule(Box::new(game_core::rules::quest::QuestRule));
    rule_engine.register_rule(Box::new(game_core::rules::item::ItemRule));

    let provider = Arc::new(OllamaProvider::new("llama3".to_string(), ollama_url));
    
    let mut agent_manager = AgentManager::new();
    agent_manager.register("guide", Arc::new(GuideAgent::new(provider.clone())));
    
    let narrator = NarratorAgent::new(provider, Arc::new(agent_manager));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await?;
    let memory_store = SqliteMemoryStore::new(pool);
    memory_store.init().await?;

    let engine = GameEngine::new(
        event_bus.clone(),
        state_store.clone(),
        rule_engine,
        narrator,
        Arc::new(memory_store),
    );

    // Start engine loop
    let engine_arc = Arc::new(engine);
    let engine_clone = Arc::clone(&engine_arc);
    tokio::spawn(async move {
        engine_clone.start().await;
    });

    let app_state = Arc::new(AppState {
        engine: engine_arc,
        state_store: Arc::new(state_store),
    });

    let app = Router::new()
        .route("/api/config", get(get_config))
        .route("/api/providers", get(get_providers))
        .route("/api/state", get(get_state))
        .route("/api/bootstrap/world", post(bootstrap_world))
        .route("/api/turn", post(process_turn))
        .route("/api/saves", get(list_saves).post(create_save))
        .route("/api/saves/:id/load", post(load_save))
        .route("/api/saves/:id", delete(delete_save))
        .route("/api/memories", get(get_memories))
        .layer(cors)
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Rust Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// Handlers

async fn get_config() -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "mode": "text-adventure",
            "providerRouting": {
                "defaultProvider": "ollama",
                "ollama": { "defaultModel": "llama3" }
            },
            "availability": {
                "ollama": true
            }
        }
    }))
}

async fn get_providers() -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "models": {
                "ollama": ["llama3"]
            }
        }
    }))
}

async fn get_state(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.state_store.get_state_json().await {
        Ok(state_json_str) => {
            let state_val: Value = serde_json::from_str(&state_json_str).unwrap_or(json!({}));
            Json(json!({ "success": true, "data": state_val }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

#[derive(Deserialize)]
struct BootstrapPayload {
    // fields from frontend...
}

async fn bootstrap_world(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Reset state simply for now
    state.state_store.mutate(|s| {
        *s = WorldState::default();
    }).await;
    
    Json(json!({
        "success": true,
        "data": {
            "narrative": "世界已重新初始化。"
        }
    }))
}

#[derive(Deserialize)]
struct TurnPayload {
    input: String,
}

async fn process_turn(State(state): State<Arc<AppState>>, Json(payload): Json<TurnPayload>) -> impl IntoResponse {
    // In a real implementation, we would wait for the narrator response event.
    // For this basic bridge, we'll just dispatch the event and return a mock response
    // or we could use a one-shot channel to wait for the narrative event.
    
    let event = game_core::GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "player_input".to_string(),
        payload: json!({ "text": payload.input }),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    // To properly wait for the response, we'd need to modify the engine or subscribe locally.
    // Here we just simulate an async processing.
    state.state_store.mutate(|s| {
        s.turn_count += 1;
    }).await;

    Json(json!({
        "success": true,
        "data": {
            "narrative": format!("你做了: {}", payload.input),
            "stateSnapshot": serde_json::from_str::<Value>(&state.state_store.get_state_json().await.unwrap()).unwrap()
        }
    }))
}

async fn list_saves(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.list_saves(None).await {
        Ok(saves_json) => {
            let saves_val: Value = serde_json::from_str(&saves_json).unwrap_or(json!([]));
            Json(json!({ "success": true, "data": saves_val }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

#[derive(Deserialize)]
struct SavePayload {
    name: String,
}

async fn create_save(State(state): State<Arc<AppState>>, Json(payload): Json<SavePayload>) -> impl IntoResponse {
    match state.engine.save(&payload.name, "text-adventure").await {
        Ok(id) => Json(json!({ "success": true, "data": { "id": id } })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn load_save(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.load(&id).await {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn delete_save(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.delete_save(&id).await {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn get_memories(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.get_memories("{}").await {
        Ok(memories_json) => {
            let mems_val: Value = serde_json::from_str(&memories_json).unwrap_or(json!([]));
            Json(json!({ "success": true, "data": mems_val }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}
