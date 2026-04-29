use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Sse},
    routing::{get, post, delete},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use std::net::SocketAddr;
use std::collections::HashMap;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use futures_util::stream::Stream;

use game_core::{
    GameEngine, EventBus, RuleEngine, StateStore,
};
use game_core::agents::{
    narrator::NarratorAgent, guide::GuideAgent,
    AgentManager, BaseAgent,
};
use game_core::providers::OllamaProvider;
use memory::sqlite::SqliteMemoryStore;
use memory::store::MemoryStore;
use sqlx::sqlite::SqlitePoolOptions;
use std::path::PathBuf;

struct AppState {
    engine: Arc<GameEngine>,
    state_store: Arc<StateStore>,
    config: Arc<tokio::sync::RwLock<serde_json::Value>>,
    rule_book: Arc<tokio::sync::RwLock<String>>,
    session_id: Arc<tokio::sync::RwLock<String>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let save_dir = PathBuf::from("../../data/saves");
    let db_url = "sqlite://../../data/memories.db";

    tokio::fs::create_dir_all(&save_dir).await.ok();
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

    let provider = Arc::new(OllamaProvider::new(
        "llama3".to_string(),
        Some("http://localhost:11434".to_string()),
    ));

    let mut agent_manager = AgentManager::new();
    agent_manager.register("guide", Arc::new(GuideAgent::new(provider.clone())));

    let narrator = NarratorAgent::new(provider, Arc::new(agent_manager));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await?;
    let memory_store = SqliteMemoryStore::new(pool);
    memory_store.init().await?;
    let memory_store_arc: Arc<dyn MemoryStore> = Arc::new(memory_store);

    let engine = GameEngine::new(
        event_bus.clone(),
        state_store.clone(),
        rule_engine,
        narrator,
        memory_store_arc.clone(),
    );

    let engine_arc = Arc::new(engine);
    let engine_clone = Arc::clone(&engine_arc);
    tokio::spawn(async move {
        engine_clone.start().await;
    });

    let session_id = format!("session-{}", chrono::Utc::now().timestamp_millis());

    let app_state = Arc::new(AppState {
        engine: engine_arc,
        state_store: Arc::new(state_store),
        config: Arc::new(tokio::sync::RwLock::new(json!({
            "mode": "text-adventure",
            "maxHistoryTurns": 20,
            "autoSaveInterval": 10,
            "autoWorldTick": false,
            "idleTimeout": 30,
            "memoryMaxContextChars": 4000,
            "logging": false,
        }))),
        rule_book: Arc::new(tokio::sync::RwLock::new(String::new())),
        session_id: Arc::new(tokio::sync::RwLock::new(session_id)),
    });

    let app = Router::new()
        .route("/api/config", get(get_config).post(update_config))
        .route("/api/providers", get(get_providers))
        .route("/api/state", get(get_state))
        .route("/api/bootstrap/world", post(bootstrap_world))
        .route("/api/turn", post(process_turn))
        .route("/api/turn/stream", post(process_turn_stream))
        .route("/api/saves", get(list_saves).post(create_save))
        .route("/api/saves/:id/load", post(load_save))
        .route("/api/saves/:id", delete(delete_save))
        .route("/api/memories", get(get_memories))
        .route("/api/memories/search", get(search_memories))
        .route("/api/memories/clear", post(clear_memories))
        .route("/api/guide/progress", get(get_guide_progress))
        .route("/api/guide/step/start", post(start_guide_step))
        .route("/api/guide/step/complete", post(complete_guide_step))
        .route("/api/guide/chat", post(guide_chat))
        .route("/api/cot/current", get(get_cot_current))
        .route("/api/cot/history", get(get_cot_history))
        .route("/api/cot/stats", get(get_cot_stats))
        .route("/api/cot/events", get(get_cot_events))
        .route("/api/rulebook", get(get_rulebook).post(set_rulebook))
        .route("/api/achievements", get(get_achievements))
        .route("/api/health", get(health_check))
        .fallback_service(ServeDir::new("../../ui/dist"))
        .layer(cors)
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Rust Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ==================== Handlers ====================

async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cfg = state.config.read().await.clone();
    let rule_book = state.rule_book.read().await.clone();
    let session_id = state.session_id.read().await.clone();

