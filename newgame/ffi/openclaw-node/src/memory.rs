use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::Value;
use std::sync::Arc;

use memory::models::MemoryEntry;
use memory::sqlite::SqliteMemoryStore;
use memory::store::MemoryStore;
use sqlx::sqlite::SqlitePoolOptions;

#[napi]
pub struct GameMemoryStore {
    inner: Arc<SqliteMemoryStore>,
}

#[napi]
impl GameMemoryStore {
    /// Create a new SQLite-backed memory store and initialize the database schema.
    #[napi(factory)]
    pub async fn create(db_url: String) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        let store = SqliteMemoryStore::new(pool);
        store
            .init()
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(Self {
            inner: Arc::new(store),
        })
    }

    /// Add a new memory entry
    #[napi]
    pub async fn add_entry(
        &self,
        id: String,
        content: String,
        created_at: i64,
        metadata_json: String,
    ) -> Result<()> {
        let metadata: Value = serde_json::from_str(&metadata_json)
            .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid metadata JSON: {}", e)))?;

        let entry = MemoryEntry {
            id,
            content,
            created_at,
            metadata,
        };

        self.inner
            .create(entry)
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(())
    }

    /// Get a memory entry by ID. Returns JSON string of the entry.
    #[napi]
    pub async fn get_entry(&self, id: String) -> Result<String> {
        let entry = self
            .inner
            .get(&id)
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        let json = serde_json::to_string(&entry)
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(json)
    }

    /// Delete a memory entry by ID
    #[napi]
    pub async fn delete_entry(&self, id: String) -> Result<()> {
        self.inner
            .delete(&id)
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(())
    }

    /// List all memory entries. Returns JSON string array of entries.
    #[napi]
    pub async fn list_entries(&self) -> Result<String> {
        let entries = self
            .inner
            .list()
            .await
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        let json = serde_json::to_string(&entries)
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        Ok(json)
    }
}
