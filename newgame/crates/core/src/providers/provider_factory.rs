use crate::agents::AIProvider;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use super::{EchoProvider, OllamaProvider, OpenAIProvider};

/// 单个 Provider 的配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleProviderConfig {
    pub enabled: bool,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

impl Default for SingleProviderConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: None,
            api_key: None,
            model: None,
        }
    }
}

/// 角色级别的 Provider 覆盖配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleOverrideConfig {
    pub provider: String,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

/// 全局 Provider 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub default_provider: String,
    pub ollama: SingleProviderConfig,
    pub openai: SingleProviderConfig,
    pub local: SingleProviderConfig,
    pub lmstudio: SingleProviderConfig,
    pub jan: SingleProviderConfig,
    #[serde(default)]
    pub agent_overrides: HashMap<String, RoleOverrideConfig>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            default_provider: "ollama".to_string(),
            ollama: SingleProviderConfig {
                enabled: true,
                base_url: Some("http://localhost:11434".to_string()),
                api_key: None,
                model: Some("llama3.1".to_string()),
            },
            openai: SingleProviderConfig::default(),
            local: SingleProviderConfig {
                enabled: true,
                base_url: Some("http://localhost:1234/v1".to_string()),
                api_key: None,
                model: Some("local-model".to_string()),
            },
            lmstudio: SingleProviderConfig {
                enabled: true,
                base_url: Some("http://localhost:1234/v1".to_string()),
                api_key: None,
                model: Some("lmstudio-model".to_string()),
            },
            jan: SingleProviderConfig {
                enabled: true,
                base_url: Some("http://localhost:1337/v1".to_string()),
                api_key: None,
                model: Some("jan-model".to_string()),
            },
            agent_overrides: HashMap::new(),
        }
    }
}

impl ProviderConfig {
    /// 从环境变量构建配置
    ///
    /// 支持的环境变量：
    /// - AI_DEFAULT_PROVIDER    默认 Provider 名称
    /// - AI_OLLAMA_URL          Ollama base URL
    /// - AI_OLLAMA_MODEL        Ollama 默认模型
    /// - AI_OPENAI_KEY          OpenAI API Key
    /// - AI_OPENAI_MODEL        OpenAI 默认模型
    /// - AI_OPENAI_URL          OpenAI base URL（可选，用于自定义端点）
    /// - AI_LOCAL_URL           LocalProvider base URL
    /// - AI_LOCAL_MODEL         LocalProvider 默认模型
    /// - AI_LMSTUDIO_URL        LMStudio base URL
    /// - AI_LMSTUDIO_MODEL      LMStudio 默认模型
    /// - AI_JAN_URL             Jan base URL
    /// - AI_JAN_MODEL           Jan 默认模型
    pub fn from_env() -> Self {
        use std::env;

        let mut config = ProviderConfig::default();

        if let Ok(v) = env::var("AI_DEFAULT_PROVIDER") {
            config.default_provider = v;
        }

        // Ollama
        if let Ok(v) = env::var("AI_OLLAMA_URL") {
            config.ollama.base_url = Some(v);
            config.ollama.enabled = true;
        }
        if let Ok(v) = env::var("AI_OLLAMA_MODEL") {
            config.ollama.model = Some(v);
            config.ollama.enabled = true;
        }

        // OpenAI
        if let Ok(v) = env::var("AI_OPENAI_KEY") {
            config.openai.api_key = Some(v);
            config.openai.enabled = true;
        }
        if let Ok(v) = env::var("AI_OPENAI_MODEL") {
            config.openai.model = Some(v);
            config.openai.enabled = true;
        }
        if let Ok(v) = env::var("AI_OPENAI_URL") {
            config.openai.base_url = Some(v);
        }

        // Local (通用本地 AI，兼容 OpenAI 风格 API)
        if let Ok(v) = env::var("AI_LOCAL_URL") {
            config.local.base_url = Some(v);
            config.local.enabled = true;
        }
        if let Ok(v) = env::var("AI_LOCAL_MODEL") {
            config.local.model = Some(v);
            config.local.enabled = true;
        }

        // LMStudio
        if let Ok(v) = env::var("AI_LMSTUDIO_URL") {
            config.lmstudio.base_url = Some(v);
            config.lmstudio.enabled = true;
        }
        if let Ok(v) = env::var("AI_LMSTUDIO_MODEL") {
            config.lmstudio.model = Some(v);
            config.lmstudio.enabled = true;
        }

        // Jan
        if let Ok(v) = env::var("AI_JAN_URL") {
            config.jan.base_url = Some(v);
            config.jan.enabled = true;
        }
        if let Ok(v) = env::var("AI_JAN_MODEL") {
            config.jan.model = Some(v);
            config.jan.enabled = true;
        }

        config
    }
}

