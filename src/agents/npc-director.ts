/**
 * NPC-Director — NPC 导演
 * 管理 NPC 行为、对话和关系网
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest } from '../types/agent.js';
import type { NPCState, GameTime, Quest } from '../types/scene.js';
import { MemoryManager } from '../memory/memory-manager.js';
import type { MemoryType } from '../memory/types.js';
import { ScheduleManager } from '../engine/schedule-manager.js';
import { TAVERN_NPC_SCHEDULES } from '../types/schedule.js';
import { RelationshipManager } from '../engine/relationship-manager.js';
import { TAVERN_NPC_RELATIONSHIPS } from '../types/relationship.js';
import { QuestValidator } from '../validators/quest-validator.js';
import type { QuestGenerationContext } from '../types/validator.js';

interface NPCActivity {
  description: string;
  timePhases: Array<GameTime['period']>;
}

interface NPCMood {
  mood: string;
  emoji: string;
  description: string;
}

// 酒馆 NPC 活动模板
const TAVERN_NPC_ACTIVITIES: Record<string, NPCActivity[]> = {
  'default': [
    { description: '独自饮酒，若有所思', timePhases: ['evening', 'night', 'midnight'] },
    { description: '擦拭酒杯', timePhases: ['morning', 'noon', 'afternoon', 'evening'] },
    { description: '与其他客人闲聊', timePhases: ['noon', 'afternoon', 'evening'] },
    { description: '望着窗外发呆', timePhases: ['dawn', 'morning', 'night'] },
  ],
  'bard': [
    { description: '弹奏鲁特琴', timePhases: ['evening', 'night'] },
    { description: '哼唱小曲', timePhases: ['morning', 'afternoon'] },
    { description: '整理乐谱', timePhases: ['dawn', 'morning'] },
  ],
  'barkeep': [
    { description: '擦拭酒杯', timePhases: ['morning', 'noon', 'afternoon', 'evening'] },
    { description: '整理酒架', timePhases: ['morning', 'dawn'] },
    { description: '与客人交谈', timePhases: ['noon', 'afternoon', 'evening'] },
  ],
};

// NPC 心情模板
const NPC_MOODS: NPCMood[] = [
  { mood: 'happy', emoji: '😊', description: '开心' },
  { mood: 'calm', emoji: '😐', description: '平静' },
  { mood: 'curious', emoji: '🤔', description: '好奇' },
  { mood: 'friendly', emoji: '🙂', description: '友善' },
  { mood: 'tired', emoji: '😴', description: '疲惫' },
  { mood: 'angry', emoji: '😠', description: '生气' },
];

// NPC 状态存储
interface NPCInternalState {
  activity: string;
  mood: string;
  lastInteractionTime: number;
};

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
  private npcStates = new Map<string, NPCInternalState>();
  private currentTime: GameTime | null = null;
  private npcMemoryManagers = new Map<string, MemoryManager>();
  private currentTurn = 0;
  private scheduleManager: ScheduleManager;
  private relationshipManager: RelationshipManager;
  private questValidator: QuestValidator;
  private eventBus?: { 
    emit: (
      type: string, 
      payload?: Record<string, unknown>, 
      source?: 'engine' | 'agent' | 'player' | 'system' | 'world-keeper'
    ) => void 
  };

  constructor(
    provider: AIProvider, 
    model?: string, 
    configOverride?: Partial<AgentConfig>,
    eventBus?: { 
      emit: (
        type: string, 
        payload?: Record<string, unknown>, 
        source?: 'engine' | 'agent' | 'player' | 'system' | 'world-keeper'
      ) => void 
    }
  ) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
    this.scheduleManager = new ScheduleManager();
    this.relationshipManager = new RelationshipManager();
    this.questValidator = new QuestValidator();
    this.eventBus = eventBus;
    // 加载预定义的日程模板
    this.scheduleManager.loadScheduleTemplates(TAVERN_NPC_SCHEDULES);
    // 加载预定义的关系
    this.relationshipManager.loadPredefinedRelationships(TAVERN_NPC_RELATIONSHIPS);
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

  /** 设置当前游戏时间 */
  setCurrentTime(time: GameTime): void {
    this.currentTime = time;
  }

  /** 初始化 NPC 状态 */
  initializeNPCState(npcId: string, npcType: string = 'default'): void {
    const profile = this.npcProfiles.get(npcId);
    if (!profile) return;

    // 根据时间选择合适的活动
    const activity = this.selectActivityForTime(npcType);
    // 默认心情为平静
    const defaultMood = NPC_MOODS.find(m => m.mood === 'calm')!;

    this.npcStates.set(npcId, {
      activity,
      mood: defaultMood.mood,
      lastInteractionTime: Date.now(),
    });
  }

  /** 根据时间选择合适的活动 */
  private selectActivityForTime(npcType: string = 'default'): string {
    if (!this.currentTime) {
      return '观察周围环境';
    }

    const activities = TAVERN_NPC_ACTIVITIES[npcType] || TAVERN_NPC_ACTIVITIES['default'];
    const suitableActivities = activities.filter(a => 
      a.timePhases.includes(this.currentTime!.period)
    );

    if (suitableActivities.length === 0) {
      return activities[0].description;
    }

    // 随机选择一个合适的活动
    return suitableActivities[Math.floor(Math.random() * suitableActivities.length)].description;
  }

  /** 获取 NPC 状态 */
  getNPCState(npcId: string): { activity: string; mood: string; emoji: string } | null {
    const state = this.npcStates.get(npcId);
    if (!state) return null;

    const moodInfo = NPC_MOODS.find(m => m.mood === state.mood) || NPC_MOODS[1];
    return {
      activity: state.activity,
      mood: state.mood,
      emoji: moodInfo.emoji,
    };
  }

  /** 更新 NPC 活动 */
  updateNPCActivity(npcId: string, activity?: string): void {
    const state = this.npcStates.get(npcId);
    if (!state) return;

    const profile = this.npcProfiles.get(npcId);
    const npcType = profile?.id.includes('bard') ? 'bard' : 
                     profile?.id.includes('barkeep') ? 'barkeep' : 'default';

    state.activity = activity || this.selectActivityForTime(npcType);
    state.lastInteractionTime = Date.now();
  }

  /** 更新 NPC 心情 */
  updateNPCMood(npcId: string, moodChange: 'improve' | 'worsen' | 'random' = 'random'): void {
    const state = this.npcStates.get(npcId);
    if (!state) return;

    const currentIndex = NPC_MOODS.findIndex(m => m.mood === state.mood);
    let newIndex = currentIndex;

    switch (moodChange) {
      case 'improve':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'worsen':
        newIndex = Math.min(NPC_MOODS.length - 1, currentIndex + 1);
        break;
      case 'random':
        newIndex = Math.floor(Math.random() * NPC_MOODS.length);
        break;
    }

    state.mood = NPC_MOODS[newIndex].mood;
    state.lastInteractionTime = Date.now();
  }

  /** 获取所有在场 NPC 的状态 */
  getAllNPCStates(): Array<{ id: string; name: string; activity: string; mood: string; emoji: string }> {
    const result: Array<{ id: string; name: string; activity: string; mood: string; emoji: string }> = [];
    
    for (const [npcId, state] of this.npcStates) {
      const profile = this.npcProfiles.get(npcId);
      if (!profile) continue;

      const moodInfo = NPC_MOODS.find(m => m.mood === state.mood) || NPC_MOODS[1];
      result.push({
        id: npcId,
        name: profile.name,
        activity: state.activity,
        mood: state.mood,
        emoji: moodInfo.emoji,
      });
    }

    return result;
  }

  /** 设置当前回合数 */
  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /** 为 NPC 初始化记忆管理器 */
  initializeNPCMemory(npcId: string, sessionId: string): void {
    if (!this.npcMemoryManagers.has(npcId)) {
      const memoryManager = new MemoryManager({
        sessionId: `${sessionId}_${npcId}`,
      });
      memoryManager.setTurn(this.currentTurn);
      this.npcMemoryManagers.set(npcId, memoryManager);
    }
  }

  /** 记录 NPC 对话记忆 */
  recordNPCInteraction(
    npcId: string,
    playerAction: string,
    npcResponse: string,
    importance: number = 0.5,
  ): void {
    const memoryManager = this.npcMemoryManagers.get(npcId);
    if (!memoryManager) return;

    memoryManager.setTurn(this.currentTurn);
    
    const content = `玩家说：${playerAction}\n${this.npcProfiles.get(npcId)?.name || 'NPC'}回复：${npcResponse}`;
    
    memoryManager.remember(content, 'event' as MemoryType, importance, ['interaction', npcId]);
  }

  /** 记录重要事实 */
  recordFact(
    npcId: string,
    fact: string,
    importance: number = 0.8,
  ): void {
    const memoryManager = this.npcMemoryManagers.get(npcId);
    if (!memoryManager) return;

    memoryManager.setTurn(this.currentTurn);
    memoryManager.remember(fact, 'fact' as MemoryType, importance, ['fact', npcId]);
  }

  /** 获取 NPC 相关记忆 */
  getNPCMemories(npcId: string, query: string = ''): string {
    const memoryManager = this.npcMemoryManagers.get(npcId);
    if (!memoryManager) return '';

    return memoryManager.getContextMemories(query);
  }

  /** 清除 NPC 记忆 */
  clearNPCMemories(npcId: string): void {
    const memoryManager = this.npcMemoryManagers.get(npcId);
    if (!memoryManager) return;
    memoryManager.clearSession();
  }

  /** 为 NPC 对话生成注入记忆 */
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

    // 注入 NPC 记忆
    const npcId = request.context?.npcId as string;
    if (npcId) {
      const memories = this.getNPCMemories(npcId, request.content || '');
      if (memories) {
        prompt += `\n\n${memories}`;
      }

      // 注入 NPC 关系网
      const relationshipPrompt = this.getRelationshipPrompt(npcId);
      if (relationshipPrompt) {
        prompt += relationshipPrompt;
      }
    }

    return prompt;
  }

  // ==================== 日程管理方法 ====================

  /** 设置日程管理器的时间 */
  setScheduleTime(time: GameTime): void {
    this.scheduleManager.setCurrentTime(time);
  }

  /** 设置日程管理器的回合 */
  setScheduleTurn(turn: number): void {
    this.scheduleManager.setTurn(turn);
  }

  /** 获取 NPC 当前日程状态 */
  getNPCScheduleState(npcId: string): {
    activity: string;
    location: string;
    isPresent: boolean;
    mood?: string;
  } | null {
    return this.scheduleManager.getNPCCurrentState(npcId);
  }

  /** 获取当前在场的 NPC 列表 */
  getPresentNPCIds(): string[] {
    return this.scheduleManager.getPresentNPCs();
  }

  /** 获取当前不在场的 NPC 列表 */
  getAbsentNPCIds(): string[] {
    return this.scheduleManager.getAbsentNPCs();
  }

  /** 更新日程并获取出现/离开事件 */
  updateSchedule(): import('../types/schedule.js').NPCPresenceEvent[] {
    return this.scheduleManager.update();
  }

  /** 同步日程状态到 NPC 状态 */
  syncScheduleToNPCState(): void {
    for (const [npcId, profile] of this.npcProfiles) {
      const scheduleState = this.scheduleManager.getNPCCurrentState(npcId);
      if (!scheduleState) continue;

      // 如果 NPC 在场，更新其状态
      if (scheduleState.isPresent) {
        const existingState = this.npcStates.get(npcId);
        if (existingState) {
          // 更新活动和心情
          existingState.activity = scheduleState.activity;
          if (scheduleState.mood) {
            existingState.mood = scheduleState.mood;
          }
        } else {
          // 初始化新状态
          this.initializeNPCState(npcId);
          const newState = this.npcStates.get(npcId);
          if (newState) {
            newState.activity = scheduleState.activity;
            if (scheduleState.mood) {
              newState.mood = scheduleState.mood;
            }
          }
        }
      }
    }
  }

  /** 获取所有在场 NPC 的完整状态（用于 UI 展示） */
  getAllPresentNPCsWithSchedule(): Array<{
    id: string;
    name: string;
    activity: string;
    location: string;
    mood: string;
    emoji: string;
  }> {
    const result: Array<{
      id: string;
      name: string;
      activity: string;
      location: string;
      mood: string;
      emoji: string;
    }> = [];

    const presentIds = this.scheduleManager.getPresentNPCs();

    for (const npcId of presentIds) {
      const profile = this.npcProfiles.get(npcId);
      const scheduleState = this.scheduleManager.getNPCCurrentState(npcId);
      const internalState = this.npcStates.get(npcId);

      if (!profile || !scheduleState) continue;

      // 确定心情
      const mood = scheduleState.mood || internalState?.mood || 'calm';
      const moodInfo = NPC_MOODS.find(m => m.mood === mood) || NPC_MOODS[1];

      result.push({
        id: npcId,
        name: profile.name,
        activity: scheduleState.activity,
        location: scheduleState.location,
        mood,
        emoji: moodInfo.emoji,
      });
    }

    return result;
  }

  // ==================== 关系网络管理方法 ====================

  /** 获取两个NPC之间的关系 */
  getRelationship(npcAId: string, npcBId: string) {
    return this.relationshipManager.getRelationship(npcAId, npcBId);
  }

  /** 获取NPC的所有关系 */
  getNPCRelationships(npcId: string) {
    return this.relationshipManager.getNPCRelationships(npcId);
  }

  /** 更新NPC之间的好感度 */
  updateRelationshipAffinity(
    npcAId: string,
    npcBId: string,
    change: number,
    reason: string,
  ) {
    return this.relationshipManager.updateAffinity(npcAId, npcBId, change, reason);
  }

  /** 记录NPC之间的社交互动 */
  recordSocialInteraction(
    initiatorId: string,
    receiverId: string,
    type: import('../types/relationship.js').SocialInteraction['type'],
    content: string,
    affinityChange: number,
  ) {
    return this.relationshipManager.recordInteraction(
      initiatorId,
      receiverId,
      type,
      content,
      affinityChange,
    );
  }

  /** 获取关系描述（用于对话生成） */
  getRelationshipDescription(npcAId: string, npcBId: string): string {
    return this.relationshipManager.getRelationshipDescription(npcAId, npcBId);
  }

  /** 获取关系提示（用于AI生成） */
  getRelationshipPrompt(npcId: string): string {
    return this.relationshipManager.getRelationshipPrompt(npcId);
  }

  /** 获取关系网络统计 */
  getRelationshipStats() {
    return this.relationshipManager.getStats();
  }

  /** 获取所有关系 */
  getAllRelationships() {
    return this.relationshipManager.getAllRelationships();
  }

  // ============ 任务生成方法 ============

  /**
   * 根据 NPC 交互生成任务
   * @param npcId NPC 标识
   * @param playerAction 玩家行为
   * @param context 上下文信息
   * @returns 生成的任务或错误
   */
  async generateQuestFromNPC(
    npcId: string,
    playerAction: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      relationship?: number;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const profile = this.npcProfiles.get(npcId);
      if (!profile) {
        return {
          success: false,
          errors: [`NPC ${npcId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: this.getCurrentLocation(),
        relatedNPC: profile.name,
        difficulty: context.difficulty || 'medium',
        plotType: this.determinePlotType(playerAction, context.relationship),
        eventType: 'npc_interaction',
        npcPersonality: profile.personality,
        npcGoals: profile.goals,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:npc_generated', { 
          quest, 
          npcId, 
          npcName: profile.name,
          playerAction 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NPCDirector] NPC 任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 根据 NPC 请求生成帮助任务
   * @param npcId NPC 标识
   * @param requestType 请求类型（如 'fetch', 'escort', 'combat', 'information'）
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async generateHelpQuest(
    npcId: string,
    requestType: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      target?: string;
      reward?: { gold?: number; exp?: number };
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const profile = this.npcProfiles.get(npcId);
      if (!profile) {
        return {
          success: false,
          errors: [`NPC ${npcId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: this.getCurrentLocation(),
        relatedNPC: profile.name,
        difficulty: context.difficulty || 'medium',
        plotType: 'side',
        eventType: `help_${requestType}`,
        npcPersonality: profile.personality,
        npcGoals: profile.goals,
        requestType,
        target: context.target,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:npc_help', { 
          quest, 
          npcId, 
          npcName: profile.name,
          requestType 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NPCDirector] NPC 帮助任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 根据关系变化生成任务
   * @param npcId NPC 标识
   * @param relationshipChange 关系变化值
   * @param reason 变化原因
   * @returns 生成的任务或错误
   */
  async generateRelationshipQuest(
    npcId: string,
    relationshipChange: number,
    reason: string
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const profile = this.npcProfiles.get(npcId);
      if (!profile) {
        return {
          success: false,
          errors: [`NPC ${npcId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: 1,
        currentLocation: this.getCurrentLocation(),
        relatedNPC: profile.name,
        difficulty: 'medium',
        plotType: 'side',
        eventType: 'relationship_change',
        npcPersonality: profile.personality,
        relationshipChange,
        reason,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:relationship', { 
          quest, 
          npcId, 
          npcName: profile.name,
          relationshipChange,
          reason 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NPCDirector] 关系任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 获取当前地点（从 NPC 状态推断）
   */
  private getCurrentLocation(): string {
    const presentNPCs = this.getPresentNPCIds();
    if (presentNPCs.length > 0) {
      const firstNPC = presentNPCs[0];
      const scheduleState = this.getNPCScheduleState(firstNPC);
      if (scheduleState?.location) {
        return scheduleState.location;
      }
    }
    return '未知地点';
  }

  /**
   * 根据玩家行为确定任务类型
   */
  private determinePlotType(playerAction: string, relationship?: number): 'story' | 'side' | 'daily' {
    if (relationship && relationship > 80) {
      return 'story';
    }
    
    const actionLower = playerAction.toLowerCase();
    if (actionLower.includes('紧急') || actionLower.includes('危险') || actionLower.includes('战斗')) {
      return 'story';
    }
    
    if (actionLower.includes('日常') || actionLower.includes('小忙')) {
      return 'daily';
    }
    
    return 'side';
  }

  /**
   * 设置事件总线（用于解耦）
   */
  setEventBus(eventBus: { 
    emit: (
      type: string, 
      payload?: Record<string, unknown>, 
      source?: 'engine' | 'agent' | 'player' | 'system' | 'world-keeper'
    ) => void 
  }) {
    this.eventBus = eventBus;
  }
}
