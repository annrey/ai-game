use std::net::IpAddr;
use std::path::PathBuf;

use ai_storyteller::api::{router, AppState};
use ai_storyteller::config::RuntimeSettings;
use ai_storyteller::engine::GameEngine;
use ai_storyteller::types::{GameConfig, ProviderFactoryConfig};
use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

fn settings(tmp: &std::path::Path, bind: &str, preview: bool) -> RuntimeSettings {
    let ui = tmp.join("ui");
    std::fs::create_dir_all(ui.join("generated")).unwrap();
    RuntimeSettings {
        bind_host: bind.parse::<IpAddr>().unwrap(),
        port: 3000,
        allow_remote: bind != "127.0.0.1",
        api_token: "test-token".into(),
        cors_origin: None,
        ui_dir: ui,
        data_path: tmp.join("saves"),
        memory_db_path: tmp.join("mem.db"),
        ui_only: false,
        preview_enabled: preview,
        preview_model_dir: preview.then(|| tmp.join("models")),
        preview_python: Some(PathBuf::from("__missing_python__")),
        preview_script: Some(tmp.join("no-script.py")),
    }
}

fn app(tmp: &std::path::Path, bind: &str, preview: bool) -> axum::Router {
    let settings = settings(tmp, bind, preview);
    if preview {
        std::fs::create_dir_all(tmp.join("models")).unwrap();
    }
    let engine = GameEngine::new(
        GameConfig::default(),
        ProviderFactoryConfig::default(),
        settings.data_path.clone(),
        settings.memory_db_path.to_str().unwrap(),
        "api-test".into(),
        None,
    )
    .unwrap();
    router(AppState::new(settings, Some(engine), ProviderFactoryConfig::default(), GameConfig::default()))
}

async fn send(app: axum::Router, req: Request<Body>) -> (StatusCode, Value) {
    let resp = app.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or_else(|_| json!({ "raw": String::from_utf8_lossy(&bytes) }));
    (status, json)
}

fn post_json(path: &str, token: Option<&str>, body: Value) -> Request<Body> {
    let mut builder = Request::builder().method(Method::POST).uri(path).header(header::CONTENT_TYPE, "application/json");
    if let Some(t) = token {
        builder = builder.header("x-api-token", t);
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

#[tokio::test]
async fn health_is_public() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, body) = send(app(tmp.path(), "127.0.0.1", false), Request::get("/api/health").body(Body::empty()).unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn mutating_routes_require_token() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, _) = send(app(tmp.path(), "127.0.0.1", false), post_json("/api/reset", None, json!({}))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = send(app(tmp.path(), "127.0.0.1", false), post_json("/api/reset", Some("test-token"), json!({}))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn remote_bind_requires_token_on_reads() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, _) = send(
        app(tmp.path(), "0.0.0.0", false),
        Request::get("/api/state").body(Body::empty()).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let req = Request::builder()
        .method(Method::GET)
        .uri("/api/state")
        .header("x-api-token", "test-token")
        .body(Body::empty())
        .unwrap();
    let (status, body) = send(app(tmp.path(), "0.0.0.0", false), req).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn turn_rejects_empty_input() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, body) = send(
        app(tmp.path(), "127.0.0.1", false),
        post_json("/api/turn", Some("test-token"), json!({ "input": "" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap_or("").contains("required"));
}

#[tokio::test]
async fn save_roundtrip_and_reject_traversal() {
    let tmp = tempfile::tempdir().unwrap();
    let router = app(tmp.path(), "127.0.0.1", false);

    let (status, body) = send(router.clone(), post_json("/api/save", Some("test-token"), json!({ "name": "slot-1" }))).await;
    assert_eq!(status, StatusCode::OK);
    let id = body["data"]["saveId"].as_str().unwrap().to_string();

    let (status, body) = send(
        router.clone(),
        Request::get("/api/saves").body(Body::empty()).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["saves"][0]["id"], id);

    let (status, _) = send(
        router.clone(),
        post_json("/api/load", Some("test-token"), json!({ "saveId": id })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = send(
        router,
        post_json("/api/load", Some("test-token"), json!({ "saveId": "../../../package" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap_or("").contains("Invalid"));
}

#[tokio::test]
async fn preview_disabled_until_configured() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, body) = send(
        app(tmp.path(), "127.0.0.1", false),
        post_json("/api/preview/generate", Some("test-token"), json!({ "prompt": "雾港" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body["error"].as_str().unwrap_or("").contains("disabled"));
}

#[tokio::test]
async fn preview_generate_writes_fallback_image() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, body) = send(
        app(tmp.path(), "127.0.0.1", true),
        post_json("/api/preview/generate", Some("test-token"), json!({ "prompt": "雾港群岛夜景" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["success"], true);
    let url = body["data"]["url"].as_str().unwrap_or("");
    assert!(url.starts_with("/generated/latest-preview.png"));
    let out = tmp.path().join("ui/generated/latest-preview.png");
    assert!(out.exists(), "fallback preview should be written");
}

#[tokio::test]
async fn preview_rejects_empty_prompt() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, _) = send(
        app(tmp.path(), "127.0.0.1", true),
        post_json("/api/preview/generate", Some("test-token"), json!({ "prompt": "   " })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn invalid_idle_timeout_is_rejected() {
    let tmp = tempfile::tempdir().unwrap();
    let (status, body) = send(
        app(tmp.path(), "127.0.0.1", false),
        post_json("/api/config", Some("test-token"), json!({ "idleTimeout": 1 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap_or("").contains("idleTimeout"));
}