/// Provider 可用性检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAvailability {
    pub name: String,
    pub available: bool,
    pub models: Vec<String>,
    pub error: Option<String>,
}

/// 通用本地 AI Provider（兼容 OpenAI 风格 API）
pub struct LocalProvider {
    inner: OpenAIProvider,
}

impl LocalProvider {
    pub fn new(base_url: String, model: String, api_key: Option<String>) -> Self {
        let key = api_key.unwrap_or_else(|| "not-needed".to_string());
        Self {
            inner: OpenAIProvider::new(key, model, Some(base_url)),
        }
    }
}

#[async_trait::async_trait]
impl AIProvider for LocalProvider {
    async fn generate_response(
        &self,
        messages: &[crate::agents::Message],
        temperature: f32,
    ) -> Result<String> {
        self.inner.generate_response(messages, temperature).await
    }
}

/// Provider 工厂，负责根据配置创建对应的 Provider 实例
#[derive(Clone)]
pub struct ProviderFactory {
    config: ProviderConfig,
}

impl ProviderFactory {
    pub fn new(config: ProviderConfig) -> Self {
        Self { config }
    }

    /// 从环境变量创建工厂
    pub fn from_env() -> Self {
        Self::new(ProviderConfig::from_env())
    }

    /// 获取默认 Provider 名称
    pub fn default_provider_name(&self) -> &str {
        &self.config.default_provider
    }

    /// 创建指定名称的 Provider
    pub fn create_provider(&self, name: &str) -> Result<Arc<dyn AIProvider>> {
        match name.to_lowercase().as_str() {
            "ollama" => self.create_ollama(),
            "openai" => self.create_openai(),
            "local" => self.create_local(),
            "lmstudio" => self.create_lmstudio(),
            "jan" => self.create_jan(),
            _ => Err(anyhow!("Unknown provider: {}", name)),
        }
    }

    /// 创建默认 Provider
    pub fn create_default(&self) -> Result<Arc<dyn AIProvider>> {
        self.create_provider(&self.config.default_provider)
    }

    /// 按角色获取 Provider，优先使用 agent_overrides 中的配置
    pub fn get_for_role(&self, role: &str) -> Result<Arc<dyn AIProvider>> {
        if let Some(override_config) = self.config.agent_overrides.get(role) {
            let provider_name = override_config.provider.to_lowercase();
            match provider_name.as_str() {
                "ollama" => {
                    let model = override_config
                        .model
                        .clone()
                        .or_else(|| self.config.ollama.model.clone())
                        .unwrap_or_else(|| "llama3.1".to_string());
                    let base_url = override_config
                        .base_url
                        .clone()
                        .or_else(|| self.config.ollama.base_url.clone())
                        .unwrap_or_else(|| "http://localhost:11434".to_string());
                    Ok(Arc::new(OllamaProvider::new(model, Some(base_url))))
                }
                "openai" => {
                    let api_key = override_config
                        .api_key
                        .clone()
                        .or_else(|| self.config.openai.api_key.clone())
                        .ok_or_else(|| anyhow!("OpenAI API key not configured"))?;
                    let model = override_config
                        .model
                        .clone()
                        .or_else(|| self.config.openai.model.clone())
                        .unwrap_or_else(|| "gpt-4o".to_string());
                    let base_url = override_config
                        .base_url
                        .clone()
                        .or_else(|| self.config.openai.base_url.clone());
                    Ok(Arc::new(OpenAIProvider::new(api_key, model, base_url)))
                }
                "local" => {
                    let model = override_config
                        .model
                        .clone()
                        .or_else(|| self.config.local.model.clone())
                        .unwrap_or_else(|| "local-model".to_string());
                    let base_url = override_config
                        .base_url
                        .clone()
                        .or_else(|| self.config.local.base_url.clone())
                        .unwrap_or_else(|| "http://localhost:1234/v1".to_string());
                    let api_key = override_config
                        .api_key
                        .clone()
                        .or_else(|| self.config.local.api_key.clone());
                    Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
                }
                "lmstudio" => {
                    let model = override_config
                        .model
                        .clone()
                        .or_else(|| self.config.lmstudio.model.clone())
                        .unwrap_or_else(|| "lmstudio-model".to_string());
                    let base_url = override_config
                        .base_url
                        .clone()
                        .or_else(|| self.config.lmstudio.base_url.clone())
                        .unwrap_or_else(|| "http://localhost:1234/v1".to_string());
                    let api_key = override_config
                        .api_key
                        .clone()
                        .or_else(|| self.config.lmstudio.api_key.clone());
                    Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
                }
                "jan" => {
                    let model = override_config
                        .model
                        .clone()
                        .or_else(|| self.config.jan.model.clone())
                        .unwrap_or_else(|| "jan-model".to_string());
                    let base_url = override_config
                        .base_url
                        .clone()
                        .or_else(|| self.config.jan.base_url.clone())
                        .unwrap_or_else(|| "http://localhost:1337/v1".to_string());
                    let api_key = override_config
                        .api_key
                        .clone()
                        .or_else(|| self.config.jan.api_key.clone());
                    Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
                }
                _ => Err(anyhow!(
                    "Unknown provider in agent override: {}",
                    override_config.provider
                )),
            }
        } else {
            self.create_default()
        }
    }

