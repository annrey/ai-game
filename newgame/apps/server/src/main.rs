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
    engine_factory::{BackendKind, EngineFactory, EngineFactoryConfig},
    engine_handle::EngineHandle,
    providers::provider_factory::{ProviderConfig, ProviderFactory},
    state_store::StateStore,
};
use std::path::PathBuf;

struct GuideState {
    is_active: bool,
    is_completed: bool,
    current_step: Option<String>,
    completed_steps: Vec<String>,
    total_steps: usize,
}

impl Default for GuideState {
    fn default() -> Self {
        Self {
            is_active: false,
            is_completed: false,
            current_step: None,
            completed_steps: Vec::new(),
            total_steps: 5, // Default tutorial has 5 steps
        }
    }
}

struct AppState {
    engine: EngineHandle,
    state_store: Arc<StateStore>,
    backend: BackendKind,
    provider_factory: ProviderFactory,
    config: Arc<tokio::sync::RwLock<serde_json::Value>>,
    rule_book: Arc<tokio::sync::RwLock<String>>,
    session_id: Arc<tokio::sync::RwLock<String>>,
    guide_state: Arc<tokio::sync::RwLock<GuideState>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let save_dir = PathBuf::from("../../data/saves");
    let db_path = "../../data/memories.db";
    let db_url = format!("sqlite://{}", db_path);

    tokio::fs::create_dir_all(&save_dir).await.ok();
    if !std::path::Path::new(db_path).exists() {
        tokio::fs::write(db_path, "").await.ok();
    }

    // 统一通过 EngineFactory 构造，与 Bevy / Tauri / FFI 同源
    let bundle = EngineFactory::build(EngineFactoryConfig {
        save_dir,
        memory_db_url: Some(db_url),
        provider_config: None,
        event_bus_capacity: 1024,
        register_default_rules: true,
    })
    .await?;

    let engine = bundle.handle.clone();
    let backend = bundle.backend;
    let state_store = engine.state_store();

    // 创建 ProviderFactory 用于可用性检测
    let provider_factory = ProviderFactory::new(ProviderConfig::default());

    // 启动事件循环
    {
        let engine = engine.clone();
        tokio::spawn(async move {
            engine.start().await;
        });
    }

    let session_id = format!("session-{}", chrono::Utc::now().timestamp_millis());

