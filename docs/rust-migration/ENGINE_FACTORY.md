# Engine Factory 文档

## 概述

Engine Factory 是游戏引擎的统一构建入口，提供依赖注入、后端选择和初始化管理功能。

## 设计模式

```
┌──────────────────────────────────────────────────────────┐
│                    EngineFactory                          │
│                    (工厂模式)                               │
└─────────────────────┬──────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Ollama  │   │  Local  │   │ Offline │
   │Provider │   │Provider │   │Provider │
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
              ┌──────────────┐
              │  GameEngine  │
              │  ┌────────┐  │
              │  │StateStore│ │
              │  └────────┘  │
              │  ┌────────┐  │
              │  │ EventBus │ │
              │  └────────┘  │
              └──────────────┘
```

## 核心结构

### EngineFactoryConfig

```rust
pub struct EngineFactoryConfig {
    pub save_dir: PathBuf,              // 存档目录
    pub memory_db_url: String,          // 数据库 URL
    pub provider_config: Option<ProviderConfig>, // 提供者配置
    pub event_bus_capacity: usize,      // 事件总线容量
    pub register_default_rules: bool,   // 是否注册默认规则
}
```

### EngineBundle

```rust
pub struct EngineBundle {
    pub handle: EngineHandle,           // 引擎句柄（暴露给上层）
    pub backend: BackendKind,           // 实际使用的后端类型
}
```

### BackendKind

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum BackendKind {
    Ollama,
    LocalAi,
    Offline,  // 离线模式
}
```

## 构建流程

### 1. 标准构建

```rust
use game_core::engine_factory::{EngineFactory, EngineFactoryConfig};

let bundle = EngineFactory::build(EngineFactoryConfig {
    save_dir: PathBuf::from("./saves"),
    memory_db_url: "sqlite://./data.db".to_string(),
    provider_config: None,  // 使用默认配置
    event_bus_capacity: 256,
    register_default_rules: true,
}).await?;

let EngineBundle { handle, backend } = bundle;
handle.start().await;
```

### 2. 默认构建（离线模式）

```rust
// 当没有 AI 后端可用时使用
let bundle = EngineFactory::build_default().await?;
```

### 3. 后端选择逻辑

```rust
pub async fn build(config: EngineFactoryConfig) -> Result<EngineBundle> {
    // 1. 根据配置确定首选后端
    let preferred = config.provider_config
        .as_ref()
        .map(|c| c.provider_type)
        .unwrap_or(ProviderType::Ollama);
    
    // 2. 检查可用性并尝试构建
    match preferred {
        ProviderType::Ollama => {
            if ProviderFactory::check_ollama().await {
                Self::build_ollama(config).await
            } else if ProviderFactory::check_local_ai().await {
                // 降级到 Local AI
                Self::build_local(config).await
            } else {
                // 降级到离线模式
                Self::build_offline(config)
            }
        }
        // ...
    }
}
```

## 依赖注入

### StateStore 注入

```rust
async fn build_ollama(config: EngineFactoryConfig) -> Result<EngineBundle> {
    // 创建 StateStore
    let state_store = StateStore::new(&config.save_dir);
    
    // 初始化数据库（可选）
    if let Ok(pool) = create_db_pool(&config.memory_db_url).await {
        let state_store = StateStore::new_with_db(&config.save_dir, pool);
        state_store.init().await?;
    }
    
    // 创建 EventBus
    let event_bus = EventBus::new(config.event_bus_capacity);
    
    // 创建 Narrator
    let narrator = Box::new(OllamaNarrator::new(...));
    
    // 组装引擎
    let engine = GameEngine::new(
        state_store.clone(),
        event_bus.clone(),
        narrator,
        // ... 其他依赖
    );
    
    Ok(EngineBundle {
        handle: EngineHandle::new(engine),
        backend: BackendKind::Ollama,
    })
}
```

### AgentManager 注入

```rust
// 创建 AgentManager 并注册默认代理
let agent_manager = AgentManager::new();

