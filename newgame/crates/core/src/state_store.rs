use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldState {
    pub time_of_day: String,
    pub weather: String,
    pub variables: Value,
    pub turn_count: i64,
}

impl Default for WorldState {
    fn default() -> Self {
        Self {
            time_of_day: "Morning".to_string(),
            weather: "Clear".to_string(),
            variables: serde_json::json!({}),
            turn_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveData {
    pub id: String,
    pub name: String,
    pub mode: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub state: WorldState,
}

#[derive(Clone)]
pub struct StateStore {
    state: Arc<RwLock<WorldState>>,
    save_dir: PathBuf,
}

impl StateStore {
    pub fn new(save_dir: impl Into<PathBuf>) -> Self {
        Self {
            state: Arc::new(RwLock::new(WorldState::default())),
            save_dir: save_dir.into(),
        }
    }

    pub async fn read<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&WorldState) -> R,
    {
        let lock = self.state.read().await;
        f(&*lock)
    }

    pub async fn mutate<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut WorldState) -> R,
    {
        let mut lock = self.state.write().await;
        f(&mut *lock)
    }

    /// Read the full state as a JSON string
    pub async fn get_state_json(&self) -> Result<String, serde_json::Error> {
        self.read(|state| {
            serde_json::to_string(&state)
        }).await
    }

    /// Save the current state to disk
    pub async fn save(&self, name: &str, mode: &str) -> anyhow::Result<String> {
        if !self.save_dir.exists() {
            fs::create_dir_all(&self.save_dir).await?;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        
        let state_snapshot = self.read(|s| s.clone()).await;

        let save_data = SaveData {
            id: id.clone(),
            name: name.to_string(),
            mode: mode.to_string(),
            created_at: now,
            updated_at: now,
            state: state_snapshot,
        };

        let file_path = self.save_dir.join(format!("{}.json", id));
        let json = serde_json::to_string_pretty(&save_data)?;
        fs::write(file_path, json).await?;

        Ok(id)
    }

    /// Load state from disk
    pub async fn load(&self, id: &str) -> anyhow::Result<()> {
        let file_path = self.save_dir.join(format!("{}.json", id));
        if !file_path.exists() {
            return Err(anyhow::anyhow!("Save file not found: {}", id));
        }

        let json = fs::read_to_string(file_path).await?;
        let save_data: SaveData = serde_json::from_str(&json)?;

        self.mutate(|state| {
            *state = save_data.state;
        }).await;

        Ok(())
    }

    /// List all saves
    pub async fn list_saves(&self, limit: Option<usize>) -> anyhow::Result<Vec<serde_json::Value>> {
        if !self.save_dir.exists() {
            return Ok(vec![]);
        }

        let mut entries = fs::read_dir(&self.save_dir).await?;
        let mut saves = Vec::new();

        while let Some(entry) = entries.next_entry().await? {
            if let Some(ext) = entry.path().extension() {
                if ext == "json" {
                    if let Ok(json) = fs::read_to_string(entry.path()).await {
                        if let Ok(mut save_data) = serde_json::from_str::<serde_json::Value>(&json) {
                            // Don't send the entire state object back for just listing
                            if let Some(obj) = save_data.as_object_mut() {
                                obj.remove("state");
                            }
                            saves.push(save_data);
                        }
                    }
                }
            }
        }

        // Sort by updated_at descending
        saves.sort_by(|a, b| {
            let time_a = a["updated_at"].as_i64().unwrap_or(0);
            let time_b = b["updated_at"].as_i64().unwrap_or(0);
            time_b.cmp(&time_a)
        });

        if let Some(l) = limit {
            saves.truncate(l);
        }

        Ok(saves)
    }

    /// Delete a save
    pub async fn delete_save(&self, id: &str) -> anyhow::Result<()> {
        let file_path = self.save_dir.join(format!("{}.json", id));
        if file_path.exists() {
            fs::remove_file(file_path).await?;
        }
        Ok(())
    }
}
