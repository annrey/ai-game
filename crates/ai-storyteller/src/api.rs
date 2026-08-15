use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, Method, Request};
use axum::middleware::{self, Next};
use axum::response::{Html, IntoResponse, Response, Sse};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use futures_util::StreamExt;
use tokio_stream::wrappers::ReceiverStream;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;

use crate::config::RuntimeSettings;
use crate::engine::GameEngine;
use crate::error::{AppError, AppResult};
use crate::guide::{GuideManager, GuideStepId};
use crate::preview;
use crate::providers::{build_all, build_provider, endpoint_value};
use crate::security::url::assert_optional_provider_url;
use crate::types::{
    AgentRole, GameConfig, GameMode, ProviderEndpoint, ProviderFactoryConfig, ProviderKind,
};

const TURN_INPUT_MAX: usize = 8000;
const RULEBOOK_MAX: usize = 200_000;

#[derive(Clone)]
pub struct AppState {
    pub settings: RuntimeSettings,
    pub engine: Arc<Mutex<Option<GameEngine>>>,
    pub provider_cfg: Arc<Mutex<ProviderFactoryConfig>>,
    pub game_cfg: Arc<Mutex<GameConfig>>,
    pub rulebook: Arc<Mutex<String>>,
    pub guide: Arc<Mutex<GuideManager>>,
    pub preview_lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(
        settings: RuntimeSettings,
        engine: Option<GameEngine>,
        provider_cfg: ProviderFactoryConfig,
        game_cfg: GameConfig,
    ) -> Self {
        Self {
            settings,
            engine: Arc::new(Mutex::new(engine)),
            provider_cfg: Arc::new(Mutex::new(provider_cfg)),
            game_cfg: Arc::new(Mutex::new(game_cfg)),
            rulebook: Arc::new(Mutex::new(String::new())),
            guide: Arc::new(Mutex::new(GuideManager::default())),
            preview_lock: Arc::new(Mutex::new(())),
        }
    }

    pub async fn engine(&self) -> AppResult<tokio::sync::MutexGuard<'_, Option<GameEngine>>> {
        let guard = self.engine.lock().await;
        if guard.is_none() {
            return Err(AppError::Unavailable("UI preview mode: game API disabled".into()));
        }
        Ok(guard)
    }
}

fn ok(data: Value) -> Json<Value> {
    Json(json!({ "success": true, "data": data }))
}

fn ok_msg(message: &str) -> Json<Value> {
    Json(json!({ "success": true, "message": message }))
}

fn guide_json(payload: Value) -> Json<Value> {
    let mut root = json!({ "success": true, "data": payload });
    if let Some(map) = payload.as_object() {
        for (k, v) in map {
            root[k] = v.clone();
        }
    }
    Json(root)
}