    fn create_ollama(&self) -> Result<Arc<dyn AIProvider>> {
        if !self.config.ollama.enabled {
            return Err(anyhow!("Ollama provider is not enabled"));
        }
        let model = self
            .config
            .ollama
            .model
            .clone()
            .unwrap_or_else(|| "llama3.1".to_string());
        let base_url = self.config.ollama.base_url.clone();
        Ok(Arc::new(OllamaProvider::new(model, base_url)))
    }

    fn create_openai(&self) -> Result<Arc<dyn AIProvider>> {
        if !self.config.openai.enabled {
            return Err(anyhow!("OpenAI provider is not enabled"));
        }
        let api_key = self
            .config
            .openai
            .api_key
            .clone()
            .ok_or_else(|| anyhow!("OpenAI API key not configured"))?;
        let model = self
            .config
            .openai
            .model
            .clone()
            .unwrap_or_else(|| "gpt-4o".to_string());
        let base_url = self.config.openai.base_url.clone();
        Ok(Arc::new(OpenAIProvider::new(api_key, model, base_url)))
    }

    fn create_local(&self) -> Result<Arc<dyn AIProvider>> {
        if !self.config.local.enabled {
            return Err(anyhow!("Local provider is not enabled"));
        }
        let model = self
            .config
            .local
            .model
            .clone()
            .unwrap_or_else(|| "local-model".to_string());
        let base_url = self
            .config
            .local
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1234/v1".to_string());
        let api_key = self.config.local.api_key.clone();
        Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
    }

    fn create_lmstudio(&self) -> Result<Arc<dyn AIProvider>> {
        if !self.config.lmstudio.enabled {
            return Err(anyhow!("LMStudio provider is not enabled"));
        }
        let model = self
            .config
            .lmstudio
            .model
            .clone()
            .unwrap_or_else(|| "lmstudio-model".to_string());
        let base_url = self
            .config
            .lmstudio
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1234/v1".to_string());
        let api_key = self.config.lmstudio.api_key.clone();
        Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
    }

    fn create_jan(&self) -> Result<Arc<dyn AIProvider>> {
        if !self.config.jan.enabled {
            return Err(anyhow!("Jan provider is not enabled"));
        }
        let model = self
            .config
            .jan
            .model
            .clone()
            .unwrap_or_else(|| "jan-model".to_string());
        let base_url = self
            .config
            .jan
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1337/v1".to_string());
        let api_key = self.config.jan.api_key.clone();
        Ok(Arc::new(LocalProvider::new(base_url, model, api_key)))
    }

    /// 检测各 Provider 的可用性
    pub async fn check_availability(&self) -> Vec<ProviderAvailability> {
        let mut results = Vec::new();

        // Ollama
        results.push(self.check_ollama().await);

        // OpenAI
        results.push(self.check_openai().await);

        // Local
        results.push(self.check_local().await);

        // LMStudio
        results.push(self.check_lmstudio().await);

        // Jan
        results.push(self.check_jan().await);

        results
    }

    async fn check_ollama(&self) -> ProviderAvailability {
        let name = "ollama".to_string();
        if !self.config.ollama.enabled {
            return ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some("Not enabled".to_string()),
            };
        }

        let base_url = self
            .config
            .ollama
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:11434".to_string());

