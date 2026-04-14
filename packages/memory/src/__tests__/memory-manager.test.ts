/**
 * MemoryManager 单元测试
 * 测试：remember / recall / getRecentMemories / getContextMemories / clearSession
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../memory-manager.js';

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager({
      dbPath: ':memory:',
      sessionId: 'test-session',
      maxContextChars: 500,
    });
  });

  afterEach(() => {
    manager.close();
  });

  describe('remember', () => {
    it('应存储一条记忆', () => {
      const entry = manager.remember('发现了隐藏的洞穴', 'location', 0.7, ['洞穴', '发现']);
      expect(entry.content).toBe('发现了隐藏的洞穴');
      expect(entry.type).toBe('location');
      expect(entry.importance).toBe(0.7);
      expect(entry.sessionId).toBe('test-session');
    });

    it('应使用当前回合数', () => {
      manager.setTurn(5);
      const entry = manager.remember('第五回合事件', 'event');
      expect(entry.turn).toBe(5);
    });

    it('默认重要性 0.5', () => {
      const entry = manager.remember('普通记忆', 'fact');
      expect(entry.importance).toBe(0.5);
    });
  });

  describe('recall', () => {
    beforeEach(() => {
      manager.remember('森林中遇到精灵', 'event', 0.8, ['森林', '精灵']);
      manager.remember('铁匠的宝剑传说', 'fact', 0.6, ['铁匠', '宝剑']);
      manager.remember('与精灵结为盟友', 'relationship', 0.9, ['精灵', '盟友']);
    });

    it('应通过关键词检索相关记忆', () => {
      const results = manager.recall('精灵');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.includes('精灵'))).toBe(true);
    });

    it('应支持 limit 参数', () => {
      const results = manager.recall('精灵', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getRecentMemories', () => {
    it('应返回最近添加的记忆', () => {
      manager.remember('记忆1', 'event');
      manager.remember('记忆2', 'event');
      manager.remember('记忆3', 'event');

      const recent = manager.getRecentMemories(2);
      expect(recent).toHaveLength(2);
    });

    it('无记忆时返回空数组', () => {
      expect(manager.getRecentMemories()).toEqual([]);
    });
  });

  describe('getImportantMemories', () => {
    it('应只返回高重要性记忆', () => {
      manager.remember('普通事件', 'event', 0.3);
      manager.remember('重要发现', 'event', 0.9);
      manager.remember('关键线索', 'fact', 0.85);

      const important = manager.getImportantMemories(0.7);
      expect(important.length).toBe(2);
      expect(important.every(m => m.importance >= 0.7)).toBe(true);
    });
  });

  describe('getContextMemories', () => {
    beforeEach(() => {
      manager.remember('在山洞中发现古老的壁画', 'event', 0.9, ['山洞', '壁画']);
      manager.remember('村民提到北方有龙', 'fact', 0.7, ['村民', '龙', '北方']);
      manager.remember('与铁匠成为朋友', 'relationship', 0.5, ['铁匠']);
    });

    it('应生成格式化的上下文字符串', () => {
      const context = manager.getContextMemories('山洞探索');
      expect(context).toContain('记忆参考');
      expect(context.length).toBeGreaterThan(0);
    });

    it('应包含高重要性记忆', () => {
      const context = manager.getContextMemories('随便什么');
      expect(context).toContain('壁画');
    });

    it('无记忆时返回空字符串', () => {
      const emptyManager = new MemoryManager({
        dbPath: ':memory:',
        sessionId: 'empty',
      });
      const context = emptyManager.getContextMemories('test');
      expect(context).toBe('');
      emptyManager.close();
    });

    it('应遵循字符数限制', () => {
      // 插入大量记忆
      for (let i = 0; i < 50; i++) {
        manager.remember(`这是第${i}条非常长的记忆内容，包含了很多细节信息用于测试字符数限制`, 'event', 0.9);
      }
      const context = manager.getContextMemories('test', 200);
      expect(context.length).toBeLessThanOrEqual(300); // 允许一定余量（标题 + 最后一条）
    });
  });

  describe('clearSession', () => {
    it('应清除当前会话记忆', () => {
      manager.remember('记忆1', 'event');
      manager.remember('记忆2', 'fact');
      expect(manager.getMemoryCount()).toBe(2);

      manager.clearSession();
      expect(manager.getMemoryCount()).toBe(0);
    });
  });

  describe('getMemoryCount', () => {
    it('应返回当前会话的记忆数量', () => {
      expect(manager.getMemoryCount()).toBe(0);
      manager.remember('A', 'event');
      expect(manager.getMemoryCount()).toBe(1);
      manager.remember('B', 'fact');
      expect(manager.getMemoryCount()).toBe(2);
    });
  });

  describe('getAllMemories', () => {
    it('应返回所有记忆', () => {
      manager.remember('A', 'event', 0.5, ['tag1']);
      manager.remember('B', 'fact', 0.8, ['tag2']);

      const all = manager.getAllMemories();
      expect(all).toHaveLength(2);
    });

    it('应支持 limit', () => {
      manager.remember('A', 'event');
      manager.remember('B', 'event');
      manager.remember('C', 'event');

      const limited = manager.getAllMemories({ limit: 2 });
      expect(limited).toHaveLength(2);
    });
  });

  describe('setTurn', () => {
    it('应更新后续记忆的回合数', () => {
      manager.setTurn(1);
      const m1 = manager.remember('回合1', 'event');
      expect(m1.turn).toBe(1);

      manager.setTurn(10);
      const m2 = manager.remember('回合10', 'event');
      expect(m2.turn).toBe(10);
    });
  });
});