pub fn router(state: AppState) -> Router {
    let ui_dir = state.settings.ui_dir.clone();
    let cors_origins = {
        let port = state.settings.port;
        let mut origins = vec![
            format!("http://127.0.0.1:{port}"),
            format!("http://localhost:{port}"),
        ];
        if let Some(extra) = &state.settings.cors_origin {
            origins.push(extra.clone());
        }
        origins
    };

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::HeaderName::from_static("x-api-token")])
        .allow_origin(AllowOrigin::predicate(move |origin, _| {
            origin.to_str().ok().is_some_and(|o| cors_origins.iter().any(|a| a == o))
        }))
        .allow_credentials(true);

    let api = Router::new()
        .route("/health", get(health))
        .route("/config", get(get_config).post(post_config))
        .route("/modes", get(list_modes))
        .route("/state", get(get_state))
        .route("/providers", get(get_providers))
        .route("/providers/config", post(post_providers))
        .route("/turn", post(post_turn))
        .route("/turn/stream", post(post_turn_stream))
        .route("/saves", get(list_saves))
        .route("/saves/{save_id}", delete(delete_save))
        .route("/save", post(save_game))
        .route("/load", post(load_game))
        .route("/reset", post(reset_game))
        .route("/turn-count", get(turn_count))
        .route("/memories", get(list_memories))
        .route("/memories/clear", post(clear_memories))
        .route("/memories/search", get(search_memories))
        .route("/rulebook", get(get_rulebook).post(post_rulebook))
        .route("/session/new", post(new_session))
        .route("/architecture", get(architecture))
        .route("/achievements", get(achievements))
        .route("/preview/default", get(preview_default))
        .route("/preview/generate", post(preview_generate))
        .route("/bootstrap/world", post(bootstrap))
        .route("/guide/progress", get(guide_progress))
        .route("/guide/step/start", post(guide_start))
        .route("/guide/step/complete", post(guide_complete))
        .route("/guide/step/skip", post(guide_skip))
        .route("/guide/hint", get(guide_hint))
        .route("/guide/chat", post(guide_chat))
        .route("/cot/current", get(cot_current))
        .route("/cot/history", get(cot_history))
        .route("/cot/expand", post(cot_expand))
        .route("/cot/stats", get(cot_stats))
        .route("/cot/events", get(cot_events));

    Router::new()
        .route("/", get(index))
        .route("/index.html", get(index))
        .nest("/api", api)
        .fallback_service(ServeDir::new(ui_dir))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(cors)
        .with_state(state)
}

fn cookie_token(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';').find_map(|part| {
        let (k, v) = part.trim().split_once('=')?;
        (k == "api_token").then(|| v.to_string())
    })
}

fn request_token(headers: &HeaderMap) -> Option<String> {
    if let Some(v) = headers.get("x-api-token").and_then(|v| v.to_str().ok()) {
        return Some(v.to_string());
    }
    if let Some(v) = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        if let Some(rest) = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer ")) {
            return Some(rest.trim().to_string());
        }
    }
    cookie_token(headers)
}

async fn auth_middleware(State(state): State<AppState>, req: Request<Body>, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let method = req.method().clone();
    if path.starts_with("/api") && path != "/api/health" && path != "/api/preview/default" {
        let mutating = !matches!(method, Method::GET | Method::HEAD | Method::OPTIONS);
        if (mutating || !state.settings.is_loopback_bind())
            && request_token(req.headers()).as_deref() != Some(state.settings.api_token.as_str())
        {
            return AppError::Unauthorized.into_response();
        }
    }
    next.run(req).await
}

async fn index(State(state): State<AppState>) -> impl IntoResponse {
    let path = state.settings.ui_dir.join("index.html");
    let html = std::fs::read_to_string(&path).unwrap_or_else(|_| "<h1>ui/index.html missing</h1>".into());
    let html = html.replace(
        "window.__API_TOKEN__ = window.__API_TOKEN__ || '';",
        &format!("window.__API_TOKEN__ = {};", serde_json::to_string(&state.settings.api_token).unwrap()),
    );
    let cookie = format!("api_token={}; Path=/; HttpOnly; SameSite=Strict", state.settings.api_token);
    ([(header::SET_COOKIE, cookie)], Html(html))
}

