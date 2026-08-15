use std::time::Duration;

use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::types::{
    ChatMessage, ChatOptions, ChatResponse, ChatRole, ModelInfo, ProviderEndpoint, ProviderFactoryConfig, ProviderKind,
    ResponseFormat,
};

#[derive(Clone)]
pub struct HttpProvider {
    kind: ProviderKind,
    name: String,
    endpoint: String,
    api_key: Option<String>,
    default_model: String,
    client: reqwest::Client,
}

impl HttpProvider {
    pub fn new(
        kind: ProviderKind,
        name: impl Into<String>,
        endpoint: impl Into<String>,
        api_key: Option<String>,
        default_model: impl Into<String>,
    ) -> Self {
        Self {
            kind,
            name: name.into(),
            endpoint: endpoint.into().trim_end_matches('/').to_string(),
            api_key,
            default_model: default_model.into(),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(180))
                .build()
                .expect("reqwest client"),
        }
    }

    fn chat_url(&self) -> String {
        if self.kind == ProviderKind::Ollama && !self.endpoint.contains("/v1") {
            format!("{}/v1/chat/completions", self.endpoint)
        } else {
            format!("{}/chat/completions", self.endpoint)
        }
    }

    fn models_url(&self) -> String {
        if self.kind == ProviderKind::Ollama && !self.endpoint.contains("/v1") {
            format!("{}/api/tags", self.endpoint)
        } else {
            format!("{}/models", self.endpoint)
        }
    }

    pub fn kind(&self) -> ProviderKind {
        self.kind
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub async fn chat(&self, messages: &[ChatMessage], options: &ChatOptions) -> AppResult<ChatResponse> {
        let mut last = AppError::Provider("chat failed".into());
        for attempt in 0..3 {
            match self.chat_once(messages, options).await {
                Ok(resp) => return Ok(resp),
                Err(err) if attempt < 2 && retryable(&err) => {
                    tracing::warn!("provider {} retry {}: {err}", self.name, attempt + 1);
                    tokio::time::sleep(Duration::from_millis(250 * 2u64.pow(attempt))).await;
                    last = err;
                }
                Err(err) => return Err(err),
            }
        }
        Err(last)
    }

    async fn chat_once(&self, messages: &[ChatMessage], options: &ChatOptions) -> AppResult<ChatResponse> {
        let model = options.model.clone().unwrap_or_else(|| self.default_model.clone());
        let msgs: Vec<Value> = messages
            .iter()
            .map(|m| {
                json!({
                    "role": match m.role {
                        ChatRole::System => "system",
                        ChatRole::User => "user",
                        ChatRole::Assistant => "assistant",
                    },
                    "content": m.content,
                })
            })
            .collect();
        let mut body = json!({
            "model": model,
            "messages": msgs,
            "temperature": options.temperature.unwrap_or(0.7),
        });
        if matches!(options.response_format, ResponseFormat::Json) {
            body["response_format"] = json!({ "type": "json_object" });
        }
        if let Some(max) = options.max_tokens {
            body["max_tokens"] = json!(max);
        }
        let mut req = self.client.post(self.chat_url()).json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }
        let res = req.send().await.map_err(|e| AppError::Provider(e.to_string()))?;
        if !res.status().is_success() {
            return Err(AppError::Provider(format!("http {}", res.status())));
        }
        let data: Value = res.json().await.map_err(|e| AppError::Provider(e.to_string()))?;
        let content = data
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .or_else(|| data.get("response").and_then(Value::as_str))
            .or_else(|| data.get("content").and_then(Value::as_str))
            .unwrap_or("")
            .to_string();
        Ok(ChatResponse {
            content,
            model: data.get("model").and_then(Value::as_str).unwrap_or(&model).to_string(),
        })
    }

    pub async fn chat_stream<F>(&self, messages: &[ChatMessage], options: &ChatOptions, mut on_chunk: F) -> AppResult<ChatResponse>
    where
        F: FnMut(&str),
    {
        use futures_util::StreamExt;

        let model = options.model.clone().unwrap_or_else(|| self.default_model.clone());
        let msgs: Vec<Value> = messages
            .iter()
            .map(|m| {
                json!({
                    "role": match m.role {
                        ChatRole::System => "system",
                        ChatRole::User => "user",
                        ChatRole::Assistant => "assistant",
                    },
                    "content": m.content,
                })
            })
            .collect();
        let body = json!({
            "model": model,
            "messages": msgs,
            "temperature": options.temperature.unwrap_or(0.8),
            "stream": true,
        });
        let mut req = self.client.post(self.chat_url()).json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }
        let res = req.send().await.map_err(|e| AppError::Provider(e.to_string()))?;
        if !res.status().is_success() {
            return Err(AppError::Provider(format!("http {}", res.status())));
        }
        let mut stream = res.bytes_stream();
        let mut buf = String::new();
        let mut full = String::new();
        while let Some(part) = stream.next().await {
            let chunk = part.map_err(|e| AppError::Provider(e.to_string()))?;
            buf.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(idx) = buf.find('\n') {
                let line = buf[..idx].trim().to_string();
                buf = buf[idx + 1..].to_string();
                let Some(data) = line.strip_prefix("data:") else { continue };
                let data = data.trim();
                if data.is_empty() || data == "[DONE]" {
                    continue;
                }
                if let Ok(v) = serde_json::from_str::<Value>(data) {
                    if let Some(delta) = v.pointer("/choices/0/delta/content").and_then(Value::as_str) {
                        if !delta.is_empty() {
                            full.push_str(delta);
                            on_chunk(delta);
                        }
                    }
                }
            }
        }
        if full.is_empty() {
            return self.chat(messages, options).await;
        }
        Ok(ChatResponse { content: full, model })
    }

    pub async fn list_models(&self) -> AppResult<Vec<ModelInfo>> {
        let res = self.client.get(self.models_url()).send().await;
        let Ok(res) = res else { return Ok(vec![]) };
        let Ok(data) = res.json::<Value>().await else { return Ok(vec![]) };
        let mut models = Vec::new();
        if let Some(arr) = data.get("data").and_then(Value::as_array) {
            for m in arr {
                if let Some(id) = m.get("id").and_then(Value::as_str) {
                    models.push(ModelInfo { id: id.into(), name: id.into(), provider: self.name.clone() });
                }
            }
        } else if let Some(arr) = data.get("models").and_then(Value::as_array) {
            for m in arr {
                if let Some(id) = m.get("name").or_else(|| m.get("model")).and_then(Value::as_str) {
                    models.push(ModelInfo { id: id.into(), name: id.into(), provider: self.name.clone() });
                }
            }
        }
        Ok(models)
    }

    pub async fn is_available(&self) -> bool {
        self.client
            .get(self.models_url())
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}

