use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    pub name: String,
    pub role: String,
    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub energy: i32,
    pub max_energy: i32,
}

impl Default for PlayerStats {
    fn default() -> Self {
        Self {
            name: "旅人".to_string(),
            role: "冒险者".to_string(),
            health: 100,
            max_health: 100,
            mana: 50,
            max_mana: 50,
            energy: 80,
            max_energy: 100,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldState {
    pub time_of_day: String,
    pub weather: String,
    pub variables: Value,
    pub turn_count: i64,

    pub narrative: String,
    pub narrative_history: Vec<NarrativeEntry>,
    pub choices: Vec<Choice>,
    pub location_name: String,
    pub chapter: String,

    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub energy: i32,
    pub max_energy: i32,

    pub exploration_percent: f32,
    pub locations_discovered: i32,
    pub npcs_met: i32,
    pub items_collected: i32,

    pub inventory: Vec<InventoryItem>,
    pub quests: Vec<Quest>,
    pub settings: GameSettings,

    pub current_location: String,
    pub location_description: String,
    pub player: PlayerStats,
    pub scene_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeEntry {
    pub content: String,
    pub is_player: bool,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub id: String,
    pub text: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub quantity: i32,
    pub description: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quest {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: QuestStatus,
    pub objectives: Vec<QuestObjective>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuestStatus {
    Active,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestObjective {
    pub id: String,
    pub description: String,
    pub is_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSettings {
    pub single_screen_mode: bool,
    pub compact_layout: bool,
    pub font_size: String,
    pub story_clamp_lines: i32,
    pub log_preview_count: i32,
    pub hide_choice_descriptions: bool,
    pub show_sidebar: bool,
    pub show_right_panel: bool,
    pub show_scene_meta: bool,
    pub show_council: bool,
    pub show_reasoning: bool,
    pub show_cot: bool,
    pub show_world: bool,
    pub show_character: bool,
    pub show_inventory: bool,
    pub show_quests: bool,
    pub show_log: bool,
    pub auto_world_tick: bool,
    pub idle_timeout_seconds: i32,
    pub game_mode: String,
    pub language: String,
    pub streaming: bool,
    pub engine_logging: bool,
    pub max_history_turns: i32,
    pub memory_max_chars: i32,
    pub auto_save_interval: i32,
}

impl Default for GameSettings {
    fn default() -> Self {
        Self {
            single_screen_mode: false,
            compact_layout: false,
            font_size: "Normal".to_string(),
            story_clamp_lines: 7,
            log_preview_count: 3,
            hide_choice_descriptions: false,
            show_sidebar: true,
            show_right_panel: true,
            show_scene_meta: true,
            show_council: true,
            show_reasoning: true,
            show_cot: false,
            show_world: true,
            show_character: true,
            show_inventory: true,
            show_quests: true,
            show_log: true,
            auto_world_tick: true,
            idle_timeout_seconds: 30,
            game_mode: "TextAdventure".to_string(),
            language: "zh-CN".to_string(),
            streaming: false,
            engine_logging: false,
            max_history_turns: 20,
            memory_max_chars: 2000,
            auto_save_interval: 0,
        }
    }
}

impl Default for WorldState {
    fn default() -> Self {
        Self {
            time_of_day: "Morning".to_string(),
            weather: "Clear".to_string(),
            variables: serde_json::json!({
                "location": "迷雾十字路口",
                "year": 1,
                "month": 1,
                "day": 1,
                "hour": 8,
                "minute": 0,
            }),
            turn_count: 12,

            narrative: "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。空气中弥漫着清晨特有的清新，偶尔可以听到远处传来的鸟鸣声。\n\n四条道路由粗糙的石块铺成，两旁长满了青苔和野花。东边的道路似乎延伸得更远一些，尽头隐约可见一束微弱的光芒；而其他三条道路则显得较为平缓，没有特别明显的特征。\n\n古老的石碑矗立在西边路口，上面刻着模糊不清的符文。北边的路上有块路标，虽然有些风化，但依然清晰地写着：「未知之路」四个字。".to_string(),
            narrative_history: vec![],
            choices: vec![
                Choice {
                    id: "1".to_string(),
                    text: "向东前往古老森林".to_string(),
                    description: Some("追寻那束神秘的光芒".to_string()),
                    icon: Some("🌲".to_string()),
                    enabled: true,
                },
                Choice {
                    id: "2".to_string(),
                    text: "向北踏上未知之路".to_string(),
                    description: Some("路标所指的方向".to_string()),
                    icon: Some("🏔️".to_string()),
                    enabled: true,
                },
                Choice {
                    id: "3".to_string(),
                    text: "仔细查看石碑符文".to_string(),
                    description: Some("或许隐藏着线索".to_string()),
                    icon: Some("📜".to_string()),
                    enabled: true,
                },
                Choice {
                    id: "4".to_string(),
                    text: "自定义行动".to_string(),
                    description: Some("描述你想做的事".to_string()),
                    icon: Some("💭".to_string()),
                    enabled: true,
                },
            ],
            location_name: "迷雾十字路口".to_string(),
            chapter: "第一章 · 觉醒".to_string(),

            health: 85,
            max_health: 100,
            mana: 60,
            max_mana: 100,
            energy: 40,
            max_energy: 100,

            exploration_percent: 15.0,
            locations_discovered: 1,
            npcs_met: 0,
            items_collected: 0,

            inventory: vec![
                InventoryItem {
                    id: "torch".to_string(),
                    name: "火把".to_string(),
                    item_type: "Misc".to_string(),
                    quantity: 3,
                    description: "可以照亮黑暗".to_string(),
                    icon: "🔥".to_string(),
                },
                InventoryItem {
                    id: "map".to_string(),
                    name: "破旧地图".to_string(),
                    item_type: "Quest".to_string(),
                    quantity: 1,
                    description: "似乎标记着某个地点".to_string(),
                    icon: "🗺️".to_string(),
                },
            ],
            quests: vec![],
            settings: GameSettings::default(),
            current_location: "迷雾十字路口".to_string(),
            location_description: "你站在一片被阳光照亮的十字路口，四周是茂密的森林、广阔的平原和蜿蜒的小溪。".to_string(),
            player: PlayerStats::default(),
            scene_type: "forest".to_string(),
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
    db_pool: Option<sqlx::SqlitePool>,
}

impl StateStore {
    pub fn new(save_dir: impl Into<PathBuf>) -> Self {
        Self {
            state: Arc::new(RwLock::new(WorldState::default())),
            save_dir: save_dir.into(),
            db_pool: None,
        }
    }

    pub fn new_with_db(save_dir: impl Into<PathBuf>, db_pool: sqlx::SqlitePool) -> Self {
        Self {
            state: Arc::new(RwLock::new(WorldState::default())),
            save_dir: save_dir.into(),
            db_pool: Some(db_pool),
        }
    }

    pub async fn init(&self) -> anyhow::Result<()> {
        if let Some(pool) = &self.db_pool {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS saves (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                "#,
            )
            .execute(pool)
            .await?;
        }
        Ok(())
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

    pub async fn get_state_json(&self) -> Result<String, serde_json::Error> {
        self.read(|state| {
            serde_json::to_string(&state)
        }).await
    }

    pub async fn save(&self, name: &str, mode: &str) -> anyhow::Result<String> {
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

        if let Some(pool) = &self.db_pool {
            let state_json = serde_json::to_string(&save_data.state)?;
            sqlx::query(
                r#"
                INSERT INTO saves (id, name, mode, state_json, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                "#,
            )
            .bind(&save_data.id)
            .bind(&save_data.name)
            .bind(&save_data.mode)
            .bind(&state_json)
            .bind(save_data.created_at)
            .bind(save_data.updated_at)
            .execute(pool)
            .await?;
        } else {
            if !self.save_dir.exists() {
                fs::create_dir_all(&self.save_dir).await?;
            }

            let file_path = self.save_dir.join(format!("{}.json", id));
            let json = serde_json::to_string_pretty(&save_data)?;
            fs::write(file_path, json).await?;
        }

        Ok(id)
    }

    pub async fn load(&self, id: &str) -> anyhow::Result<()> {
        if let Some(pool) = &self.db_pool {
            let row: (String,) = sqlx::query_as("SELECT state_json FROM saves WHERE id = ?1")
                .bind(id)
                .fetch_one(pool)
                .await
                .map_err(|_| anyhow::anyhow!("Save not found: {}", id))?;

            let state: WorldState = serde_json::from_str(&row.0)?;

            self.mutate(|s| {
                *s = state;
            }).await;
        } else {
            let file_path = self.save_dir.join(format!("{}.json", id));
            if !file_path.exists() {
                return Err(anyhow::anyhow!("Save file not found: {}", id));
            }

            let json = fs::read_to_string(file_path).await?;
            let save_data: SaveData = serde_json::from_str(&json)?;

            self.mutate(|state| {
                *state = save_data.state;
            }).await;
        }

        Ok(())
    }

    pub async fn list_saves(&self, limit: Option<usize>) -> anyhow::Result<Vec<serde_json::Value>> {
        if let Some(pool) = &self.db_pool {
            let rows: Vec<(String, String, String, i64, i64)> = sqlx::query_as(
                r#"
                SELECT id, name, mode, created_at, updated_at
                FROM saves
                ORDER BY updated_at DESC
                "#,
            )
            .fetch_all(pool)
            .await?;

            let mut saves: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|(id, name, mode, created_at, updated_at)| {
                    serde_json::json!({
                        "id": id,
                        "name": name,
                        "mode": mode,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    })
                })
                .collect();

            if let Some(l) = limit {
                saves.truncate(l);
            }

            Ok(saves)
        } else {
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
                                if let Some(obj) = save_data.as_object_mut() {
                                    obj.remove("state");
                                }
                                saves.push(save_data);
                            }
                        }
                    }
                }
            }

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
    }

    pub async fn delete_save(&self, id: &str) -> anyhow::Result<()> {
        if let Some(pool) = &self.db_pool {
            sqlx::query("DELETE FROM saves WHERE id = ?1")
                .bind(id)
                .execute(pool)
                .await?;
        } else {
            let file_path = self.save_dir.join(format!("{}.json", id));
            if file_path.exists() {
                fs::remove_file(file_path).await?;
            }
        }
        Ok(())
    }
}