async fn health() -> Json<Value> {
    Json(json!({
        "success": true,
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

async fn get_config(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let engine = engine.as_ref().unwrap();
    let cfg = engine.config().clone();
    let pcfg = state.provider_cfg.lock().await.clone();
    Ok(ok(json!({
        "gameConfig": cfg,
        "providerRouting": pcfg,
        "ruleBook": { "enabled": !state.rulebook.lock().await.is_empty(), "length": state.rulebook.lock().await.len() },
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameConfigPatch {
    mode: Option<GameMode>,
    enabled_agents: Option<Vec<AgentRole>>,
    auto_world_tick: Option<bool>,
    idle_timeout: Option<u32>,
    auto_save_interval: Option<u32>,
    memory_max_context_chars: Option<u32>,
    max_history_turns: Option<usize>,
    streaming: Option<bool>,
    template_id: Option<String>,
}

async fn post_config(State(state): State<AppState>, Json(patch): Json<GameConfigPatch>) -> AppResult<Json<Value>> {
    if let Some(t) = patch.idle_timeout {
        if !(10..=300).contains(&t) {
            return Err(AppError::BadRequest("idleTimeout must be 10-300 seconds".into()));
        }
    }
    let mut engine = state.engine().await?;
    let engine = engine.as_mut().unwrap();
    let mut cfg = engine.config().clone();
    let template_id = patch.template_id.clone();
    if let Some(mode) = patch.mode {
        cfg = GameConfig::for_mode(mode);
    }
    if let Some(v) = patch.enabled_agents {
        cfg.enabled_agents = v;
    }
    if let Some(v) = patch.auto_world_tick {
        cfg.auto_world_tick = v;
    }
    if let Some(v) = patch.idle_timeout {
        cfg.idle_timeout = v;
    }
    if let Some(v) = patch.auto_save_interval {
        cfg.auto_save_interval = v;
    }
    if let Some(v) = patch.memory_max_context_chars {
        cfg.memory_max_context_chars = v;
    }
    if let Some(v) = patch.max_history_turns {
        cfg.max_history_turns = v;
    }
    if let Some(v) = patch.streaming {
        cfg.streaming = v;
    }
    if !cfg.enabled_agents.contains(&AgentRole::Narrator) {
        cfg.enabled_agents.insert(0, AgentRole::Narrator);
    }
    engine.set_config(cfg.clone());
    if patch.mode.is_some() || template_id.is_some() {
        engine.apply_mode_template(template_id.as_deref());
    }
    *state.game_cfg.lock().await = cfg.clone();
    Ok(ok(json!({ "gameConfig": cfg, "state": engine.state() })))
}

async fn list_modes() -> Json<Value> {
    use crate::types::GameMode;
    ok(json!({
        "modes": [
            { "id": GameMode::TextAdventure, "templates": crate::modes::templates_for(GameMode::TextAdventure) },
            { "id": GameMode::NpcSandbox, "templates": crate::modes::templates_for(GameMode::NpcSandbox) },
            { "id": GameMode::ChatRoleplay, "templates": crate::modes::templates_for(GameMode::ChatRoleplay) },
            { "id": GameMode::AiBattle, "templates": crate::modes::templates_for(GameMode::AiBattle) },
        ]
    }))
}

async fn get_state(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    Ok(ok(serde_json::to_value(engine.as_ref().unwrap().state())?))
}

async fn get_providers(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let cfg = state.provider_cfg.lock().await.clone();
    let providers = build_all(&cfg);
    let mut availability = serde_json::Map::new();
    let mut models = serde_json::Map::new();
    for p in providers {
        availability.insert(p.kind().as_str().into(), json!(p.is_available().await));
        models.insert(p.kind().as_str().into(), json!(p.list_models().await.unwrap_or_default()));
    }
    Ok(ok(json!({ "availability": availability, "models": models })))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ProviderPatch {
    default_provider: Option<ProviderKind>,
    ollama: Option<ProviderEndpoint>,
    local: Option<ProviderEndpoint>,
    lmstudio: Option<ProviderEndpoint>,
    jan: Option<ProviderEndpoint>,
    openai: Option<ProviderEndpoint>,
}

async fn post_providers(State(state): State<AppState>, Json(patch): Json<ProviderPatch>) -> AppResult<Json<Value>> {
    let mut cfg = state.provider_cfg.lock().await.clone();
    if let Some(kind) = patch.default_provider {
        cfg.default_provider = kind;
    }
    for (kind, ep) in [
        (ProviderKind::Ollama, patch.ollama.as_ref()),
        (ProviderKind::Local, patch.local.as_ref()),
        (ProviderKind::Lmstudio, patch.lmstudio.as_ref()),
        (ProviderKind::Jan, patch.jan.as_ref()),
        (ProviderKind::Openai, patch.openai.as_ref()),
    ] {
        if let Some(ep) = ep {
            assert_optional_provider_url(endpoint_value(kind, ep), kind.url_kind())?;
        }
    }
    if let Some(v) = patch.ollama { cfg.ollama = Some(v); }
    if let Some(v) = patch.local { cfg.local = Some(v); }
    if let Some(v) = patch.lmstudio { cfg.lmstudio = Some(v); }
    if let Some(v) = patch.jan { cfg.jan = Some(v); }
    if let Some(v) = patch.openai { cfg.openai = Some(v); }
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().set_provider_config(cfg.clone());
    *state.provider_cfg.lock().await = cfg;
    Ok(Json(json!({ "success": true })))
}

#[derive(Deserialize)]
struct TurnBody {
    input: String,
}

async fn post_turn(State(state): State<AppState>, Json(body): Json<TurnBody>) -> AppResult<Json<Value>> {
    if body.input.is_empty() {
        return Err(AppError::BadRequest("input is required".into()));
    }
    if body.input.len() > TURN_INPUT_MAX {
        return Err(AppError::BadRequest(format!("input must be at most {TURN_INPUT_MAX} characters")));
    }
    let mut engine = state.engine().await?;
    let result = engine.as_mut().unwrap().process_turn(&body.input).await?;
    Ok(ok(serde_json::to_value(result)?))
}

async fn post_turn_stream(State(state): State<AppState>, Json(body): Json<TurnBody>) -> AppResult<impl IntoResponse> {
    if body.input.is_empty() {
        return Err(AppError::BadRequest("input is required".into()));
    }
    if body.input.len() > TURN_INPUT_MAX {
        return Err(AppError::BadRequest(format!("input must be at most {TURN_INPUT_MAX} characters")));
    }
    let (tx, rx) = tokio::sync::mpsc::channel::<String>(64);
    tokio::spawn(async move {
        let err_tx = tx.clone();
        let mut engine = match state.engine().await {
            Ok(g) => g,
            Err(err) => {
                let _ = err_tx.send(format!("{}\n", json!({ "type": "error", "error": err.to_string() }))).await;
                return;
            }
        };
        let emit = |value: Value| {
            let _ = tx.try_send(format!("{value}\n"));
        };
        if let Err(err) = engine.as_mut().unwrap().process_turn_stream(&body.input, emit).await {
            let _ = err_tx.send(format!("{}\n", json!({ "type": "error", "error": err.to_string() }))).await;
        }
    });
    let stream = tokio_stream::wrappers::ReceiverStream::new(rx).map(Ok::<_, std::convert::Infallible>);
    Ok((
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        axum::body::Body::from_stream(stream),
    ))
}

async fn list_saves(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let saves = engine.as_ref().unwrap().list_saves(50)?;
    Ok(ok(json!({ "saves": saves })))
}

#[derive(Deserialize)]
struct SaveBody {
    name: Option<String>,
}

async fn save_game(State(state): State<AppState>, Json(body): Json<SaveBody>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let id = engine.as_ref().unwrap().save(&body.name.unwrap_or_else(|| format!("save-{}", chrono::Utc::now().timestamp_millis())))?;
    Ok(ok(json!({ "saveId": id })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadBody {
    save_id: String,
}

async fn load_game(State(state): State<AppState>, Json(body): Json<LoadBody>) -> AppResult<Json<Value>> {
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().load(&body.save_id)?;
    Ok(ok_msg("Game loaded successfully"))
}

async fn reset_game(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().reset();
    Ok(ok_msg("Game reset successfully"))
}

async fn delete_save(State(state): State<AppState>, Path(save_id): Path<String>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    engine.as_ref().unwrap().delete_save(&save_id)?;
    Ok(ok_msg("Save deleted successfully"))
}

async fn turn_count(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    Ok(ok(json!({ "turnCount": engine.as_ref().unwrap().turn_count() })))
}

#[derive(Deserialize)]
struct MemQuery {
    limit: Option<u32>,
    q: Option<String>,
}

async fn list_memories(State(state): State<AppState>, Query(q): Query<MemQuery>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let mm = engine.as_ref().unwrap().memory();
    let memories = mm.recent(q.limit.unwrap_or(50))?;
    Ok(ok(json!({ "memories": memories, "count": mm.count()? })))
}

async fn clear_memories(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    engine.as_ref().unwrap().memory().clear()?;
    Ok(Json(json!({ "success": true })))
}

async fn search_memories(State(state): State<AppState>, Query(q): Query<MemQuery>) -> AppResult<Json<Value>> {
    let query = q.q.ok_or_else(|| AppError::BadRequest("query parameter \"q\" is required".into()))?;
    let engine = state.engine().await?;
    let memories = engine.as_ref().unwrap().memory().search(&query, 20)?;
    Ok(ok(json!({ "memories": memories })))
}

async fn get_rulebook(State(state): State<AppState>) -> Json<Value> {
    ok(json!({ "text": *state.rulebook.lock().await }))
}

#[derive(Deserialize)]
struct RulebookBody {
    text: String,
}

async fn post_rulebook(State(state): State<AppState>, Json(body): Json<RulebookBody>) -> AppResult<Json<Value>> {
    if body.text.len() > RULEBOOK_MAX {
        return Err(AppError::BadRequest("rulebook too long".into()));
    }
    *state.rulebook.lock().await = body.text.clone();
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().set_rulebook(body.text);
    Ok(Json(json!({ "success": true })))
}

async fn new_session(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().rebuild_session();
    Ok(ok(json!({ "sessionId": engine.as_ref().unwrap().memory().session_id() })))
}

async fn architecture(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let cfg = engine.as_ref().unwrap().config();
    Ok(ok(json!({
        "features": [
            { "module": "输入层", "responsibilities": ["玩家输入", if cfg.streaming { "流式输出" } else { "非流式输出" }] },
            { "module": "引擎层", "responsibilities": ["回合推进", "存档/读档", "思维链"] },
            { "module": "记忆层", "responsibilities": [format!("上下文预算 {} 字符", cfg.memory_max_context_chars)] },
            { "module": "代理层", "responsibilities": cfg.enabled_agents },
            { "module": "Provider 层", "responsibilities": ["Ollama", "LM Studio", "Jan", "Local", "OpenAI"] },
        ]
    })))
}

async fn achievements(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let e = engine.as_ref().unwrap();
    Ok(ok(json!({ "achievements": e.achievements(), "count": e.unlocked_count() })))
}

async fn preview_default(State(state): State<AppState>) -> Response {
    let path = state.settings.ui_dir.join("generated/latest-preview.png");
    match std::fs::read(&path) {
        Ok(bytes) => ([(header::CONTENT_TYPE, "image/png")], bytes).into_response(),
        Err(_) => AppError::NotFound("default preview not found".into()).into_response(),
    }
}

#[derive(Deserialize, Default)]
struct PreviewBody {
    prompt: Option<String>,
}

async fn preview_generate(State(state): State<AppState>, Json(body): Json<PreviewBody>) -> AppResult<Json<Value>> {
    if !state.settings.preview_enabled || state.settings.preview_model_dir.is_none() {
        return Err(AppError::Forbidden(
            "Preview generation is disabled. Set ENABLE_PREVIEW_GENERATE=true and PIXEL_MODEL_DIR.".into(),
        ));
    }
    let prompt = body.prompt.unwrap_or_default();
    let Ok(_guard) = state.preview_lock.try_lock() else {
        return Err(AppError::Unavailable("Preview generation is already running".into()));
    };
    let meta = preview::generate(&state.settings, &prompt).await?;
    Ok(ok(meta))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct BootstrapBody {
    world_name: Option<String>,
    location: Option<String>,
    player_name: Option<String>,
    conflict: Option<String>,
}

async fn bootstrap(State(state): State<AppState>, Json(body): Json<BootstrapBody>) -> AppResult<Json<Value>> {
    let mut engine = state.engine().await?;
    engine.as_mut().unwrap().bootstrap(body.world_name, body.location, body.player_name, body.conflict);
    Ok(ok(json!({ "state": engine.as_ref().unwrap().state() })))
}

async fn guide_progress(State(state): State<AppState>) -> Json<Value> {
    guide_json(state.guide.lock().await.payload())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GuideStepBody {
    step_id: GuideStepId,
}

async fn guide_start(State(state): State<AppState>, Json(body): Json<GuideStepBody>) -> Json<Value> {
    let mut g = state.guide.lock().await;
    g.start(body.step_id);
    guide_json(g.payload())
}

async fn guide_complete(State(state): State<AppState>, Json(body): Json<GuideStepBody>) -> AppResult<Json<Value>> {
    {
        let g = state.guide.lock().await;
        g.can_complete(body.step_id).map_err(AppError::BadRequest)?;
    }
    match body.step_id {
        GuideStepId::AiConfig => {
            let cfg = state.provider_cfg.lock().await.clone();
            let provider = build_provider(cfg.default_provider, &cfg);
            if !state.settings.ui_only && !provider.is_available().await {
                return Err(AppError::BadRequest(
                    "还没有探测到可用的 AI 服务。先启动 Ollama / LM Studio，或在设置里改 endpoint。".into(),
                ));
            }
            state.guide.lock().await.draft.provider_ok = true;
        }
        GuideStepId::BasicSetup => {
            let mut g = state.guide.lock().await;
            if g.draft.player_name.is_none() {
                g.draft.player_name = Some("冒险者".into());
            }
            if g.draft.world_name.is_none() {
                g.draft.world_name = Some("未名之地".into());
            }
        }
        GuideStepId::WorldInit => {
            let draft = state.guide.lock().await.draft.clone();
            if let Ok(mut engine) = state.engine().await {
                if let Some(engine) = engine.as_mut() {
                    let template = draft.world_type.as_deref();
                    if template == Some("arena") {
                        engine.set_config(GameConfig::for_mode(GameMode::AiBattle));
                        engine.apply_mode_template(Some("arena"));
                    } else if template == Some("tavern") {
                        let cfg = GameConfig::for_mode(GameMode::NpcSandbox);
                        engine.set_config(cfg);
                        engine.apply_mode_template(Some("tavern"));
                    }
                    engine.apply_identity(draft.world_name, draft.player_name);
                }
            }
        }
        GuideStepId::BasicTutorial => {
            if let Ok(engine) = state.engine().await {
                if engine.as_ref().map(|e| e.turn_count()).unwrap_or(0) == 0 && !state.settings.ui_only {
                    return Err(AppError::BadRequest("先在主输入框做一次行动（例如「向北走」），再点下一步。".into()));
                }
            }
        }
        GuideStepId::AdvancedFeatures | GuideStepId::Completed => {}
    }
    let mut g = state.guide.lock().await;
    g.complete(body.step_id);
    Ok(guide_json(g.payload()))
}

async fn guide_skip(State(state): State<AppState>, Json(body): Json<GuideStepBody>) -> Json<Value> {
    let mut g = state.guide.lock().await;
    g.skip(body.step_id);
    guide_json(g.payload())
}

async fn guide_hint(State(state): State<AppState>) -> Json<Value> {
    let hint = state.guide.lock().await.hint();
    let mut body = guide_json(json!({ "hint": hint }));
    body.0["hint"] = json!(hint);
    body
}

#[derive(Deserialize)]
struct GuideChatBody {
    message: Option<String>,
}

async fn guide_chat(State(state): State<AppState>, Json(body): Json<GuideChatBody>) -> Json<Value> {
    let mut g = state.guide.lock().await;
    let reply = g.ingest_chat(body.message.as_deref().unwrap_or(""));
    let mut payload = g.payload();
    payload["response"] = json!(reply);
    payload["reply"] = json!(reply);
    let mut out = guide_json(payload);
    out.0["response"] = json!(reply);
    out
}

async fn cot_current(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let cot = engine.as_ref().unwrap().state().current_turn.as_ref().and_then(|t| t.chain_of_thought.clone());
    Ok(ok(json!({ "current": cot })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CotHistQuery {
    limit: Option<usize>,
    offset: Option<usize>,
    agent_role: Option<AgentRole>,
}

async fn cot_history(State(state): State<AppState>, Query(q): Query<CotHistQuery>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let mut items: Vec<_> = engine
        .as_ref()
        .unwrap()
        .state()
        .history
        .iter()
        .filter_map(|t| t.chain_of_thought.clone())
        .collect();
    if let Some(role) = q.agent_role {
        items.retain(|c| c.agent_role == role);
    }
    let total = items.len();
    let offset = q.offset.unwrap_or(0);
    let limit = q.limit.unwrap_or(50);
    let page: Vec<_> = items.into_iter().skip(offset).take(limit).collect();
    Ok(ok(json!({
        "items": page,
        "pagination": { "total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total }
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CotExpandBody {
    step_id: Option<String>,
    cot_id: Option<String>,
}

async fn cot_expand(State(state): State<AppState>, Json(body): Json<CotExpandBody>) -> AppResult<Json<Value>> {
    let step_id = body.step_id.ok_or_else(|| AppError::BadRequest("stepId is required".into()))?;
    let engine = state.engine().await?;
    let state_ref = engine.as_ref().unwrap().state();
    let mut target = None;
    if let Some(id) = &body.cot_id {
        target = state_ref.history.iter().find_map(|t| {
            t.chain_of_thought.as_ref().filter(|c| &c.id == id).cloned()
        });
    }
    if target.is_none() {
        target = state_ref.current_turn.as_ref().and_then(|t| t.chain_of_thought.clone());
    }
    let cot = target.ok_or_else(|| AppError::NotFound("未找到指定的思维链".into()))?;
    let step = cot
        .steps
        .iter()
        .find(|s| format!("{:?}", s.step).eq_ignore_ascii_case(&step_id) || s.title.contains(&step_id))
        .cloned()
        .ok_or_else(|| AppError::NotFound("未找到指定的思维步骤".into()))?;
    Ok(ok(json!({ "step": step, "chainOfThought": { "id": cot.id, "agentRole": cot.agent_role } })))
}

async fn cot_stats(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let engine = state.engine().await?;
    let cots: Vec<_> = engine.as_ref().unwrap().state().history.iter().filter_map(|t| t.chain_of_thought.as_ref()).collect();
    Ok(ok(json!({
        "summary": {
            "totalChainsOfThought": cots.len(),
            "avgStepsPerCot": if cots.is_empty() { 0.0 } else { cots.iter().map(|c| c.steps.len()).sum::<usize>() as f64 / cots.len() as f64 }
        }
    })))
}

async fn cot_events(State(state): State<AppState>) -> Sse<ReceiverStream<Result<axum::response::sse::Event, std::convert::Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::channel(8);
    tokio::spawn(async move {
        let mut last = String::new();
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let engine = state.engine.lock().await;
            let Some(engine) = engine.as_ref() else { continue };
            if let Some(cot) = engine.state().current_turn.as_ref().and_then(|t| t.chain_of_thought.as_ref()) {
                if cot.id != last {
                    last = cot.id.clone();
                    let payload = json!({ "type": "cot-update", "data": cot, "timestamp": chrono::Utc::now().timestamp_millis() });
                    if tx.send(Ok(axum::response::sse::Event::default().event("cot-update").data(payload.to_string()))).await.is_err() {
                        break;
                    }
                }
            }
        }
    });
    Sse::new(ReceiverStream::new(rx))
}
