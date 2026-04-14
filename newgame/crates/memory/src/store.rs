use async_trait::async_trait;
use crate::models::MemoryEntry;
use crate::error::MemoryError;

#[async_trait]
pub trait MemoryStore: Send + Sync {
    /// Create a new memory entry
    async fn create(&self, entry: MemoryEntry) -> Result<(), MemoryError>;
    
    /// Get a memory entry by ID
    async fn get(&self, id: &str) -> Result<MemoryEntry, MemoryError>;
    
    /// Update an existing memory entry
    async fn update(&self, entry: MemoryEntry) -> Result<(), MemoryError>;
    
    /// Delete a memory entry by ID
    async fn delete(&self, id: &str) -> Result<(), MemoryError>;
    
    /// List all memory entries
    async fn list(&self) -> Result<Vec<MemoryEntry>, MemoryError>;
}
