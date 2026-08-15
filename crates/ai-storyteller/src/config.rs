use std::env;
use std::net::IpAddr;
use std::path::PathBuf;

use crate::types::{GameConfig, LogLevel, LoggingConfig, ProviderEndpoint, ProviderFactoryConfig, ProviderKind};

#[derive(Debug, Clone)]
pub struct RuntimeSettings {
    pub bind_host: IpAddr,
    pub port: u16,
    pub allow_remote: bool,
    pub api_token: String,
    pub cors_origin: Option<String>,
    pub ui_dir: PathBuf,
    pub data_path: PathBuf,
    pub memory_db_path: PathBuf,
    pub ui_only: bool,
    pub preview_enabled: bool,
    pub preview_model_dir: Option<PathBuf>,
    pub preview_python: Option<PathBuf>,
    pub preview_script: Option<PathBuf>,
}

impl RuntimeSettings {
    pub fn from_env(ui_only: bool) -> Self {
        let _ = dotenvy::dotenv();
        let allow_remote = env::var("ALLOW_REMOTE").ok().as_deref() == Some("true");
        let bind_host: IpAddr = env::var("BIND_HOST")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| {
                if allow_remote {
                    "0.0.0.0".parse().unwrap()
                } else {
                    "127.0.0.1".parse().unwrap()
                }
            });
        let token = env::var("LOCAL_API_TOKEN").unwrap_or_else(|_| {
            use rand::RngCore;
            let mut buf = [0u8; 24];
            rand::rng().fill_bytes(&mut buf);
            hex(&buf)
        });
        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        Self {
            bind_host,
            port: env::var("PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(3000),
            allow_remote,
            api_token: token,
            cors_origin: env::var("CORS_ORIGIN").ok(),
            ui_dir: cwd.join("ui"),
            data_path: PathBuf::from(env::var("DATA_PATH").unwrap_or_else(|_| "./data/saves".into())),
            memory_db_path: PathBuf::from(env::var("MEMORY_DB_PATH").unwrap_or_else(|_| "./data/memories.db".into())),
            ui_only,
            preview_enabled: env::var("ENABLE_PREVIEW_GENERATE").ok().as_deref() == Some("true"),
            preview_model_dir: env::var("PIXEL_MODEL_DIR").ok().filter(|s| !s.is_empty()).map(PathBuf::from),
            preview_python: env::var("PREVIEW_PYTHON").ok().filter(|s| !s.is_empty()).map(PathBuf::from),
            preview_script: env::var("PREVIEW_SCRIPT").ok().filter(|s| !s.is_empty()).map(PathBuf::from),
        }
    }

    pub fn is_loopback_bind(&self) -> bool {
        self.bind_host.is_loopback()
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn game_config_from_env() -> GameConfig {
    let mut cfg = GameConfig::default();
    if let Ok(level) = env::var("LOG_LEVEL") {
        cfg.logging.level = match level.as_str() {
            "debug" => LogLevel::Debug,
            "warn" => LogLevel::Warn,
            "error" => LogLevel::Error,
            _ => LogLevel::Info,
        };
        cfg.logging.enabled = matches!(cfg.logging.level, LogLevel::Debug);
    }
    let _ = cfg.logging;
    let _ = LoggingConfig {
        enabled: cfg.logging.enabled,
        level: cfg.logging.level,
    };
    cfg
}

pub fn provider_config_from_env() -> ProviderFactoryConfig {
    let default_provider = match env::var("DEFAULT_PROVIDER").unwrap_or_else(|_| "ollama".into()).as_str() {
        "openai" => ProviderKind::Openai,
        "local" => ProviderKind::Local,
        "lmstudio" => ProviderKind::Lmstudio,
        "jan" => ProviderKind::Jan,
        _ => ProviderKind::Ollama,
    };
    ProviderFactoryConfig {
        default_provider,
        openai: env::var("OPENAI_API_KEY").ok().map(|key| ProviderEndpoint {
            api_key: Some(key),
            base_url: env::var("OPENAI_BASE_URL").ok(),
            default_model: env::var("OPENAI_MODEL").ok(),
            ..Default::default()
        }),
        ollama: Some(ProviderEndpoint {
            host: Some(env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://127.0.0.1:11434".into())),
            default_model: env::var("OLLAMA_MODEL").ok(),
            ..Default::default()
        }),
        local: Some(ProviderEndpoint {
            endpoint: env::var("LOCAL_AI_ENDPOINT").ok(),
            default_model: env::var("LOCAL_AI_MODEL").ok(),
            ..Default::default()
        }),
        lmstudio: Some(ProviderEndpoint {
            endpoint: Some(env::var("LM_STUDIO_ENDPOINT").unwrap_or_else(|_| "http://127.0.0.1:1234/v1".into())),
            default_model: env::var("LM_STUDIO_MODEL").ok(),
            name: Some("LM Studio".into()),
            ..Default::default()
        }),
        jan: Some(ProviderEndpoint {
            endpoint: Some(env::var("JAN_ENDPOINT").unwrap_or_else(|_| "http://127.0.0.1:1337/v1".into())),
            default_model: env::var("JAN_MODEL").ok(),
            name: Some("Jan".into()),
            ..Default::default()
        }),
        agent_overrides: Default::default(),
    }
}
