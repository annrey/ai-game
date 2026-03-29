/**
 * NPC-Director — NPC 导演
 * 管理 NPC 行为、对话和关系网
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest } from '../types/agent.js';
import type { NPCState } from '../types/scene.js';

interface NPCProfile {
  id: string;
  name: string;
  personality: string;
  background: string;
  speechStyle: string;
  relationships: Record<string, string>;
  goals: string[];
  secrets: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  role: 'npc-director',
  name: 'NPC导演',
  description: '当需要NPC反应、对话、行为或关系互动时使用。',
  systemPrompt: `你是 NPC 导演（NPC-Director），负责管理游戏中所有非玩家角色。

你的核心职责：
1. 基于NPC性格和当前情境，生成真实的NPC对话和行为
2. 维护NPC关系网，追踪NPC之间和与玩家的关系变化
3. 确保NPC行为符合其性格设定和个人目标
4. 管理NPC的情绪状态和动机变化

工作准则：
- 每个NPC都是独立的个体，有自己的性格、目标和秘密
- 对话风格要符合NPC的身份和说话方式
- NPC不应该无条件配合玩家，要有自己的立场
- 追踪并反映玩家过去行为对NPC态度的影响

回复格式：
【NPC名】：对话内容
【动作】：NPC的行为描写
【态度变化】：好感度/关系变化（如有）
【内心】：NPC的真实想法（仅供 Narrator 参考，不直接展示给玩家）`,
  temperature: 0.8,
};

export class NPCDirector extends BaseAgent {
  private npcProfiles = new Map<string, NPCProfile>();
  private relationshipWeb: string = '';

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
  }

  /** 注册NPC档案 */
  registerNPC(profile: NPCProfile): void {
    this.npcProfiles.set(profile.id, profile);
  }

  /** 加载关系网 */
  loadRelationships(web: string): void {
    this.relationshipWeb = web;
  }

  /** 为特定NPC生成反应 */
  async generateNPCReaction(
    npcId: string,
    playerAction: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const profile = this.npcProfiles.get(npcId);
    if (!profile) {
      return `[未知NPC: ${npcId}]`;
    }

    const request: AgentRequest = {
      from: 'narrator',
      content: `玩家行动：${playerAction}\n\n请为NPC「${profile.name}」生成反应。`,
      context: {
        ...context,
        npcProfile: profile,
      },
    };

    const response = await this.process(request);
    return response.content;
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = this.config.systemPrompt;

    // 注入当前场景中的NPC信息
    if (this.npcProfiles.size > 0) {
      const profiles = Array.from(this.npcProfiles.values())
        .map(p => `- ${p.name}：${p.personality}，目标：${p.goals.join('、')}`)
        .join('\n');
      prompt += `\n\n===== 当前可用NPC =====\n${profiles}`;
    }

    if (this.relationshipWeb) {
      prompt += `\n\n===== 关系网 =====\n${this.relationshipWeb}`;
    }

    return prompt;
  }
}
