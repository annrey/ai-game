use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    Event,
    Fact,
    Relationship,
    Location,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: String,
    pub content: String,
    #[serde(rename = "type")]
    pub kind: MemoryType,
    pub importance: f64,
    pub turn: u32,
    pub tags: Vec<String>,
    pub session_id: String,
    pub created_at: String,
}

pub struct MemoryStore {
    conn: Mutex<Connection>,
}

impl MemoryStore {
    pub fn open(path: &str) -> AppResult<Self> {
        if let Some(parent) = std::path::Path::new(path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL,
                importance REAL DEFAULT 0.5,
                turn INTEGER,
                tags TEXT,
                session_id TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
            "#,
        )?;
        let _ = init_fts(&conn);
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn add(&self, content: &str, kind: MemoryType, importance: f64, turn: u32, tags: &[String], session_id: &str) -> AppResult<MemoryEntry> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(tags)?;
        let type_s = serde_json::to_value(kind)?.as_str().unwrap_or("event").to_string();
        self.conn.lock().expect("memory lock").execute(
            "INSERT INTO memories (id, content, type, importance, turn, tags, session_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, content, type_s, importance, turn, tags_json, session_id, now],
        )?;
        Ok(MemoryEntry {
            id,
            content: content.into(),
            kind,
            importance,
            turn,
            tags: tags.to_vec(),
            session_id: session_id.into(),
            created_at: now,
        })
    }

    pub fn recent(&self, session_id: &str, limit: u32) -> AppResult<Vec<MemoryEntry>> {
        let conn = self.conn.lock().expect("memory lock");
        let mut stmt = conn.prepare(
            "SELECT id, content, type, importance, turn, tags, session_id, created_at FROM memories WHERE session_id = ?1 ORDER BY created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![session_id, limit], map_memory_row)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn search(&self, session_id: &str, query: &str, limit: u32) -> AppResult<Vec<MemoryEntry>> {
        let conn = self.conn.lock().expect("memory lock");
        if let Ok(rows) = search_fts(&conn, session_id, query, limit) {
            if !rows.is_empty() || query.trim().is_empty() {
                return Ok(rows);
            }
        }
        let like = format!("%{query}%");
        let mut stmt = conn.prepare(
            "SELECT id, content, type, importance, turn, tags, session_id, created_at FROM memories WHERE session_id = ?1 AND content LIKE ?2 ORDER BY importance DESC LIMIT ?3",
        )?;
        let rows = stmt.query_map(params![session_id, like, limit], map_memory_row)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn count(&self, session_id: &str) -> AppResult<u32> {
        let n: i64 = self
            .conn
            .lock()
            .expect("memory lock")
            .query_row("SELECT COUNT(*) FROM memories WHERE session_id = ?1", params![session_id], |r| r.get(0))
            .optional()?
            .unwrap_or(0);
        Ok(n as u32)
    }

    pub fn clear_session(&self, session_id: &str) -> AppResult<()> {
        self.conn.lock().expect("memory lock").execute("DELETE FROM memories WHERE session_id = ?1", params![session_id])?;
        Ok(())
    }

    pub fn update_importance(&self, id: &str, importance: f64) -> AppResult<()> {
        self.conn
            .lock()
            .expect("memory lock")
            .execute("UPDATE memories SET importance = ?1 WHERE id = ?2", params![importance, id])?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        self.conn
            .lock()
            .expect("memory lock")
            .execute("DELETE FROM memories WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn all(&self, session_id: &str) -> AppResult<Vec<MemoryEntry>> {
        let conn = self.conn.lock().expect("memory lock");
        let mut stmt = conn.prepare(
            "SELECT id, content, type, importance, turn, tags, session_id, created_at FROM memories WHERE session_id = ?1 ORDER BY turn ASC",
        )?;
        let rows = stmt.query_map(params![session_id], map_memory_row)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }
}

fn init_fts(conn: &Connection) -> rusqlite::Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='memories_fts'",
        [],
        |r| r.get(0),
    )?;
    if exists > 0 {
        let _ = conn.execute_batch(
            r#"
            DROP TRIGGER IF EXISTS memories_ad;
            CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
              DELETE FROM memories_fts WHERE rowid = old.rowid;
            END;
            "#,
        );
        return Ok(());
    }
    if conn
        .execute_batch("CREATE VIRTUAL TABLE memories_fts USING fts5(content, session_id, tokenize='trigram');")
        .is_err()
    {
        conn.execute_batch("CREATE VIRTUAL TABLE memories_fts USING fts5(content, session_id);")?;
    }
    conn.execute_batch(
        r#"
        CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, content, session_id)
          VALUES (new.rowid, new.content, COALESCE(new.session_id, ''));
        END;
        CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
          DELETE FROM memories_fts WHERE rowid = old.rowid;
        END;
        INSERT INTO memories_fts(rowid, content, session_id)
        SELECT rowid, content, COALESCE(session_id, '') FROM memories;
        "#,
    )?;
    Ok(())
}

