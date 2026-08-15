use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Openai,
    Ollama,
    Local,
    Lmstudio,
    Jan,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Ollama => "ollama",
            Self::Local => "local",
            Self::Lmstudio => "lmstudio",
            Self::Jan => "jan",
        }
    }

    pub fn url_kind(self) -> crate::security::url::ProviderUrlKind {
        match self {
            Self::Openai => crate::security::url::ProviderUrlKind::Openai,
            _ => crate::security::url::ProviderUrlKind::Local,
        }
    }
}

impl std::fmt::Display for ProviderKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Debug, Clone, Default)]
pub struct ChatOptions {
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub response_format: ResponseFormat,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ResponseFormat {
    #[default]
    Text,
    Json,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderEndpoint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentOverride {
    pub provider_type: ProviderKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderFactoryConfig {
    pub default_provider: ProviderKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub openai: Option<ProviderEndpoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ollama: Option<ProviderEndpoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local: Option<ProviderEndpoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lmstudio: Option<ProviderEndpoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jan: Option<ProviderEndpoint>,
    #[serde(default)]
    pub agent_overrides: std::collections::HashMap<super::AgentRole, AgentOverride>,
}

impl Default for ProviderFactoryConfig {
    fn default() -> Self {
        Self {
            default_provider: ProviderKind::Ollama,
            openai: None,
            ollama: Some(ProviderEndpoint {
                host: Some("http://127.0.0.1:11434".into()),
                default_model: Some("llama3.2".into()),
                ..Default::default()
            }),
            local: None,
            lmstudio: None,
            jan: None,
            agent_overrides: Default::default(),
        }
    }
}
