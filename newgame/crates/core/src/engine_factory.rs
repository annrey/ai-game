use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePoolOptions;

use memory::in_memory::InMemoryStore;
use memory::sqlite::SqliteMemoryStore;
use memory::store::MemoryStore;

use crate::agents::guide::GuideAgent;
use crate::agents::narrator::NarratorAgent;
use crate::agents::{AIProvider, AgentManager};
use crate::engine::GameEngine;
use crate::engine_handle::EngineHandle;
use crate::event_bus::EventBus;
use crate::providers::provider_factory::ProviderConfig;
use crate::providers::{EchoProvider, ProviderFactory};
use crate::rules::{self, RuleEngine};
use crate::state_store::StateStore;

/// 实际生效的后端类型，让上层 UI 显示真实状态
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum BackendKind {
    Ollama,
    OpenAI,
    Local,
    LmStudio,
    Jan,
    Echo,
}

impl BackendKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            BackendKind::Ollama => "ollama",
            BackendKind::OpenAI => "openai",
            BackendKind::Local => "local",
            BackendKind::LmStudio => "lmstudio",
            BackendKind::Jan => "jan",
            BackendKind::Echo => "echo",
        }
    }

    pub fn is_fallback(&self) -> bool {
        matches!(self, BackendKind::Echo)
    }

    fn from_provider_name(name: &str) -> Self {
        match name.to_lowercase().as_str() {
            "ollama" => BackendKind::Ollama,
            "openai" => BackendKind::OpenAI,
            "local" => BackendKind::Local,
            "lmstudio" => BackendKind::LmStudio,
            "jan" => BackendKind::Jan,
            _ => BackendKind::Echo,
        }
    }
}

/// 引擎工厂配置：被 Bevy / Tauri / Server / FFI 共用
#[derive(Clone)]
pub struct EngineFactoryConfig {
    /// 存档目录
    pub save_dir: PathBuf,
    /// SQLite 记忆数据库 URL；为 None 时使用内存记忆
    pub memory_db_url: Option<String>,
    /// Provider 配置；为 None 时从环境变量读取
    pub provider_config: Option<ProviderConfig>,
    /// EventBus 容量
    pub event_bus_capacity: usize,
    /// 是否注册默认规则集
    pub register_default_rules: bool,
}

impl Default for EngineFactoryConfig {
    fn default() -> Self {
        Self {
            save_dir: PathBuf::from("./saves"),
            memory_db_url: None,
            provider_config: None,
            event_bus_capacity: 1024,
            register_default_rules: true,
        }
    }
}

/// 引擎工厂构造结果
pub struct EngineBundle {
    pub handle: EngineHandle,
    pub backend: BackendKind,
}

/// 统一的引擎构造入口：Bevy / Tauri / Server / FFI 都通过它获取 EngineHandle
pub struct EngineFactory;

impl EngineFactory {
    /// 构造引擎：完成 provider 选择（带兜底）、记忆后端、规则注册、agent 注册一站式
    pub async fn build(cfg: EngineFactoryConfig) -> Result<EngineBundle> {
        let provider_cfg = cfg
            .provider_config
            .clone()
            .unwrap_or_else(ProviderConfig::from_env);
        let factory = ProviderFactory::new(provider_cfg);

        // Provider with fallback + backend identification
        let (provider, backend) = Self::build_provider(&factory).await;

        // Memory store
        let memory_store: Arc<dyn MemoryStore> = match &cfg.memory_db_url {
            Some(url) => {
                let pool = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(url)
                    .await?;
                let store = SqliteMemoryStore::new(pool);
                store.init().await?;
                Arc::new(store) as Arc<dyn MemoryStore>
            }
            None => Arc::new(InMemoryStore::default()),
        };

        // State store
        let state_store = StateStore::new(cfg.save_dir);

        // Rules
        let mut rule_engine = RuleEngine::new();
        if cfg.register_default_rules {
            rule_engine.register_rule(Box::new(rules::movement::MovementRule));
            rule_engine.register_rule(Box::new(rules::economy::EconomyRule));
            rule_engine.register_rule(Box::new(rules::relationship::RelationshipRule));
            rule_engine.register_rule(Box::new(rules::schedule::ScheduleRule));
            rule_engine.register_rule(Box::new(rules::quest::QuestRule));
            rule_engine.register_rule(Box::new(rules::item::ItemRule));
        }

        // Agents
        let mut agent_manager = AgentManager::new();
        let guide_agent = Arc::new(GuideAgent::new(provider.clone()));
        agent_manager.register("guide", guide_agent);
        let agent_manager_arc = Arc::new(agent_manager);
        let narrator = NarratorAgent::new(provider, Arc::clone(&agent_manager_arc));

        // EventBus
        let event_bus = EventBus::new(cfg.event_bus_capacity);

        // 从 Arc 取出 agent_manager 传给 GameEngine（GameEngine 会重新包 Arc）
        let agent_manager_for_engine = Arc::try_unwrap(agent_manager_arc)
            .unwrap_or_else(|arc| (*arc).clone());
        let engine = GameEngine::new(event_bus, state_store, rule_engine, narrator, memory_store, agent_manager_for_engine);

        Ok(EngineBundle {
            handle: EngineHandle::new(engine),
            backend,
        })
    }

    /// 默认配置（save_dir = ./saves，记忆使用内存，provider 走环境变量）
    pub async fn build_default() -> Result<EngineBundle> {
        Self::build(EngineFactoryConfig::default()).await
    }

    /// 选择并验证 Provider，失败时回退到 Echo
    async fn build_provider(
        factory: &ProviderFactory,
    ) -> (Arc<dyn AIProvider>, BackendKind) {
        let default_name = factory.default_provider_name().to_lowercase();
        let intended = BackendKind::from_provider_name(&default_name);

        // 探活
        let availability = factory.check_availability().await;
        let primary_ok = availability
            .iter()
            .find(|a| a.name.eq_ignore_ascii_case(&default_name))
            .map(|a| a.available)
            .unwrap_or(false);

        if primary_ok {
            if let Ok(p) = factory.create_default() {
                return (p, intended);
            }
        }

        eprintln!(
            "[EngineFactory] Primary provider '{}' unavailable, falling back to EchoProvider",
            default_name
        );
        (Arc::new(EchoProvider::new()), BackendKind::Echo)
    }
}