fn fts_query(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, '"' | '*' | '(' | ')' | ':' | '{' | '}'))
        .collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        String::new()
    } else {
        format!("\"{cleaned}\"")
    }
}

fn map_memory_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryEntry> {
    let type_s: String = row.get(2)?;
    let tags_s: String = row.get(5)?;
    Ok(MemoryEntry {
        id: row.get(0)?,
        content: row.get(1)?,
        kind: serde_json::from_value(serde_json::Value::String(type_s)).unwrap_or(MemoryType::Event),
        importance: row.get(3)?,
        turn: row.get::<_, i64>(4)? as u32,
        tags: serde_json::from_str(&tags_s).unwrap_or_default(),
        session_id: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn search_fts(conn: &Connection, session_id: &str, query: &str, limit: u32) -> rusqlite::Result<Vec<MemoryEntry>> {
    let q = fts_query(query);
    if q.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt = conn.prepare(
        "SELECT m.id, m.content, m.type, m.importance, m.turn, m.tags, m.session_id, m.created_at
         FROM memories m
         INNER JOIN memories_fts f ON m.rowid = f.rowid
         WHERE f.session_id = ?1 AND memories_fts MATCH ?2
         ORDER BY m.importance DESC LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![session_id, q, limit], map_memory_row)?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub struct MemoryManager {
    store: MemoryStore,
    session_id: String,
    turn: u32,
    max_context_chars: usize,
}

impl MemoryManager {
    pub fn new(db_path: &str, session_id: String, max_context_chars: u32) -> AppResult<Self> {
        Ok(Self {
            store: MemoryStore::open(db_path)?,
            session_id,
            turn: 0,
            max_context_chars: max_context_chars as usize,
        })
    }

    pub fn set_turn(&mut self, turn: u32) {
        self.turn = turn;
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn set_session_id(&mut self, id: String) {
        self.session_id = id;
    }

    pub fn remember(&self, content: &str, importance: f64, tags: &[String]) -> AppResult<MemoryEntry> {
        self.store.add(content, MemoryType::Event, importance, self.turn, tags, &self.session_id)
    }

    pub fn recent(&self, limit: u32) -> AppResult<Vec<MemoryEntry>> {
        self.store.recent(&self.session_id, limit)
    }

    pub fn search(&self, q: &str, limit: u32) -> AppResult<Vec<MemoryEntry>> {
        self.store.search(&self.session_id, q, limit)
    }

    pub fn count(&self) -> AppResult<u32> {
        self.store.count(&self.session_id)
    }

    pub fn clear(&self) -> AppResult<()> {
        self.store.clear_session(&self.session_id)
    }

    pub fn context_snippet(&self, query: &str) -> String {
        let related = self.search(query, 5).unwrap_or_default();
        let recent = self.recent(3).unwrap_or_default();
        let summary = self.summarize(8);
        let mut parts = Vec::new();
        let mut used = 0usize;
        if !summary.is_empty() {
            let line = format!("- 摘要：{summary}");
            used += line.len();
            parts.push(line);
        }
        for mem in related.into_iter().chain(recent) {
            let line = format!("- [回合{}] {}", mem.turn, mem.content);
            if used + line.len() > self.max_context_chars {
                break;
            }
            if !parts.iter().any(|p: &String| p.contains(&mem.id[..8.min(mem.id.len())])) {
                used += line.len();
                parts.push(line);
            }
        }
        if parts.is_empty() {
            String::new()
        } else {
            format!("【记忆参考】\n{}", parts.join("\n"))
        }
    }

    /// Decay stale events, drop dust, and fold old low-value rows into one fact.
    pub fn maintain(&self, current_turn: u32) -> AppResult<()> {
        self.decay(current_turn)?;
        self.compress(current_turn)?;
        Ok(())
    }

    pub fn decay(&self, current_turn: u32) -> AppResult<u32> {
        let mut forgotten = 0u32;
        for mem in self.store.all(&self.session_id)? {
            if mem.kind != MemoryType::Event {
                continue;
            }
            let age = current_turn.saturating_sub(mem.turn);
            if age < 8 {
                continue;
            }
            let steps = (age / 8).max(1);
            let next = (mem.importance * 0.85f64.powi(steps as i32)).max(0.0);
            if next < 0.12 {
                self.store.delete(&mem.id)?;
                forgotten += 1;
            } else if (next - mem.importance).abs() > f64::EPSILON {
                self.store.update_importance(&mem.id, next)?;
            }
        }
        Ok(forgotten)
    }

    pub fn compress(&self, current_turn: u32) -> AppResult<Option<MemoryEntry>> {
        let mut stale: Vec<MemoryEntry> = self
            .store
            .all(&self.session_id)?
            .into_iter()
            .filter(|m| m.kind == MemoryType::Event && current_turn.saturating_sub(m.turn) >= 6)
            .collect();
        if stale.len() < 8 {
            return Ok(None);
        }
        stale.sort_by(|a, b| a.importance.partial_cmp(&b.importance).unwrap_or(std::cmp::Ordering::Equal));
        let fold: Vec<MemoryEntry> = stale.into_iter().take(6).collect();
        let digest = fold
            .iter()
            .map(|m| m.content.chars().take(40).collect::<String>())
            .collect::<Vec<_>>()
            .join("；");
        for mem in &fold {
            self.store.delete(&mem.id)?;
        }
        let entry = self.store.add(
            &format!("早先回合摘要：{}", digest.chars().take(280).collect::<String>()),
            MemoryType::Fact,
            0.55,
            current_turn,
            &["summary".into()],
            &self.session_id,
        )?;
        Ok(Some(entry))
    }

    pub fn summarize(&self, limit: u32) -> String {
        let mut rows = self.store.all(&self.session_id).unwrap_or_default();
        rows.sort_by(|a, b| b.importance.partial_cmp(&a.importance).unwrap_or(std::cmp::Ordering::Equal));
        rows.into_iter()
            .take(limit as usize)
            .map(|m| m.content.chars().take(48).collect::<String>())
            .collect::<Vec<_>>()
            .join(" / ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_finds_chinese_and_english() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mem.db");
        let store = MemoryStore::open(path.to_str().unwrap()).unwrap();
        store.add("玩家在雾港酒馆遇见艾拉", MemoryType::Event, 0.7, 1, &["对话".into()], "s1").unwrap();
        store.add("向北走到码头", MemoryType::Event, 0.4, 2, &[], "s1").unwrap();
        store.add("另一会话的内容", MemoryType::Event, 0.9, 1, &[], "s2").unwrap();

        let hits = store.search("s1", "雾港", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].content.contains("雾港"));

        let dock = store.search("s1", "码头", 10).unwrap();
        assert_eq!(dock.len(), 1);
        assert_eq!(store.search("s2", "雾港", 10).unwrap().len(), 0);
    }

    #[test]
    fn decay_forgets_dust_and_compress_folds_old_events() {
        let dir = tempfile::tempdir().unwrap();
        let mut mgr = MemoryManager::new(dir.path().join("m.db").to_str().unwrap(), "s".into(), 800).unwrap();
        mgr.set_turn(1);
        for i in 0..10 {
            mgr.store
                .add(&format!("琐事{i} 路过石桥"), MemoryType::Event, 0.13, i, &[], "s")
                .unwrap();
        }
        mgr.set_turn(20);
        let forgotten = mgr.decay(20).unwrap();
        assert!(forgotten >= 1);
        for i in 0..8 {
            mgr.store
                .add(&format!("旧闻{i}"), MemoryType::Event, 0.25, i, &[], "s")
                .unwrap();
        }
        let folded = mgr.compress(20).unwrap();
        assert!(folded.unwrap().content.contains("摘要"));
        assert!(!mgr.summarize(8).is_empty());
    }
}
