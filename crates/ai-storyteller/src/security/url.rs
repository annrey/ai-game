use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderUrlKind {
    Local,
    Openai,
}

fn allowlist() -> Vec<String> {
    std::env::var("PROVIDER_URL_ALLOWLIST")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

fn parse_ipv4(host: &str) -> Option<[u8; 4]> {
    let parts: Vec<_> = host.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let mut out = [0u8; 4];
    for (i, p) in parts.iter().enumerate() {
        out[i] = p.parse().ok()?;
    }
    Some(out)
}

pub fn is_blocked_ip(host: &str) -> bool {
    let host = host.strip_prefix("::ffff:").unwrap_or(host);
    if let Some([a, b, ..]) = parse_ipv4(host) {
        return a == 0
            || a == 10
            || a == 127
            || (a == 169 && b == 254)
            || (a == 172 && (16..=31).contains(&b))
            || (a == 192 && b == 168)
            || (a == 100 && (64..=127).contains(&b));
    }
    host == "::1"
        || host == "::"
        || host.starts_with("fe80:")
        || host.starts_with("fc")
        || host.starts_with("fd")
}

fn is_loopback_host(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1")
        || parse_ipv4(host).is_some_and(|[a, ..]| a == 127)
}

fn is_metadata_host(host: &str) -> bool {
    host == "metadata.google.internal"
        || host == "metadata.google.com"
        || host == "metadata"
        || host.ends_with(".internal")
        || host == "169.254.169.254"
}

pub fn assert_safe_provider_url(raw: &str, kind: ProviderUrlKind) -> AppResult<String> {
    let url = url::Url::parse(raw).map_err(|_| AppError::BadRequest("Invalid provider URL".into()))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::BadRequest("Provider URL must be http or https".into()));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::BadRequest("Provider URL must not include credentials".into()));
    }
    let host = url.host_str().unwrap_or("").trim_matches(['[', ']']).to_ascii_lowercase();
    if host.is_empty() {
        return Err(AppError::BadRequest("Provider URL host is required".into()));
    }

    let origin = format!("{}://{}", url.scheme(), host);
    let list = allowlist();
    if list.iter().any(|h| h == &host || h == &origin) {
        return Ok(url.to_string());
    }
    if is_metadata_host(&host) {
        return Err(AppError::BadRequest("Provider URL host is not allowed".into()));
    }
    if is_loopback_host(&host) {
        return Ok(url.to_string());
    }
    if kind == ProviderUrlKind::Openai {
        if url.scheme() != "https" {
            return Err(AppError::BadRequest("Cloud provider URL must use https".into()));
        }
        if is_blocked_ip(&host) {
            return Err(AppError::BadRequest("Provider URL host is not allowed".into()));
        }
        return Ok(url.to_string());
    }
    Err(AppError::BadRequest(format!(
        "Provider URL host \"{host}\" is not allowed. Use loopback or set PROVIDER_URL_ALLOWLIST."
    )))
}

pub fn assert_optional_provider_url(raw: Option<&str>, kind: ProviderUrlKind) -> AppResult<Option<String>> {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(s) => Ok(Some(assert_safe_provider_url(s, kind)?)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_loopback() {
        assert!(assert_safe_provider_url("http://localhost:11434", ProviderUrlKind::Local).is_ok());
        assert!(assert_safe_provider_url("http://127.0.0.1:1234/v1", ProviderUrlKind::Local).is_ok());
    }

    #[test]
    fn rejects_private_lan() {
        assert!(assert_safe_provider_url("http://192.168.1.10:11434", ProviderUrlKind::Local).is_err());
        assert!(assert_safe_provider_url("http://169.254.169.254/latest", ProviderUrlKind::Local).is_err());
    }

    #[test]
    fn openai_requires_https() {
        assert!(assert_safe_provider_url("https://api.openai.com/v1", ProviderUrlKind::Openai).is_ok());
        assert!(assert_safe_provider_url("http://api.openai.com/v1", ProviderUrlKind::Openai).is_err());
    }
}
