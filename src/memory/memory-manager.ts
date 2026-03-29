/**
 * 记忆管理器 — 高层 API
 * 封装 MemoryStore，提供语义化的记忆存取和上下文注入功能
 */

import { MemoryStore } from './memory-store.js';
import type { MemoryEntry, MemoryType, MemoryQueryOptions } from './types.js';

export interface MemoryManagerConfig {
  /** SQLite 数据库文件路径 */
  dbPath?: string;
  /** 当前会话 ID */
  sessionId: string;
  /** 上下文注入时的最大字符数 */
  maxContextChars?: number;
}

export class MemoryManager {
  private store: MemoryStore;
  private sessionId: string;
  private maxContextChars: number;
  private currentTurn = 0;

  constructor(config: MemoryManagerConfig) {
    this.store = new MemoryStore(config.dbPath);
    this.sessionId = config.sessionId;
    this.maxContextChars = config.maxContextChars ?? 2000;
  }

  /** 设置当前回合数 */
  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /** 存储一条记忆 */
  remember(content: string, type: MemoryType, importance: number = 0.5, tags: string[] = []): MemoryEntry {
    return this.store.add({
      content,
      type,
      importance,
      turn: this.currentTurn,
      tags,
      sessionId: this.sessionId,
    });
  }

  /** 检索相关记忆 */
  recall(query: string, options?: Partial<MemoryQueryOptions>): MemoryEntry[] {
    return this.store.search(query, {
      ...options,
      sessionId: options?.sessionId ?? this.sessionId,
    });
  }

  /** 获取最近的记忆 */
  getRecentMemories(limit: number = 10): MemoryEntry[] {
    return this.store.getRecent({
      limit,
      sessionId: this.sessionId,
    });
  }

  /** 获取高重要性记忆 */
  getImportantMemories(minImportance: number = 0.7, limit: number = 10): MemoryEntry[] {
    return this.store.getRecent({
      limit,
      sessionId: this.sessionId,
      minImportance,
    });
  }

  /**
   * 格式化记忆为 prompt 片段，用于注入 agent 上下文
   * 会结合"最近记忆"和"相关记忆"，在字符数预算内输出
   */
  getContextMemories(query: string, maxChars?: number): string {
    const budget = maxChars ?? this.maxContextChars;
    const parts: string[] = [];
    let usedChars = 0;

    // 1. 高重要性记忆优先
    const important = this.getImportantMemories(0.8, 5);
    for (const mem of important) {
      const line = this.formatMemory(mem);
      if (usedChars + line.length > budget) break;
      parts.push(line);
      usedChars += line.length;
    }

    // 2. 与当前场景相关的记忆
    const related = this.recall(query, { limit: 5 });
    for (const mem of related) {
      if (parts.some(p => p.includes(mem.id))) continue; // 去重
      const line = this.formatMemory(mem);
      if (usedChars + line.length > budget) break;
      parts.push(line);
      usedChars += line.length;
    }

    // 3. 最近记忆补充
    const recent = this.getRecentMemories(3);
    for (const mem of recent) {
      if (parts.some(p => p.includes(mem.id))) continue;
      const line = this.formatMemory(mem);
      if (usedChars + line.length > budget) break;
      parts.push(line);
      usedChars += line.length;
    }

    if (parts.length === 0) return '';
    return `【记忆参考】\n${parts.join('\n')}`;
  }

  /** 清除当前会话的所有记忆 */
  clearSession(sessionId?: string): void {
    this.store.clearSession(sessionId ?? this.sessionId);
  }

  /** 获取记忆总数 */
  getMemoryCount(): number {
    return this.store.count(this.sessionId);
  }

  /** 获取所有记忆（用于 API 端点） */
  getAllMemories(options?: Partial<MemoryQueryOptions>): MemoryEntry[] {
    return this.store.getRecent({
      limit: options?.limit ?? 100,
      sessionId: options?.sessionId ?? this.sessionId,
      ...options,
    });
  }

  /** 关闭数据库连接 */
  close(): void {
    this.store.close();
  }

  /** 格式化单条记忆 */
  private formatMemory(mem: MemoryEntry): string {
    const typeLabel: Record<MemoryType, string> = {
      event: '事件',
      fact: '事实',
      relationship: '关系',
      location: '地点',
    };
    return `- [${typeLabel[mem.type]}][回合${mem.turn}] ${mem.content} (id:${mem.id.slice(0, 8)})`;
  }
}