        match reqwest::get(format!("{}/api/tags", base_url)).await {
            Ok(res) => {
                if res.status().is_success() {
                    match res.json::<serde_json::Value>().await {
                        Ok(json) => {
                            let models: Vec<String> = json["models"]
                                .as_array()
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                                .unwrap_or_default();
                            ProviderAvailability {
                                name,
                                available: !models.is_empty(),
                                models,
                                error: None,
                            }
                        }
                        Err(e) => ProviderAvailability {
                            name,
                            available: false,
                            models: vec![],
                            error: Some(format!("Failed to parse response: {}", e)),
                        },
                    }
                } else {
                    ProviderAvailability {
                        name,
                        available: false,
                        models: vec![],
                        error: Some(format!("HTTP {}", res.status())),
                    }
                }
            }
            Err(e) => ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some(format!("Connection failed: {}", e)),
            },
        }
    }

    async fn check_openai(&self) -> ProviderAvailability {
        let name = "openai".to_string();
        if !self.config.openai.enabled {
            return ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some("Not enabled".to_string()),
            };
        }

        let api_key = match &self.config.openai.api_key {
            Some(k) => k,
            None => {
                return ProviderAvailability {
                    name,
                    available: false,
                    models: vec![],
                    error: Some("API key not configured".to_string()),
                }
            }
        };

        let base_url = self
            .config
            .openai
            .base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

        let client = reqwest::Client::new();
        match client
            .get(format!("{}/models", base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    match res.json::<serde_json::Value>().await {
                        Ok(json) => {
                            let models: Vec<String> = json["data"]
                                .as_array()
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                                .unwrap_or_default();
                            ProviderAvailability {
                                name,
                                available: !models.is_empty(),
                                models,
                                error: None,
                            }
                        }
                        Err(e) => ProviderAvailability {
                            name,
                            available: false,
                            models: vec![],
                            error: Some(format!("Failed to parse response: {}", e)),
                        },
                    }
                } else {
                    ProviderAvailability {
                        name,
                        available: false,
                        models: vec![],
                        error: Some(format!("HTTP {}", res.status())),
                    }
                }
            }
            Err(e) => ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some(format!("Connection failed: {}", e)),
            },
        }
    }

    async fn check_local(&self) -> ProviderAvailability {
        let name = "local".to_string();
        if !self.config.local.enabled {
            return ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some("Not enabled".to_string()),
            };
        }

        let base_url = self
            .config
            .local
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1234/v1".to_string());

        self.check_openai_compatible(&name, &base_url).await
    }

    async fn check_lmstudio(&self) -> ProviderAvailability {
        let name = "lmstudio".to_string();
        if !self.config.lmstudio.enabled {
            return ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some("Not enabled".to_string()),
            };
        }

        let base_url = self
            .config
            .lmstudio
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1234/v1".to_string());

        self.check_openai_compatible(&name, &base_url).await
    }

    async fn check_jan(&self) -> ProviderAvailability {
        let name = "jan".to_string();
        if !self.config.jan.enabled {
            return ProviderAvailability {
                name,
                available: false,
                models: vec![],
                error: Some("Not enabled".to_string()),
            };
        }

        let base_url = self
            .config
            .jan
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1337/v1".to_string());

        self.check_openai_compatible(&name, &base_url).await
    }

    /// 通用 OpenAI 兼容 API 可用性检测
    async fn check_openai_compatible(
        &self,
        name: &str,
        base_url: &str,
    ) -> ProviderAvailability {
        let client = reqwest::Client::new();
        match client
            .get(format!("{}/models", base_url))
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    match res.json::<serde_json::Value>().await {
                        Ok(json) => {
                            let models: Vec<String> = json["data"]
                                .as_array()
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                                .unwrap_or_default();
                            ProviderAvailability {
                                name: name.to_string(),
                                available: !models.is_empty(),
                                models,
                                error: None,
                            }
                        }
                        Err(e) => ProviderAvailability {
                            name: name.to_string(),
                            available: false,
                            models: vec![],
                            error: Some(format!("Failed to parse response: {}", e)),
                        },
                    }
                } else {
                    ProviderAvailability {
                        name: name.to_string(),
                        available: false,
                        models: vec![],
                        error: Some(format!("HTTP {}", res.status())),
                    }
                }
            }
            Err(e) => ProviderAvailability {
                name: name.to_string(),
                available: false,
                models: vec![],
                error: Some(format!("Connection failed: {}", e)),
            },
        }
    }

    /// 返回各 Provider 的可用模型列表
    pub async fn list_models(&self) -> HashMap<String, Vec<String>> {
        let availability = self.check_availability().await;
        let mut models = HashMap::new();
        for item in availability {
            if item.available {
                models.insert(item.name, item.models);
            }
        }
        models
    }

    /// 先 ping Ollama，不通则降级到 EchoProvider
    pub async fn build_with_fallback(&self) -> Result<Arc<dyn AIProvider>> {
        let ollama_url = self
            .config
            .ollama
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:11434".to_string());

        match reqwest::get(format!("{}/api/tags", ollama_url)).await {
            Ok(res) if res.status().is_success() => self.create_default(),
            _ => {
                eprintln!(
                    "[ProviderFactory] Ollama unavailable at {}, falling back to EchoProvider",
                    ollama_url
                );
                Ok(Arc::new(EchoProvider::new()))
            }
        }
    }
}