    Json(json!({
        "success": true,
        "data": {
            "gameConfig": cfg,
            "providerRouting": {
                "defaultProvider": "ollama",
            },
            "runtime": {
                "sessionId": session_id,
            },
            "availability": {
                "ollama": true
            },
            "ruleBook": { "enabled": !rule_book.is_empty(), "length": rule_book.len() },
        }
    }))
}

#[derive(Deserialize)]
struct ConfigPatch {
    mode: Option<String>,
    language: Option<String>,
    enabled_agents: Option<Vec<String>>,
    streaming: Option<bool>,
    logging: Option<bool>,
    max_history_turns: Option<usize>,
    memory_max_context_chars: Option<usize>,
    auto_save_interval: Option<usize>,
    auto_world_tick: Option<bool>,
    idle_timeout: Option<u64>,
}

async fn update_config(State(state): State<Arc<AppState>>, Json(payload): Json<ConfigPatch>) -> impl IntoResponse {
    let mut cfg = state.config.write().await;
    if let Some(mode) = payload.mode {
        cfg["mode"] = json!(mode);
    }
    if let Some(max_history_turns) = payload.max_history_turns {
        cfg["maxHistoryTurns"] = json!(max_history_turns);
    }
    if let Some(memory_max_context_chars) = payload.memory_max_context_chars {
        cfg["memoryMaxContextChars"] = json!(memory_max_context_chars);
    }
    if let Some(auto_save_interval) = payload.auto_save_interval {
        cfg["autoSaveInterval"] = json!(auto_save_interval);
    }
    if let Some(auto_world_tick) = payload.auto_world_tick {
        cfg["autoWorldTick"] = json!(auto_world_tick);
    }
    if let Some(idle_timeout) = payload.idle_timeout {
        cfg["idleTimeout"] = json!(idle_timeout);
    }
    if let Some(logging) = payload.logging {
        cfg["logging"] = json!(logging);
    }

    Json(json!({ "success": true, "data": { "gameConfig": &*cfg } }))
}

async fn get_providers() -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "availability": { "ollama": true },
            "models": { "ollama": ["llama3"] }
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
    world_name: Option<String>,
    genre: Option<String>,
    tone: Option<String>,
    conflict: Option<String>,
    location: Option<String>,
    location_description: Option<String>,
    weather: Option<String>,
    player_name: Option<String>,
    player_role: Option<String>,
    player_background: Option<String>,
}

