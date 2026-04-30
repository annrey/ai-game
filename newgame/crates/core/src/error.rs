//! 统一错误类型定义

use std::fmt;

/// Core 模块的统一错误类型
#[derive(Debug)]
pub enum GameError {
    /// 状态操作错误
    StateError(String),
    /// 事件总线错误
    EventBusError(String),
    /// 引擎错误
    EngineError(String),
    /// 存储错误
    StorageError(String),
    /// 序列化错误
    SerializationError(String),
    /// 提供者错误
    ProviderError(String),
    /// 配置错误
    ConfigError(String),
    /// I/O 错误
    IoError(std::io::Error),
    /// 其他错误
    Other(String),
}

impl fmt::Display for GameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GameError::StateError(msg) => write!(f, "State error: {}", msg),
            GameError::EventBusError(msg) => write!(f, "Event bus error: {}", msg),
            GameError::EngineError(msg) => write!(f, "Engine error: {}", msg),
            GameError::StorageError(msg) => write!(f, "Storage error: {}", msg),
            GameError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            GameError::ProviderError(msg) => write!(f, "Provider error: {}", msg),
            GameError::ConfigError(msg) => write!(f, "Config error: {}", msg),
            GameError::IoError(e) => write!(f, "I/O error: {}", e),
            GameError::Other(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for GameError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            GameError::IoError(e) => Some(e),
            _ => None,
        }
    }
}

// 从 anyhow::Error 转换
impl From<anyhow::Error> for GameError {
    fn from(e: anyhow::Error) -> Self {
        GameError::Other(e.to_string())
    }
}

// 从 std::io::Error 转换
impl From<std::io::Error> for GameError {
    fn from(e: std::io::Error) -> Self {
        GameError::IoError(e)
    }
}

// 从 serde_json::Error 转换
impl From<serde_json::Error> for GameError {
    fn from(e: serde_json::Error) -> Self {
        GameError::SerializationError(e.to_string())
    }
}

// 从 &str 转换
impl From<&str> for GameError {
    fn from(s: &str) -> Self {
        GameError::Other(s.to_string())
    }
}

/// 结果类型别名
pub type GameResult<T> = Result<T, GameError>;

/// 错误上下文扩展 trait
pub trait ResultExt<T> {
    /// 添加上下文信息
    fn with_context<F, S>(self, f: F) -> GameResult<T>
    where
        F: FnOnce() -> S,
        S: Into<String>;
}

impl<T> ResultExt<T> for anyhow::Result<T> {
    fn with_context<F, S>(self, f: F) -> GameResult<T>
    where
        F: FnOnce() -> S,
        S: Into<String>,
    {
        self.map_err(|e| GameError::Other(format!("{}: {}", f().into(), e)))
    }
}

/// 可恢复错误处理
#[derive(Debug, Clone)]
pub enum RecoverableError {
    /// 暂时错误，可以重试
    Transient(String),
    /// 超时
    Timeout(String),
    /// 资源不足
    ResourceExhausted(String),
}

impl RecoverableError {
    /// 判断是否应该重试
    pub fn should_retry(&self) -> bool {
        matches!(self, RecoverableError::Transient(_) | RecoverableError::Timeout(_))
    }

    /// 获取建议的重试延迟（毫秒）
    pub fn retry_delay_ms(&self, attempt: u32) -> u64 {
        // 指数退避
        let base = 100;
        let max = 5000;
        let delay = base * 2_u64.pow(attempt);
        delay.min(max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = GameError::StateError("test".to_string());
        assert_eq!(err.to_string(), "State error: test");
    }

    #[test]
    fn test_recoverable_error_retry() {
        let err = RecoverableError::Transient("network".to_string());
        assert!(err.should_retry());

        let err = RecoverableError::ResourceExhausted("memory".to_string());
        assert!(!err.should_retry());
    }

    #[test]
    fn test_exponential_backoff() {
        let err = RecoverableError::Transient("test".to_string());
        assert_eq!(err.retry_delay_ms(0), 100);
        assert_eq!(err.retry_delay_ms(1), 200);
        assert_eq!(err.retry_delay_ms(2), 400);
        assert_eq!(err.retry_delay_ms(10), 5000); // 上限
    }
}
