use async_trait::async_trait;
use std::sync::Mutex;

use crate::models::MemoryEntry;
use crate::error::MemoryError;
use crate::store::MemoryStore;

#[derive(Default)]
pub struct InMemoryStore {
    entries: Mutex<Vec<MemoryEntry>>,
}

#[async_trait]
impl MemoryStore for InMemoryStore {
    async fn create(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let mut entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        entries.push(entry);
        Ok(())
    }

    async fn get(&self, id: &str) -> Result<MemoryEntry, MemoryError> {
        let entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        entries
            .iter()
            .find(|e| e.id == id)
            .cloned()
            .ok_or(MemoryError::NotFound)
    }

    async fn update(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let mut entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        if let Some(idx) = entries.iter().position(|e| e.id == entry.id) {
            entries[idx] = entry;
            Ok(())
        } else {
            Err(MemoryError::NotFound)
        }
    }

    async fn delete(&self, id: &str) -> Result<(), MemoryError> {
        let mut entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        if let Some(idx) = entries.iter().position(|e| e.id == id) {
            entries.remove(idx);
            Ok(())
        } else {
            Err(MemoryError::NotFound)
        }
    }

    async fn list(&self) -> Result<Vec<MemoryEntry>, MemoryError> {
        let entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        Ok(entries.clone())
    }

    async fn clear(&self) -> Result<(), MemoryError> {
        let mut entries = self.entries.lock().map_err(|e| MemoryError::Internal(e.to_string()))?;
        entries.clear();
        Ok(())
    }
}