async fn bootstrap_world(State(state): State<Arc<AppState>>, Json(payload): Json<BootstrapPayload>) -> impl IntoResponse {
    state.state_store.mutate(|s| {
        s.turn_count = 0;
        if let serde_json::Value::Object(ref mut m) = s.variables {
            if let Some(world_name) = payload.world_name {
                m.insert("world_name".to_string(), json!(world_name));
            }
            if let Some(genre) = payload.genre {
                m.insert("genre".to_string(), json!(genre));
            }
            if let Some(tone) = payload.tone {
                m.insert("tone".to_string(), json!(tone));
            }
            if let Some(conflict) = payload.conflict {
                m.insert("conflict".to_string(), json!(conflict));
            }
            if let Some(location) = payload.location {
                m.insert("current_location".to_string(), json!(location));
            }
            if let Some(location_description) = payload.location_description {
                m.insert("location_description".to_string(), json!(location_description));
            }
            if let Some(weather) = payload.weather {
                s.weather = weather;
            }
            if let Some(player_name) = payload.player_name {
                m.insert("player_name".to_string(), json!(player_name));
            }
            if let Some(player_role) = payload.player_role {
                m.insert("player_role".to_string(), json!(player_role));
            }
            if let Some(player_background) = payload.player_background {
                m.insert("player_background".to_string(), json!(player_background));
            }
        }
    }).await;

    match state.state_store.get_state_json().await {
        Ok(state_json_str) => {
            let state_val: Value = serde_json::from_str(&state_json_str).unwrap_or(json!({}));
            Json(json!({
                "success": true,
                "data": { "state": state_val }
            }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

#[derive(Deserialize)]
struct TurnPayload {
    input: String,
}

async fn process_turn(State(state): State<Arc<AppState>>, Json(payload): Json<TurnPayload>) -> impl IntoResponse {
    let event = game_core::GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "player_input".to_string(),
        payload: json!({ "text": payload.input }),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    state.state_store.mutate(|s| {
        s.turn_count += 1;
    }).await;

    // Publish event via a cloned event bus from state_store mutation workaround
    // Since event_bus is private, we simulate by not publishing and rely on direct processing
    // In a real implementation, GameEngine should expose a publish method.

    Json(json!({
        "success": true,
        "data": {
            "narrative": format!("你做了: {}", payload.input),
            "stateSnapshot": serde_json::from_str::<Value>(&state.state_store.get_state_json().await.unwrap()).unwrap()
        }
    }))
}

async fn process_turn_stream(State(state): State<Arc<AppState>>, Json(payload): Json<TurnPayload>) -> impl IntoResponse {
    let input = payload.input.clone();
    let state_store = Arc::clone(&state.state_store);

    let stream = futures_util::stream::unfold(0, move |i| {
        let state_store = Arc::clone(&state_store);
        let input = input.clone();
        async move {
            if i == 0 {
                state_store.mutate(|s| {
                    s.turn_count += 1;
                }).await;
            }
            let narrative = format!("你做了: {}", input);
            let chunks: Vec<char> = narrative.chars().collect();
            if i >= chunks.len() {
                return None;
            }
            let end = (i + 3).min(chunks.len());
            let s: String = chunks[i..end].iter().collect();
            tokio::time::sleep(Duration::from_millis(50)).await;
            let event = axum::response::sse::Event::default().data(s);
            Some((Ok::<_, std::convert::Infallible>(event), end))
        }
    });

    Sse::new(stream)
}

async fn list_saves(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.list_saves(None).await {
        Ok(saves_json) => {
            let saves_val: Value = serde_json::from_str(&saves_json).unwrap_or(json!([]));
            Json(json!({ "success": true, "data": { "saves": saves_val } }))
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
        Ok(id) => Json(json!({ "success": true, "data": { "saveId": id } })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn load_save(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.load(&id).await {
        Ok(_) => Json(json!({ "success": true, "message": "Game loaded successfully" })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn delete_save(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.delete_save(&id).await {
        Ok(_) => Json(json!({ "success": true, "message": "Save deleted successfully" })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn get_memories(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.get_memories("{}").await {
        Ok(memories_json) => {
            let mems_val: Value = serde_json::from_str(&memories_json).unwrap_or(json!([]));
            Json(json!({ "success": true, "data": { "memories": mems_val, "count": mems_val.as_array().map(|a| a.len()).unwrap_or(0) } }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

async fn search_memories(State(state): State<Arc<AppState>>, Query(query): Query<SearchQuery>) -> impl IntoResponse {
    match state.engine.recall_memories(&query.q, "{\"limit\": 20}").await {
        Ok(memories_json) => {
            let mems_val: Value = serde_json::from_str(&memories_json).unwrap_or(json!([]));
            Json(json!({ "success": true, "data": { "memories": mems_val } }))
        },
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

async fn clear_memories(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.engine.clear_memories().await {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() }))
    }
}

// ==================== Guide ====================

async fn get_guide_progress(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "isActive": false,
            "isCompleted": false,
            "progress": 0,
            "currentStep": null,
            "completedStepsCount": 0,
            "totalStepsCount": 0,
        }
    }))
}

#[derive(Deserialize)]
struct StartStepPayload {
    step_id: String,
}

async fn start_guide_step(State(_state): State<Arc<AppState>>, Json(payload): Json<StartStepPayload>) -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "isActive": true,
            "currentStep": { "id": payload.step_id, "title": "步骤", "description": "" },
            "progress": 0,
        }
    }))
}

#[derive(Deserialize)]
struct CompleteStepPayload {
    #[serde(default)]
    data: Option<Value>,
}

async fn complete_guide_step(State(_state): State<Arc<AppState>>, Json(_payload): Json<CompleteStepPayload>) -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": {
            "isCompleted": false,
            "progress": 50,
            "nextStep": null,
        }
    }))
}

#[derive(Deserialize)]
struct GuideChatPayload {
    message: String,
}

async fn guide_chat(State(state): State<Arc<AppState>>, Json(payload): Json<GuideChatPayload>) -> impl IntoResponse {
    let state_json = state.state_store.get_state_json().await.unwrap_or_default();
    // GuideAgent is not directly accessible from GameEngine in current core version,
    // so we return a placeholder response.
    Json(json!({
        "success": true,
        "data": { "response": format!("向导收到消息: {}", payload.message) }
    }))
}

// ==================== Chain of Thought ====================

async fn get_cot_current(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let state_val = state.state_store.read(|s| serde_json::to_value(s).unwrap_or(json!({}))).await;
    let current_turn = state_val.get("currentTurn");

    if let Some(turn) = current_turn {
        if let Some(cot) = turn.get("chainOfThought") {
            return Json(json!({ "success": true, "data": { "current": cot } }));
        }
    }

    Json(json!({
        "success": true,
        "data": { "current": null, "message": "当前没有活跃的思维链" }
    }))
}

#[derive(Deserialize)]
struct CotHistoryQuery {
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    offset: Option<usize>,
    #[serde(default)]
    agent_role: Option<String>,
}

async fn get_cot_history(State(state): State<Arc<AppState>>, Query(query): Query<CotHistoryQuery>) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);
    let state_val = state.state_store.read(|s| serde_json::to_value(s).unwrap_or(json!({}))).await;

    let history = state_val.get("history").and_then(|h| h.as_array()).cloned().unwrap_or_default();

    let mut all_cots: Vec<Value> = history.into_iter()
        .filter_map(|turn| turn.get("chainOfThought").cloned())
        .collect();

    if let Some(ref role) = query.agent_role {
        all_cots.retain(|cot| cot.get("agentRole").and_then(|r| r.as_str()) == Some(role));
    }

    let total = all_cots.len();
    let paginated: Vec<Value> = all_cots.into_iter().skip(offset).take(limit).collect();

    Json(json!({
        "success": true,
        "data": {
            "items": paginated,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "hasMore": offset + limit < total,
            }
        }
    }))
}

async fn get_cot_stats(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let state_val = state.state_store.read(|s| serde_json::to_value(s).unwrap_or(json!({}))).await;
    let history = state_val.get("history").and_then(|h| h.as_array()).cloned().unwrap_or_default();

    let all_cots: Vec<Value> = history.into_iter()
        .filter_map(|turn| turn.get("chainOfThought").cloned())
        .collect();

    let mut stats_by_agent: HashMap<String, serde_json::Value> = HashMap::new();
    let mut overall_total_duration = 0i64;
    let mut overall_total_steps = 0usize;

    for cot in &all_cots {
        let agent_role = cot.get("agentRole").and_then(|r| r.as_str()).unwrap_or("unknown").to_string();
        let steps = cot.get("steps").and_then(|s| s.as_array()).cloned().unwrap_or_default();
        let cot_duration: i64 = steps.iter().filter_map(|s| s.get("duration").and_then(|d| d.as_i64())).sum();

        let entry = stats_by_agent.entry(agent_role.clone()).or_insert_with(|| json!({
            "count": 0,
            "totalDuration": 0,
            "avgDuration": 0,
            "totalSteps": 0,
        }));

        if let Some(obj) = entry.as_object_mut() {
            let count = obj.get("count").and_then(|c| c.as_i64()).unwrap_or(0) + 1;
            let total_dur = obj.get("totalDuration").and_then(|c| c.as_i64()).unwrap_or(0) + cot_duration;
            let total_steps = obj.get("totalSteps").and_then(|c| c.as_i64()).unwrap_or(0) + steps.len() as i64;
            obj.insert("count".to_string(), json!(count));
            obj.insert("totalDuration".to_string(), json!(total_dur));
            obj.insert("totalSteps".to_string(), json!(total_steps));
            obj.insert("avgDuration".to_string(), json!(if count > 0 { total_dur / count } else { 0 }));
        }

        overall_total_duration += cot_duration;
        overall_total_steps += steps.len();
    }

    let total_cots = all_cots.len();
    let avg_thinking_time = if total_cots > 0 { overall_total_duration / total_cots as i64 } else { 0 };
    let avg_steps_per_cot = if total_cots > 0 { overall_total_steps as f64 / total_cots as f64 } else { 0.0 };

    let high_quality = all_cots.iter().filter(|cot| {
        cot.get("steps").and_then(|s| s.as_array()).map(|a| a.len() >= 4).unwrap_or(false)
    }).count();
    let medium_quality = all_cots.iter().filter(|cot| {
        cot.get("steps").and_then(|s| s.as_array()).map(|a| a.len() >= 2 && a.len() < 4).unwrap_or(false)
    }).count();
    let low_quality = all_cots.iter().filter(|cot| {
        cot.get("steps").and_then(|s| s.as_array()).map(|a| a.len() < 2).unwrap_or(false)
    }).count();
    let quality_score = if total_cots > 0 { (high_quality as f64 / total_cots as f64) * 100.0 } else { 0.0 };

    Json(json!({
        "success": true,
        "data": {
            "summary": {
                "totalChainsOfThought": total_cots,
                "avgThinkingTime": avg_thinking_time,
                "avgStepsPerCot": avg_steps_per_cot,
            },
            "byAgent": stats_by_agent,
            "qualityMetrics": {
                "highQualityCount": high_quality,
                "mediumQualityCount": medium_quality,
                "lowQualityCount": low_quality,
                "qualityScore": format!("{:.1}", quality_score),
            }
        }
    }))
}

async fn get_cot_events(State(state): State<Arc<AppState>>) -> Sse<impl Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>> {
    // Since event_bus is private in GameEngine, we simulate SSE with a heartbeat
    let stream = futures_util::stream::unfold(0, move |i| {
        let state_store = Arc::clone(&state.state_store);
        async move {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let state_val = state_store.read(|s| serde_json::to_value(s).unwrap_or(json!({}))).await;
            let current_turn = state_val.get("currentTurn");
            let has_cot = current_turn.and_then(|t| t.get("chainOfThought")).is_some();
            let data = if has_cot && i % 2 == 0 {
                json!({
                    "type": "cot-update",
                    "data": current_turn.and_then(|t| t.get("chainOfThought")),
                    "timestamp": chrono::Utc::now().timestamp_millis(),
                })
            } else {
                json!({ "type": "heartbeat", "timestamp": chrono::Utc::now().timestamp_millis() })
            };
            let event = axum::response::sse::Event::default()
                .event(if has_cot && i % 2 == 0 { "cot-update" } else { "heartbeat" })
                .data(data.to_string());
            Some((Ok::<_, std::convert::Infallible>(event), i + 1))
        }
    });

    Sse::new(stream)
}

// ==================== Rulebook ====================

async fn get_rulebook(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let text = state.rule_book.read().await.clone();
    Json(json!({ "success": true, "data": { "text": text } }))
}

#[derive(Deserialize)]
struct RulebookPayload {
    text: String,
}

async fn set_rulebook(State(state): State<Arc<AppState>>, Json(payload): Json<RulebookPayload>) -> impl IntoResponse {
    let mut text = state.rule_book.write().await;
    *text = payload.text.clone();
    Json(json!({ "success": true }))
}

// ==================== Achievements ====================

async fn get_achievements(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let state_val = state.state_store.read(|s| serde_json::to_value(s).unwrap_or(json!({}))).await;
    let achievements = state_val.get("achievements").cloned().unwrap_or(json!([]));
    let count = achievements.as_array().map(|a| a.len()).unwrap_or(0);
    Json(json!({ "success": true, "data": { "achievements": achievements, "count": count } }))
}

async fn health_check() -> impl IntoResponse {
    Json(json!({
        "success": true,
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}