if config.register_default_rules {
    agent_manager.register_agent(AgentRole::Narrator, default_narrator());
    agent_manager.register_agent(AgentRole::WorldKeeper, default_world_keeper());
    agent_manager.register_agent(AgentRole::RuleArbiter, default_rule_arbiter());
}

// 注入到引擎
let engine = GameEngine::with_agents(
    state_store,
    event_bus,
    narrator,
    agent_manager,  // 注入
)?;
```

## 配置热重载

### 更新提供者配置

```rust
// apps/server/src/main.rs:221
async fn update_provider(
    State(state): State<AppState>,
    Json(config): Json<ProviderUpdate>,
) -> Result<Json<ProviderStatus>> {
    // 1. 验证新配置
    if !ProviderFactory::check_availability(config.provider_type).await {
        return Err(Error::ProviderUnavailable);
    }
    
    // 2. 构建新引擎
    let new_bundle = EngineFactory::build(EngineFactoryConfig {
        provider_config: Some(config.clone()),
        ..state.factory_config
    }).await?;
    
    // 3. 原子切换
    let mut engine = state.engine.write().await;
    *engine = new_bundle.handle;
    
    Ok(Json(ProviderStatus::Active(config.provider_type)))
}
```

## 错误处理

### 构建错误类型

```rust
#[derive(Debug, thiserror::Error)]
pub enum EngineBuildError {
    #[error("Provider unavailable: {0}")]
    ProviderUnavailable(String),
    
    #[error("Database initialization failed: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    
    #[error("All providers failed")]
    AllProvidersFailed,
}
```

### 降级策略

```rust
async fn build_with_fallback(config: EngineFactoryConfig) -> Result<EngineBundle> {
    let errors = Vec::new();
    
    // 尝试 Ollama
    match Self::build_ollama(config.clone()).await {
        Ok(bundle) => return Ok(bundle),
        Err(e) => errors.push(("ollama", e)),
    }
    
    // 尝试 Local AI
    match Self::build_local(config.clone()).await {
        Ok(bundle) => return Ok(bundle),
        Err(e) => errors.push(("local", e)),
    }
    
    // 离线模式（永不失败）
    tracing::warn!("All AI providers failed, using offline mode");
    Self::build_offline(config)
}
```

## 性能优化

### 延迟初始化

```rust
impl EngineHandle {
    // 使用 OnceCell 确保只启动一次
    pub async fn start(&self) {
        if self.started.get().is_some() {
            return;
        }
        let _ = self.started.set(());
        // ... 启动事件循环
    }
}
```

### 资源复用

```rust
// 数据库连接池复用
static DB_POOL: OnceCell<SqlitePool> = OnceCell::const_new();

async fn get_db_pool(url: &str) -> &SqlitePool {
    DB_POOL.get_or_init(|| async {
        create_db_pool(url).await.expect("DB init failed")
    }).await
}
```

## 测试

### 构建测试引擎

```rust
#[cfg(test)]
async fn build_test_engine() -> EngineBundle {
    EngineFactory::build(EngineFactoryConfig {
        save_dir: PathBuf::from("/tmp/test_saves"),
        memory_db_url: "sqlite::memory:".to_string(),
        provider_config: Some(ProviderConfig::offline()),
        event_bus_capacity: 16,
        register_default_rules: false,
    }).await.unwrap()
}

#[tokio::test]
async fn test_engine_build() {
    let bundle = build_test_engine().await;
    assert_eq!(bundle.backend, BackendKind::Offline);
}
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `crates/core/src/engine_factory.rs` | 工厂实现 |
| `crates/core/src/engine.rs` | 引擎核心 |
| `crates/core/src/engine_handle.rs` | 引擎句柄 |
| `crates/core/src/providers/provider_factory.rs` | 提供者工厂 |
| `apps/server/src/main.rs` | HTTP 服务与配置 API |

## 最佳实践

1. **配置验证**：构建前验证所有外部依赖可用性
2. **快速失败**：配置错误立即返回，不尝试修复
3. **优雅降级**：AI 后端失败时自动切换到离线模式
4. **资源隔离**：测试使用独立数据库和目录
