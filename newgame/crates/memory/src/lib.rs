pub mod error;
pub mod models;
pub mod store;
pub mod sqlite;
pub mod in_memory;

pub use error::MemoryError;
pub use models::MemoryEntry;
pub use store::MemoryStore;
pub use sqlite::SqliteMemoryStore;
pub use in_memory::InMemoryStore;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::models::MemoryEntry;
    use crate::store::MemoryStore;
    use serde_json::json;

    #[tokio::test]
    async fn test_sqlite_in_memory_create_and_read() {
        let store = SqliteMemoryStore::new_in_memory().await.unwrap();

        let entry = MemoryEntry {
            id: "test-1".to_string(),
            content: "Hello World".to_string(),
            created_at: 1234567890,
            metadata: json!({"type": "test", "importance": 5}),
        };

        store.create(entry).await.unwrap();
        let retrieved = store.get("test-1").await.unwrap();

        assert_eq!(retrieved.id, "test-1");
        assert_eq!(retrieved.content, "Hello World");
        assert_eq!(retrieved.created_at, 1234567890);
        assert_eq!(retrieved.metadata["type"], "test");
    }

    #[tokio::test]
    async fn test_sqlite_update() {
        let store = SqliteMemoryStore::new_in_memory().await.unwrap();

        let entry = MemoryEntry {
            id: "test-2".to_string(),
            content: "original".to_string(),
            created_at: 1,
            metadata: json!({}),
        };
        store.create(entry).await.unwrap();

        let updated = MemoryEntry {
            id: "test-2".to_string(),
            content: "updated".to_string(),
            created_at: 2,
            metadata: json!({"changed": true}),
        };
        store.update(updated).await.unwrap();

        let retrieved = store.get("test-2").await.unwrap();
        assert_eq!(retrieved.content, "updated");
        assert_eq!(retrieved.metadata["changed"], true);
    }

    #[tokio::test]
    async fn test_sqlite_delete_and_clear() {
        let store = SqliteMemoryStore::new_in_memory().await.unwrap();

        for i in 1..=3 {
            let entry = MemoryEntry {
                id: format!("entry-{}", i),
                content: format!("content {}", i),
                created_at: i,
                metadata: json!({}),
            };
            store.create(entry).await.unwrap();
        }

        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 3);

        store.delete("entry-2").await.unwrap();
        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 2);

        store.clear().await.unwrap();
        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 0);
    }

    #[tokio::test]
    async fn test_sqlite_not_found() {
        let store = SqliteMemoryStore::new_in_memory().await.unwrap();

        let result = store.get("nonexistent").await;
        assert!(result.is_err());

        let result = store.delete("nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_in_memory_store_crud() {
        let store = InMemoryStore::default();

        let entry = MemoryEntry {
            id: "im-1".to_string(),
            content: "in-memory test".to_string(),
            created_at: 0,
            metadata: json!({"source": "test"}),
        };

        MemoryStore::create(&store, entry).await.unwrap();
        let retrieved: MemoryEntry = MemoryStore::get(&store, "im-1").await.unwrap();
        assert_eq!(retrieved.content, "in-memory test");

        MemoryStore::delete(&store, "im-1").await.unwrap();
        let result: Result<MemoryEntry, _> = MemoryStore::get(&store, "im-1").await;
        assert!(result.is_err());
    }
}
