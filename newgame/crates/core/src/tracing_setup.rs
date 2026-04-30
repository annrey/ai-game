//! Tracing 日志系统初始化
//!
//! 提供统一的日志层初始化，支持环境变量配置过滤级别
//!
//! 使用方法:
//! ```rust
//! use game_core::tracing_setup::init_tracing;
//!
//! #[tokio::main]
//! async fn main() {
//!     init_tracing();
//!     tracing::info!("Application started");
//! }
//! ```

use tracing_subscriber::{fmt, EnvFilter};

/// 初始化 tracing 日志系统
///
/// 环境变量:
/// - `RUST_LOG`: 设置日志级别，例如 "info", "debug", "game_core=trace"
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_file(true)
        .with_line_number(true)
        .init();
}

/// 初始化 tracing（简化版，不带文件位置）
pub fn init_tracing_simple() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .init();
}

/// 为测试初始化 tracing
pub fn init_tracing_for_test() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new("debug"))
        .with_test_writer()
        .try_init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tracing_setup() {
        // 测试不会 panic
        init_tracing_for_test();
        tracing::info!("Test log message");
    }
}
