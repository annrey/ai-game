/**
 * NPC 关系网络管理器
 * 管理 NPC 之间的关系、社交互动和好感度变化
 */

import type {
  NPCRelationship,
  RelationshipType,
  RelationshipStatus,
  RelationshipChangeEvent,
  SocialInteraction,
  RelationshipNetworkConfig,
  RelationshipNetworkStats,
} from '../types/relationship.js';
import {
  getRelationshipStatus,
  getRelationshipStatusText,
  getRelationshipTypeText,
} from '../types/relationship.js';

const DEFAULT_CONFIG: RelationshipNetworkConfig = {
  maxRelationships: 100,
  affinityThreshold: 10,
  decayRate: 0.01,
  enableHistory: true,
};

export class RelationshipManager {
  private relationships = new Map<string, NPCRelationship>();
  private interactions: SocialInteraction[] = [];
  private config: RelationshipNetworkConfig;

  constructor(config: Partial<RelationshipNetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 创建关系 */
  createRelationship(
    npcAId: string,
    npcAName: string,
    npcBId: string,
    npcBName: string,
    type: RelationshipType,
    initialAffinity: number = 0,
    description: string = '',
  ): NPCRelationship {
    // 确保ID一致（排序后拼接）
    const sortedIds = [npcAId, npcBId].sort();
    const id = `rel-${sortedIds[0]}-${sortedIds[1]}`;

    // 检查是否已存在
    if (this.relationships.has(id)) {
      return this.relationships.get(id)!;
    }

    const relationship: NPCRelationship = {
      id,
      npcAId: sortedIds[0],
      npcAName: sortedIds[0] === npcAId ? npcAName : npcBName,
      npcBId: sortedIds[1],
      npcBName: sortedIds[1] === npcBId ? npcBName : npcAName,
      type,
      status: getRelationshipStatus(initialAffinity),
      affinity: initialAffinity,
      description,
      sharedHistory: [],
      lastInteraction: Date.now(),
    };

    this.relationships.set(id, relationship);
    return relationship;
  }

  /** 获取关系 */
  getRelationship(npcAId: string, npcBId: string): NPCRelationship | undefined {
    // 首先尝试排序后的ID
    const sortedIds = [npcAId, npcBId].sort();
    const id = `rel-${sortedIds[0]}-${sortedIds[1]}`;
    const rel = this.relationships.get(id);
    if (rel) return rel;

    // 如果没有找到，遍历查找（支持预定义的关系）
    for (const relationship of this.relationships.values()) {
      if (
        (relationship.npcAId === npcAId && relationship.npcBId === npcBId) ||
        (relationship.npcAId === npcBId && relationship.npcBId === npcAId)
      ) {
        return relationship;
      }
    }

    return undefined;
  }

  /** 获取NPC的所有关系 */
  getNPCRelationships(npcId: string): NPCRelationship[] {
    return Array.from(this.relationships.values()).filter(
      rel => rel.npcAId === npcId || rel.npcBId === npcId,
    );
  }

  /** 更新好感度 */
  updateAffinity(
    npcAId: string,
    npcBId: string,
    change: number,
    reason: string,
  ): RelationshipChangeEvent | null {
    const relationship = this.getRelationship(npcAId, npcBId);
    if (!relationship) return null;

    const oldAffinity = relationship.affinity;
    const oldStatus = relationship.status;

    // 更新好感度（限制在 -100 到 100）
    relationship.affinity = Math.max(-100, Math.min(100, relationship.affinity + change));
    relationship.lastInteraction = Date.now();

    // 检查关系状态是否变化
    const newStatus = getRelationshipStatus(relationship.affinity);
    if (newStatus !== oldStatus) {
      relationship.status = newStatus;
    }

    // 添加到共同历史
    if (this.config.enableHistory) {
      relationship.sharedHistory.push(`${new Date().toLocaleDateString()}: ${reason}`);
      // 限制历史记录数量
      if (relationship.sharedHistory.length > 20) {
        relationship.sharedHistory.shift();
      }
    }

    return {
      relationshipId: relationship.id,
      npcIds: [relationship.npcAId, relationship.npcBId],
      oldAffinity,
      newAffinity: relationship.affinity,
      reason,
      timestamp: Date.now(),
    };
  }

  /** 记录社交互动 */
  recordInteraction(
    initiatorId: string,
    receiverId: string,
    type: SocialInteraction['type'],
    content: string,
    affinityChange: number,
  ): SocialInteraction {
    const interaction: SocialInteraction = {
      id: `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      initiatorId,
      receiverId,
      type,
      content,
      affinityChange,
      timestamp: Date.now(),
    };

    this.interactions.push(interaction);

    // 限制互动记录数量
    if (this.interactions.length > 100) {
      this.interactions.shift();
    }

    // 更新关系好感度
    this.updateAffinity(initiatorId, receiverId, affinityChange, content);

    return interaction;
  }

  /** 获取NPC之间的互动历史 */
  getInteractionHistory(npcAId: string, npcBId: string): SocialInteraction[] {
    return this.interactions.filter(
      int =>
        (int.initiatorId === npcAId && int.receiverId === npcBId) ||
        (int.initiatorId === npcBId && int.receiverId === npcAId),
    );
  }

  /** 获取关系描述（用于对话生成） */
  getRelationshipDescription(npcAId: string, npcBId: string): string {
    const rel = this.getRelationship(npcAId, npcBId);
    if (!rel) return '';

    const statusText = getRelationshipStatusText(rel.status);
    const typeText = getRelationshipTypeText(rel.type);
    const otherName = rel.npcAId === npcAId ? rel.npcBName : rel.npcAName;

    return `${otherName}是你的${typeText}，你们的关系${statusText}。${rel.description}`;
  }

  /** 获取关系提示（用于AI生成） */
  getRelationshipPrompt(npcId: string): string {
    const relationships = this.getNPCRelationships(npcId);
    if (relationships.length === 0) return '';

    const lines = relationships.map(rel => {
      const otherName = rel.npcAId === npcId ? rel.npcBName : rel.npcAName;
      const statusText = getRelationshipStatusText(rel.status);
      return `- 与${otherName}的关系：${statusText}（${rel.description}）`;
    });

    return `\n\n===== 你的关系网 =====\n${lines.join('\n')}`;
  }

  /** 获取关系网络统计 */
  getStats(): RelationshipNetworkStats {
    const relationships = Array.from(this.relationships.values());

    const friendlyCount = relationships.filter(
      r => r.status === 'friendly' || r.status === 'close',
    ).length;
    const hostileCount = relationships.filter(
      r => r.status === 'hostile' || r.status === 'strained',
    ).length;
    const neutralCount = relationships.filter(r => r.status === 'neutral').length;

    // 计算最活跃的NPC
    const npcActivity = new Map<string, number>();
    for (const int of this.interactions) {
      npcActivity.set(int.initiatorId, (npcActivity.get(int.initiatorId) || 0) + 1);
      npcActivity.set(int.receiverId, (npcActivity.get(int.receiverId) || 0) + 1);
    }

    let mostActiveNPC: string | null = null;
    let maxActivity = 0;
    for (const [npcId, count] of npcActivity) {
      if (count > maxActivity) {
        maxActivity = count;
        mostActiveNPC = npcId;
      }
    }

    return {
      totalRelationships: relationships.length,
      friendlyCount,
      hostileCount,
      neutralCount,
      mostActiveNPC,
    };
  }

  /** 应用关系衰减（每回合调用） */
  applyDecay(): RelationshipChangeEvent[] {
    const events: RelationshipChangeEvent[] = [];

    for (const rel of this.relationships.values()) {
      // 长时间不互动会轻微衰减
      const timeSinceLastInteraction = Date.now() - rel.lastInteraction;
      const daysSinceInteraction = timeSinceLastInteraction / (1000 * 60 * 60 * 24);

      if (daysSinceInteraction > 1) {
        // 超过一天不互动，开始衰减
        const decayAmount = -this.config.decayRate * daysSinceInteraction;
        const event = this.updateAffinity(
          rel.npcAId,
          rel.npcBId,
          decayAmount,
          '长时间不互动，关系略微疏远',
        );
        if (event) events.push(event);
      }
    }

    return events;
  }

  /** 加载预定义的关系 */
  loadPredefinedRelationships(relationships: NPCRelationship[]): void {
    for (const rel of relationships) {
      this.relationships.set(rel.id, { ...rel });
    }
  }

  /** 清除所有关系 */
  clear(): void {
    this.relationships.clear();
    this.interactions = [];
  }

  /** 获取所有关系 */
  getAllRelationships(): NPCRelationship[] {
    return Array.from(this.relationships.values());
  }
}
