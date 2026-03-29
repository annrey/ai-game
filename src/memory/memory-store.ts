/**
 * 记忆存储层 — 基于 SQLite + FTS5 的持久化存储
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { MemoryEntry, CreateMemoryInput, MemoryQueryOptions, MemoryType } from './types.js';

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  /** 初始化数据库表结构 */
  private initSchema(): void {
    this.db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
    `);

    // FTS5 虚拟表用于全文检索
    // 检查是否已存在，避免重复创建
    const ftsExists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'"
    ).get();

    if (!ftsExists) {
      this.db.exec(`
        CREATE VIRTUAL TABLE memories_fts USING fts5(
          content,
          tags,
          content_rowid='rowid'
        );
      `);
    }
  }

  /** 存储一条记忆 */
  add(input: CreateMemoryInput): MemoryEntry {
    const id = uuidv4();
    const now = new Date().toISOString();
    const tags = input.tags ?? [];
    const importance = input.importance ?? 0.5;

    const insertMain = this.db.prepare(`
      INSERT INTO memories (id, content, type, importance, turn, tags, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFts = this.db.prepare(`
      INSERT INTO memories_fts (rowid, content, tags)
      VALUES (last_insert_rowid(), ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertMain.run(id, input.content, input.type, importance, input.turn, JSON.stringify(tags), input.sessionId, now);
      // 获取刚插入的 rowid
      const row = this.db.prepare('SELECT rowid FROM memories WHERE id = ?').get(id) as { rowid: number } | undefined;
      if (row) {
        this.db.prepare(`
          INSERT INTO memories_fts (rowid, content, tags)
          VALUES (?, ?, ?)
        `).run(row.rowid, input.content, tags.join(' '));
      }
    });

    transaction();

    return {
      id,
      content: input.content,
      type: input.type,
      importance,
      turn: input.turn,
      tags,
      createdAt: now,
      sessionId: input.sessionId,
    };
  }

  /** 通过 ID 获取记忆 */
  getById(id: string): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  /** 获取最近的记忆 */
  getRecent(options: MemoryQueryOptions = {}): MemoryEntry[] {
    const { limit = 10, type, sessionId, minImportance } = options;
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }
    if (minImportance !== undefined) {
      sql += ' AND importance >= ?';
      params.push(minImportance);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  /** 全文检索记忆 */
  search(query: string, options: MemoryQueryOptions = {}): MemoryEntry[] {
    const { limit = 10, type, sessionId } = options;

    // 使用 FTS5 MATCH 搜索
    let sql = `
      SELECT m.* FROM memories m
      INNER JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: any[] = [query];

    if (type) {
      sql += ' AND m.type = ?';
      params.push(type);
    }
    if (sessionId) {
      sql += ' AND m.session_id = ?';
      params.push(sessionId);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(r => this.rowToEntry(r));
    } catch {
      // FTS 查询语法错误时降级为 LIKE 搜索
      return this.searchFallback(query, options);
    }
  }

  /** FTS 失败时的降级搜索 */
  private searchFallback(query: string, options: MemoryQueryOptions = {}): MemoryEntry[] {
    const { limit = 10, type, sessionId } = options;
    let sql = 'SELECT * FROM memories WHERE content LIKE ?';
    const params: any[] = [`%${query}%`];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }

    sql += ' ORDER BY importance DESC, created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  /** 清除指定会话的记忆 */
  clearSession(sessionId: string): number {
    // 先获取要删除的 rowid 用于清理 FTS
    const rows = this.db.prepare('SELECT rowid FROM memories WHERE session_id = ?').all(sessionId) as { rowid: number }[];

    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        this.db.prepare('DELETE FROM memories_fts WHERE rowid = ?').run(row.rowid);
      }
      return this.db.prepare('DELETE FROM memories WHERE session_id = ?').run(sessionId).changes;
    });

    return transaction();
  }

  /** 获取记忆总数 */
  count(sessionId?: string): number {
    if (sessionId) {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE session_id = ?').get(sessionId) as { cnt: number };
      return row.cnt;
    }
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number };
    return row.cnt;
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }

  /** 数据行转 MemoryEntry */
  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      type: row.type as MemoryType,
      importance: row.importance,
      turn: row.turn,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      sessionId: row.session_id,
    };
  }
}
