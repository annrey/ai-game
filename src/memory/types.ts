/**
 * 记忆系统类型定义
 */

/** 记忆类型 */
export type MemoryType = 'event' | 'fact' | 'relationship' | 'location';

/** 记忆条目 */
export interface MemoryEntry {
  /** 唯一标识 */
  id: string;
  /** 记忆内容摘要 */
  content: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 重要性 0-1 */
  importance: number;
  /** 产生时的回合数 */
  turn: number;
  /** 用于检索的标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: string;
  /** 所属会话 ID */
  sessionId: string;
}

/** 创建记忆的输入参数 */
export interface CreateMemoryInput {
  content: string;
  type: MemoryType;
  importance?: number;
  turn: number;
  tags?: string[];
  sessionId: string;
}

/** 记忆查询选项 */
export interface MemoryQueryOptions {
  /** 最大返回数 */
  limit?: number;
  /** 按类型过滤 */
  type?: MemoryType;
  /** 按会话过滤 */
  sessionId?: string;
  /** 最低重要性 */
  minImportance?: number;
}
