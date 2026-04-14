use thiserror::Error;

#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("Memory not found")]
    NotFound,
    #[error("Invalid memory format")]
    InvalidFormat,
    #[error("Internal memory error: {0}")]
    Internal(String),
}