fn retryable(err: &AppError) -> bool {
    let msg = err.to_string().to_lowercase();
    msg.contains("timeout")
        || msg.contains("timed out")
        || msg.contains("connect")
        || msg.contains("reset")
        || msg.contains("http 429")
        || msg.contains("http 500")
        || msg.contains("http 502")
        || msg.contains("http 503")
        || msg.contains("http 504")
}

pub fn endpoint_for(kind: ProviderKind, cfg: &ProviderFactoryConfig) -> (String, Option<String>, String, String) {
    match kind {
        ProviderKind::Openai => {
            let e = cfg.openai.clone().unwrap_or_default();
            (
                e.base_url.unwrap_or_else(|| "https://api.openai.com/v1".into()),
                e.api_key,
                e.default_model.unwrap_or_else(|| "gpt-4o".into()),
                e.name.unwrap_or_else(|| "OpenAI".into()),
            )
        }
        ProviderKind::Ollama => {
            let e = cfg.ollama.clone().unwrap_or_default();
            (
                e.host.unwrap_or_else(|| "http://127.0.0.1:11434".into()),
                None,
                e.default_model.unwrap_or_else(|| "llama3.2".into()),
                "Ollama".into(),
            )
        }
        ProviderKind::Local => {
            let e = cfg.local.clone().unwrap_or_default();
            (
                e.endpoint.unwrap_or_else(|| "http://127.0.0.1:1234/v1".into()),
                e.api_key,
                e.default_model.unwrap_or_else(|| "local-model".into()),
                e.name.unwrap_or_else(|| "LocalAI".into()),
            )
        }
        ProviderKind::Lmstudio => {
            let e = cfg.lmstudio.clone().unwrap_or_default();
            (
                e.endpoint.unwrap_or_else(|| "http://127.0.0.1:1234/v1".into()),
                e.api_key,
                e.default_model.unwrap_or_else(|| "local-model".into()),
                e.name.unwrap_or_else(|| "LM Studio".into()),
            )
        }
        ProviderKind::Jan => {
            let e = cfg.jan.clone().unwrap_or_default();
            (
                e.endpoint.unwrap_or_else(|| "http://127.0.0.1:1337/v1".into()),
                e.api_key,
                e.default_model.unwrap_or_else(|| "local-model".into()),
                e.name.unwrap_or_else(|| "Jan".into()),
            )
        }
    }
}

pub fn build_provider(kind: ProviderKind, cfg: &ProviderFactoryConfig) -> HttpProvider {
    let (endpoint, key, model, name) = endpoint_for(kind, cfg);
    HttpProvider::new(kind, name, endpoint, key, model)
}

pub fn build_all(cfg: &ProviderFactoryConfig) -> Vec<HttpProvider> {
    let mut out = vec![
        build_provider(ProviderKind::Ollama, cfg),
        build_provider(ProviderKind::Local, cfg),
        build_provider(ProviderKind::Lmstudio, cfg),
        build_provider(ProviderKind::Jan, cfg),
    ];
    if cfg.openai.as_ref().and_then(|e| e.api_key.as_ref()).is_some() {
        out.push(build_provider(ProviderKind::Openai, cfg));
    }
    out
}

pub fn endpoint_value(kind: ProviderKind, ep: &ProviderEndpoint) -> Option<&str> {
    match kind {
        ProviderKind::Openai => ep.base_url.as_deref(),
        ProviderKind::Ollama => ep.host.as_deref(),
        _ => ep.endpoint.as_deref(),
    }
}