    let app_state = Arc::new(AppState {
        engine,
        state_store,
        backend,
        provider_factory,
        config: Arc::new(tokio::sync::RwLock::new(json!({
            "mode": "text-adventure",
            "maxHistoryTurns": 20,
            "autoSaveInterval": 10,
            "autoWorldTick": false,
            "idleTimeout": 30,
            "memoryMaxContextChars": 4000,
            "logging": false,
            "backend": backend.as_str(),
        }))),
        rule_book: Arc::new(tokio::sync::RwLock::new(String::new())),
        session_id: Arc::new(tokio::sync::RwLock::new(session_id)),
        guide_state: Arc::new(tokio::sync::RwLock::new(GuideState::default())),
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
    let backend = state.backend.as_str();

    // 获取真实的 provider 可用性
    let availability = state.provider_factory.check_availability().await;
    let mut availability_map = serde_json::Map::new();
    for item in availability {
        availability_map.insert(item.name.clone(), json!(item.available));
    }

    Json(json!({
        "success": true,
        "data": {
            "gameConfig": cfg,
            "backend": backend,
            "providerRouting": {
                "defaultProvider": state.provider_factory.default_provider_name(),
            },
            "runtime": {
                "sessionId": session_id,
            },
            "availability": availability_map,
            "ruleBook": { "enabled": !rule_book.is_empty(), "length": rule_book.len() },
        }
    }))
}

#[derive(Deserialize)]
#[allow(dead_code)]
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

async fn get_providers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // 获取真实的 provider 可用性
    let availability = state.provider_factory.check_availability().await;
    let mut availability_map = serde_json::Map::new();
    let mut models_map = serde_json::Map::new();

    for item in availability {
        availability_map.insert(item.name.clone(), json!(item.available));
        // 为每个可用的 provider 添加模型列表
        if item.available {
            let models: Vec<String> = item.models.iter().cloned().collect();
            models_map.insert(item.name.clone(), json!(models));
        }
    }

    Json(json!({
        "success": true,
        "data": {
            "availability": availability_map,
            "models": models_map
        }
    }))
}

#[derive(Deserialize, Default)]
struct StateQuery {
    summary: Option<bool>,
}

async fn get_state(
    State(state): State<Arc<AppState>>,
    Query(query): Query<StateQuery>,
) -> impl IntoResponse {
    match state.state_store.get_state_json().await {
        Ok(state_json_str) => {
            let mut state_val: Value = serde_json::from_str(&state_json_str).unwrap_or(json!({}));

            // 如果 summary=true，截掉 narrative_history 减少传输
            if query.summary == Some(true) {
                if let serde_json::Value::Object(ref mut m) = state_val {
                    m.remove("narrative_history");
                    m.remove("narrative"); // 同时移除当前叙事，只保留世界状态
                }
            }

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
    // 订阅事件总线（要求订阅发生在 dispatch 之前）
    let mut event_rx = state.engine.event_bus().subscribe();

    state.state_store.mutate(|s| { s.turn_count += 1; }).await;
    state.engine.dispatch_player_input(&payload.input).await;

    // 等待下一个 narrative_generated（限时 35s，超过则返回当前状态快照作为兑底）
    let narrative_event = tokio::time::timeout(Duration::from_secs(35), async {
        loop {
            match event_rx.recv().await {
                Ok(event) if event.event_type == "narrative_generated" => return Some(event),
                Ok(_) => continue,
                Err(_) => return None,
            }
        }
    })
    .await
    .ok()
    .flatten();

    let narrative_text = narrative_event
        .as_ref()
        .and_then(|e| e.payload.get("content").and_then(|c| c.as_str()).map(String::from))
        .unwrap_or_else(|| "说书人沉思中……".to_string());

    let state_snapshot: Value = state.state_store.get_state_json().await
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(json!({}));

    Json(json!({
        "success": true,
        "data": {
            "narrative": narrative_text,
            "backend": state.backend.as_str(),
            "stateSnapshot": state_snapshot,
        }
    }))
}

async fn process_turn_stream(State(state): State<Arc<AppState>>, Json(payload): Json<TurnPayload>) -> impl IntoResponse {
    // 订阅事件总线后再发送玩家输入，以免错过事件
    let event_rx = state.engine.event_bus().subscribe();
    state.state_store.mutate(|s| { s.turn_count += 1; }).await;
    state.engine.dispatch_player_input(&payload.input).await;

    let stream = futures_util::stream::unfold(
        (event_rx, false, std::time::Instant::now()),
        move |(mut rx, finished, start)| async move {
            // 总限时 35s，防止 narrator 总是不返回
            if finished || start.elapsed() > Duration::from_secs(35) {
                return None;
            }
            match tokio::time::timeout(Duration::from_secs(2), rx.recv()).await {
                Ok(Ok(event)) => {
                    let event_type = event.event_type.clone();
                    let event_data = serde_json::to_string(&event.payload)
                        .unwrap_or_else(|_| "{}".to_string());
                    let sse = axum::response::sse::Event::default()
                        .event(event_type.clone())
                        .data(event_data);
                    let is_done = event_type == "narrative_generated";
                    Some((
                        Ok::<_, std::convert::Infallible>(sse),
                        (rx, is_done, start),
                    ))
                }
                Ok(Err(_)) | Err(_) => {
                    // 心跳保活
                    let sse = axum::response::sse::Event::default()
                        .event("heartbeat")
                        .data(json!({
                            "ts": chrono::Utc::now().timestamp_millis()
                        }).to_string());
                    Some((Ok(sse), (rx, false, start)))
                }
            }
        },
    );

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

async fn get_guide_progress(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let guide = state.guide_state.read().await;
    let progress = if guide.total_steps > 0 {
        (guide.completed_steps.len() as f32 / guide.total_steps as f32 * 100.0) as i32
    } else {
        0
    };

    Json(json!({
        "success": true,
        "data": {
            "isActive": guide.is_active,
            "isCompleted": guide.is_completed,
            "progress": progress,
            "currentStep": guide.current_step.as_ref().map(|id| json!({ "id": id, "title": get_step_title(id), "description": "" })),
            "completedStepsCount": guide.completed_steps.len(),
            "totalStepsCount": guide.total_steps,
        }
    }))
}

fn get_step_title(step_id: &str) -> String {
    match step_id {
        "intro" => "游戏介绍".to_string(),
        "character_creation" => "创建角色".to_string(),
        "first_move" => "第一次行动".to_string(),
        "combat_tutorial" => "战斗教学".to_string(),
        "advanced_tips" => "高级技巧".to_string(),
        _ => "步骤".to_string(),
    }
}

#[derive(Deserialize)]
struct StartStepPayload {
    step_id: String,
}

async fn start_guide_step(State(state): State<Arc<AppState>>, Json(payload): Json<StartStepPayload>) -> impl IntoResponse {
    let mut guide = state.guide_state.write().await;
    guide.is_active = true;
    guide.current_step = Some(payload.step_id.clone());

    let progress = if guide.total_steps > 0 {
        (guide.completed_steps.len() as f32 / guide.total_steps as f32 * 100.0) as i32
    } else {
        0
    };

    Json(json!({
        "success": true,
        "data": {
            "isActive": true,
            "currentStep": { "id": payload.step_id, "title": get_step_title(&payload.step_id), "description": "" },
            "progress": progress,
        }
    }))
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CompleteStepPayload {
    #[serde(default)]
    data: Option<Value>,
}

async fn complete_guide_step(State(state): State<Arc<AppState>>, Json(_payload): Json<CompleteStepPayload>) -> impl IntoResponse {
    let mut guide = state.guide_state.write().await;

    // Clone current_step first to avoid borrow issues
    let current = guide.current_step.clone();
    if let Some(ref step) = current {
        if !guide.completed_steps.contains(step) {
            guide.completed_steps.push(step.clone());
        }
    }

    let progress = if guide.total_steps > 0 {
        let p = (guide.completed_steps.len() as f32 / guide.total_steps as f32 * 100.0) as i32;
        if p >= 100 {
            guide.is_completed = true;
            guide.is_active = false;
        }
        p
    } else {
        0
    };

    // Clone completed_steps to avoid borrow issues
    let completed = guide.completed_steps.clone();
    let is_completed = guide.is_completed;
    drop(guide); // Release the write lock

    // Determine next step
    let next_step = if is_completed {
        None
    } else {
        let all_steps = vec!["intro", "character_creation", "first_move", "combat_tutorial", "advanced_tips"];
        all_steps.into_iter()
            .find(|s| !completed.contains(&s.to_string()))
            .map(|s| json!({ "id": s, "title": get_step_title(s), "description": "" }))
    };

    Json(json!({
        "success": true,
        "data": {
            "isCompleted": is_completed,
            "progress": progress,
            "nextStep": next_step,
        }
    }))
}

#[derive(Deserialize)]
struct GuideChatPayload {
    message: String,
}

async fn guide_chat(State(state): State<Arc<AppState>>, Json(payload): Json<GuideChatPayload>) -> impl IntoResponse {
    // Try to dispatch to guide agent through the engine
    match state.engine.dispatch_to_agent("guide", &payload.message).await {
        Ok(response) => {
            Json(json!({
                "success": true,
                "data": { "response": response }
            }))
        }
        Err(e) => {
            // Fallback to local response if guide agent not available
            let guide = state.guide_state.read().await;
            let fallback = if guide.is_active {
                format!("向导 [{}]: 我正在这里帮助你。你问的是 '{}'", guide.current_step.as_ref().unwrap_or(&"general".to_string()), payload.message)
            } else {
                format!("向导: 欢迎来到游戏！你可以随时向我提问。你说的是 '{}'", payload.message)
            };

            Json(json!({
                "success": true,
                "data": { "response": fallback },
                "note": format!("GuideAgent not available: {}", e)
            }))
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guide_state_default() {
        let state = GuideState::default();
        assert!(!state.is_active);
        assert!(!state.is_completed);
        assert_eq!(state.current_step, None);
        assert_eq!(state.total_steps, 5);
        assert_eq!(state.completed_steps.len(), 0);
    }

    #[test]
    fn test_guide_state_mutation() {
        let mut state = GuideState::default();
        state.is_active = true;
        state.current_step = Some("basic-tutorial".to_string());
        state.completed_steps.push("ai-config".to_string());

        assert!(state.is_active);
        assert_eq!(state.current_step, Some("basic-tutorial".to_string()));
        assert_eq!(state.completed_steps.len(), 1);
    }

    mod request_schemas {
        use super::*;

        #[derive(Deserialize)]
        struct TurnRequest {
            input: String,
        }

        #[test]
        fn test_turn_request_valid() {
            let json = serde_json::json!({"input": "go north"});
            let req: TurnRequest = serde_json::from_value(json).unwrap();
            assert_eq!(req.input, "go north");
        }

        #[test]
        fn test_turn_request_rejects_missing_input() {
            let json = serde_json::json!({});
            let result = serde_json::from_value::<TurnRequest>(json);
            assert!(result.is_err());
        }

        #[test]
        fn test_turn_request_rejects_wrong_type() {
            let json = serde_json::json!({"input": 123});
            let result = serde_json::from_value::<TurnRequest>(json);
            assert!(result.is_err());
        }
    }
}
