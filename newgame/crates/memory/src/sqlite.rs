use async_trait::async_trait;
use sqlx::{Row, SqlitePool};
use serde_json::Value;

use crate::models::MemoryEntry;
use crate::error::MemoryError;
use crate::store::MemoryStore;

pub struct SqliteMemoryStore {
    pool: SqlitePool,
}

impl SqliteMemoryStore {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn new_in_memory() -> Result<Self, MemoryError> {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .map_err(|e| MemoryError::Internal(e.to_string()))?;
        let store = Self { pool };
        store.init().await?;
        Ok(store)
    }

    pub async fn init(&self) -> Result<(), MemoryError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                metadata TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        Ok(())
    }
}

#[async_trait]
impl MemoryStore for SqliteMemoryStore {
    async fn create(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let metadata_str = serde_json::to_string(&entry.metadata)
            .map_err(|e| MemoryError::Internal(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO memories (id, content, created_at, metadata)
            VALUES (?1, ?2, ?3, ?4)
            "#,
        )
        .bind(&entry.id)
        .bind(&entry.content)
        .bind(entry.created_at)
        .bind(&metadata_str)
        .execute(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        Ok(())
    }

    async fn get(&self, id: &str) -> Result<MemoryEntry, MemoryError> {
        let row = sqlx::query(
            r#"
            SELECT id, content, created_at, metadata FROM memories WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        if let Some(row) = row {
            let id: String = row.get("id");
            let content: String = row.get("content");
            let created_at: i64 = row.get("created_at");
            let metadata_str: String = row.get("metadata");

            let metadata: Value = serde_json::from_str(&metadata_str)
                .map_err(|_| MemoryError::InvalidFormat)?;

            Ok(MemoryEntry {
                id,
                content,
                created_at,
                metadata,
            })
        } else {
            Err(MemoryError::NotFound)
        }
    }

    async fn update(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let metadata_str = serde_json::to_string(&entry.metadata)
            .map_err(|e| MemoryError::Internal(e.to_string()))?;

        let result = sqlx::query(
            r#"
            UPDATE memories SET content = ?2, created_at = ?3, metadata = ?4 WHERE id = ?1
            "#,
        )
        .bind(&entry.id)
        .bind(&entry.content)
        .bind(entry.created_at)
        .bind(&metadata_str)
        .execute(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        if result.rows_affected() == 0 {
            Err(MemoryError::NotFound)
        } else {
            Ok(())
        }
    }

    async fn delete(&self, id: &str) -> Result<(), MemoryError> {
        let result = sqlx::query(
            r#"
            DELETE FROM memories WHERE id = ?1
            "#,
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        if result.rows_affected() == 0 {
            Err(MemoryError::NotFound)
        } else {
            Ok(())
        }
    }

    async fn list(&self) -> Result<Vec<MemoryEntry>, MemoryError> {
        let rows = sqlx::query(
            r#"
            SELECT id, content, created_at, metadata FROM memories ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| MemoryError::Internal(e.to_string()))?;

        let mut entries = Vec::new();
        for row in rows {
            let id: String = row.get("id");
            let content: String = row.get("content");
            let created_at: i64 = row.get("created_at");
            let metadata_str: String = row.get("metadata");

            let metadata: Value = serde_json::from_str(&metadata_str)
                .map_err(|_| MemoryError::InvalidFormat)?;

            entries.push(MemoryEntry {
                id,
                content,
                created_at,
                metadata,
            });
        }

        Ok(entries)
    }

    async fn clear(&self) -> Result<(), MemoryError> {
        sqlx::query("DELETE FROM memories")
            .execute(&self.pool)
            .await
            .map_err(|e| MemoryError::Internal(e.to_string()))?;
        Ok(())
    }
}
