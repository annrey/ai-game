/**
 * MemoryStore 单元测试
 * 测试：add / getById / getRecent / search / clearSession / count
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../memory-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    // 使用内存数据库，每次测试全新
    store = new MemoryStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('add', () => {
    it('应存储一条记忆并返回完整条目', () => {
      const entry = store.add({
        content: '玩家在森林中发现了一把古剑',
        type: 'event',
        importance: 0.8,
        turn: 3,
        tags: ['森林', '古剑', '发现'],
        sessionId: 'session-1',
      });

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('玩家在森林中发现了一把古剑');
      expect(entry.type).toBe('event');
      expect(entry.importance).toBe(0.8);
      expect(entry.turn).toBe(3);
      expect(entry.tags).toEqual(['森林', '古剑', '发现']);
      expect(entry.sessionId).toBe('session-1');
      expect(entry.createdAt).toBeDefined();
    });

    it('默认重要性为 0.5', () => {
      const entry = store.add({
        content: '普通事件',
        type: 'event',
        turn: 1,
        sessionId: 'session-1',
      });
      expect(entry.importance).toBe(0.5);
    });

    it('默认 tags 为空数组', () => {
      const entry = store.add({
        content: '无标签事件',
        type: 'fact',
        turn: 1,
        sessionId: 'session-1',
      });
      expect(entry.tags).toEqual([]);
    });
  });

  describe('getById', () => {
    it('应通过 ID 获取记忆', () => {
      const entry = store.add({
        content: '测试记忆',
        type: 'fact',
        turn: 1,
        sessionId: 'session-1',
      });

      const found = store.getById(entry.id);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('测试记忆');
    });

    it('不存在的 ID 应返回 null', () => {
      expect(store.getById('nonexistent')).toBeNull();
    });
  });

  describe('getRecent', () => {
    beforeEach(() => {
      // 插入多条记忆
      for (let i = 1; i <= 5; i++) {
        store.add({
          content: `记忆 ${i}`,
          type: i % 2 === 0 ? 'event' : 'fact',
          importance: i * 0.2,
          turn: i,
          tags: [`tag${i}`],
          sessionId: 'session-1',
        });
      }
      // 不同会话的记忆
      store.add({
        content: '其他会话的记忆',
        type: 'event',
        turn: 1,
        sessionId: 'session-2',
      });
    });

    it('应返回最近的记忆', () => {
      const recent = store.getRecent({ limit: 3 });
      expect(recent).toHaveLength(3);
    });

    it('应按会话过滤', () => {
      const session1 = store.getRecent({ sessionId: 'session-1' });
      expect(session1).toHaveLength(5);

      const session2 = store.getRecent({ sessionId: 'session-2' });
      expect(session2).toHaveLength(1);
    });

    it('应按类型过滤', () => {
      const events = store.getRecent({ type: 'event', sessionId: 'session-1' });
      expect(events.every(e => e.type === 'event')).toBe(true);
    });

    it('应按最低重要性过滤', () => {
      const important = store.getRecent({ minImportance: 0.7, sessionId: 'session-1' });
      expect(important.every(e => e.importance >= 0.7)).toBe(true);
      expect(important.length).toBeGreaterThan(0);
    });

    it('默认 limit 为 10', () => {
      // 已有 6 条记忆
      const recent = store.getRecent();
      expect(recent.length).toBeLessThanOrEqual(10);
    });
  });

  describe('search (FTS5)', () => {
    beforeEach(() => {
      store.add({
        content: '玩家在古老的森林中遇到了一位神秘的精灵',
        type: 'event',
        turn: 1,
        tags: ['森林', '精灵', '相遇'],
        sessionId: 'session-1',
      });
      store.add({
        content: '铁匠告诉玩家关于魔法宝剑的传说',
        type: 'fact',
        turn: 2,
        tags: ['铁匠', '宝剑', '传说'],
        sessionId: 'session-1',
      });
      store.add({
        content: '玩家与精灵建立了友谊',
        type: 'relationship',
        turn: 3,
        tags: ['精灵', '友谊'],
        sessionId: 'session-1',
      });
    });

    it('应通过全文检索找到匹配记忆', () => {
      const results = store.search('精灵');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.includes('精灵'))).toBe(true);
    });

    it('应通过标签搜索', () => {
      const results = store.search('宝剑');
      expect(results.length).toBeGreaterThan(0);
    });

    it('应按类型过滤搜索结果', () => {
      const results = store.search('精灵', { type: 'relationship' });
      expect(results.every(r => r.type === 'relationship')).toBe(true);
    });

    it('空结果应返回空数组', () => {
      const results = store.search('完全不存在的内容xyz');
      expect(results).toEqual([]);
    });
  });

  describe('clearSession', () => {
    it('应清除指定会话的所有记忆', () => {
      store.add({ content: 'A', type: 'event', turn: 1, sessionId: 's1' });
      store.add({ content: 'B', type: 'event', turn: 2, sessionId: 's1' });
      store.add({ content: 'C', type: 'event', turn: 1, sessionId: 's2' });

      const deleted = store.clearSession('s1');
      expect(deleted).toBe(2);
      expect(store.count('s1')).toBe(0);
      expect(store.count('s2')).toBe(1);
    });

    it('清除不存在的会话应返回 0', () => {
      expect(store.clearSession('nonexistent')).toBe(0);
    });
  });

  describe('count', () => {
    it('应返回总记忆数', () => {
      store.add({ content: 'A', type: 'event', turn: 1, sessionId: 's1' });
      store.add({ content: 'B', type: 'event', turn: 2, sessionId: 's2' });

      expect(store.count()).toBe(2);
    });

    it('应按会话统计', () => {
      store.add({ content: 'A', type: 'event', turn: 1, sessionId: 's1' });
      store.add({ content: 'B', type: 'event', turn: 2, sessionId: 's1' });
      store.add({ content: 'C', type: 'event', turn: 1, sessionId: 's2' });

      expect(store.count('s1')).toBe(2);
      expect(store.count('s2')).toBe(1);
    });
  });
});
