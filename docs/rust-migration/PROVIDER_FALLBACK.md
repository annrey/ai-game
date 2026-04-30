# Provider 降级策略文档

## 概述

本文档描述 AI 提供者（Provider）的降级机制，当首选 AI 后端不可用时，系统如何自动切换到备用方案。

## 降级层级

```
用户请求
    │
    ▼
┌─────────────┐
│  Ollama    │ ◀── 首选本地后端
│ (qwen2.5)  │
└──────┬──────┘
       │ 连接失败/超时
       ▼
┌─────────────┐
│  Local AI  │ ◀── LM Studio / Jan / llama.cpp
│ (OpenAI    │
│  兼容 API) │
└──────┬──────┘
       │ 连接失败
       ▼
┌─────────────┐
│  离线模式   │ ◀── 本地规则引擎
│  (Rule-   │
│   Based)   │
└─────────────┘
```

## 自动检测机制

### 1. Ollama 检测

```rust
// crates/core/src/providers/provider_factory.rs
async fn check_ollama_availability(base_url: &str) -> bool {
    match reqwest::get(format!("{}/api/tags", base_url)).await {
        Ok(res) if res.status().is_success() => {
            // 检查模型列表
            match res.json::<serde_json::Value>().await {
                Ok(json) => json["models"].as_array()
                    .map(|arr| !arr.is_empty())
                    .unwrap_or(false),
                Err(_) => false,
            }
        }
        _ => false,
    }
}
```

### 2. Local AI 检测

```rust
async fn check_local_ai_availability(endpoint: &str) -> bool {
    match reqwest::get(format!("{}/models", endpoint)).await {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}
```

## 配置格式

### 环境变量

```bash
# 首选后端
default_provider=ollama

# Ollama 配置
ollama_host=http://localhost:11434
ollama_model=qwen2.5:14b

# 备用 Local AI 配置
local_ai_endpoint=http://localhost:1234/v1
local_ai_model=loaded-model-name
```

### 角色独立配置

```bash
# 不同角色可使用不同后端
NARRATOR_PROVIDER=ollama
NARRATOR_MODEL=qwen2.5:14b

WORLD_KEEPER_PROVIDER=local
WORLD_KEEPER_MODEL=qwen2.5:7b
```

## 运行时降级

### EngineFactory 构建流程

```rust
// crates/core/src/engine_factory.rs
pub async fn build(config: EngineFactoryConfig) -> Result<EngineBundle, anyhow::Error> {
    // 1. 尝试构建请求的 provider
    match requested_provider {
        ProviderType::Ollama => {
            if check_ollama_availability().await {
                build_ollama(config).await
            } else {
                // 降级到 Local AI
                build_local_ai(config).await
            }
        }
        ProviderType::Local => {
            if check_local_ai_availability().await {
                build_local_ai(config).await
            } else {
                // 降级到离线模式
                build_offline(config)
            }
        }
    }
}
```

### 运行时自动回退

```rust
// 当 API 调用失败时
match provider.generate_response(messages).await {
    Ok(response) => response,
    Err(e) => {
        tracing::warn!("Provider failed: {}, falling back", e);
        fallback_provider.generate_response(messages).await
            .unwrap_or_else(|_| "说书人暂时无法回应...".to_string())
    }
}
```

## 离线模式

当所有 AI 后端都不可用时，启用基于规则的离线引擎：

```rust
pub struct OfflineNarrator {
    rule_engine: RuleEngine,
    templates: Vec<ResponseTemplate>,
}

impl Narrator for OfflineNarrator {
    async fn process_action(&self, state: &WorldState, input: &str) -> String {
        // 1. 尝试规则匹配
        if let Some(response) = self.rule_engine.match_rules(input, state) {
            return response;
        }
        
        // 2. 使用模板响应
        self.templates
            .choose(&mut rand::thread_rng())
            .map(|t| t.fill(state))
            .unwrap_or_else(|| "世界陷入了沉默...".to_string())
    }
}
```

## API 端点

### 获取可用提供者列表

```bash
GET /api/providers
```

响应：
```json
{
  "providers": [
    {
      "id": "ollama",
      "name": "Ollama",
      "available": true,
      "models": ["qwen2.5:14b", "qwen2.5:7b"]
    },
    {
      "id": "local",
      "name": "Local AI",
      "available": false,
      "models": []
    }
  ],
  "active": "ollama"
}
```

### 获取当前配置

```bash
GET /api/config
```

响应：
```json
{
  "provider": "ollama",
  "backend": "ollama",
  "model": "qwen2.5:14b",
  "available": true
}
```

## 健康检查

```rust
// 服务器启动时执行
pub async fn health_check() -> HealthStatus {
    let mut status = HealthStatus::default();
    
    status.ollama = check_ollama_availability().await;
    status.local_ai = check_local_ai_availability().await;
    status.database = check_database_connection().await;
    
    status
}
```

## 最佳实践

1. **启动时检测**：应用启动时检测所有可用后端
2. **异步降级**：使用 `tokio::time::timeout` 避免阻塞
3. **缓存结果**：健康检查结果缓存 30 秒
4. **用户通知**：降级发生时通过 UI 提示用户

## 故障排除

### Ollama 连接失败

```bash
# 检查 Ollama 服务
curl http://localhost:11434/api/tags

# 检查模型是否存在
ollama list
```

### Local AI 连接失败

```bash
# 测试 LM Studio
curl http://localhost:1234/v1/models

# 测试 Jan
curl http://localhost:1337/v1/models
```

## 相关代码

- `crates/core/src/providers/provider_factory.rs` - 工厂与检测逻辑
- `crates/core/src/providers/ollama.rs` - Ollama 实现
- `crates/core/src/providers/openai.rs` - Local AI 实现
- `apps/server/src/main.rs:197` - API 端点
