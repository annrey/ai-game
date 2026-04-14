import { EventBus } from './event-bus.js';
import { StateStore } from './state-store.js';
import { SceneManager } from './scene-manager.js';
import { QuestValidator } from '../validators/quest-validator.js';
import type { Quest } from '@openclaw/shared-types';
import type { QuestGenerationContext } from '@openclaw/shared-types';
import type { GameAgent } from '@openclaw/shared-types';
import type { DramaCurator } from '../agents/drama-curator.js';
import type { NPCDirector } from '../agents/npc-director.js';

export interface QuestManagerOptions {
  eventBus: EventBus;
  stateStore: StateStore;
  sceneManager: SceneManager;
  getAgent: (role: string) => GameAgent | undefined;
  logging?: boolean;
}

export class QuestManager {
  private eventBus: EventBus;
  private stateStore: StateStore;
  private sceneManager: SceneManager;
  private getAgent: (role: string) => GameAgent | undefined;
  private questValidator: QuestValidator;
  private logging: boolean;

  constructor(options: QuestManagerOptions) {
    this.eventBus = options.eventBus;
    this.stateStore = options.stateStore;
    this.sceneManager = options.sceneManager;
    this.getAgent = options.getAgent;
    this.logging = options.logging || false;
    this.questValidator = new QuestValidator();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('quest:generated', (event) => {
      const { quest, source } = event.payload as { quest: Quest; source: string };
      if (this.logging) {
        console.log(`[Quest] 新任务生成：${quest.title} (来源：${source})`);
      }
    });

    this.eventBus.on('quest:player_action_trigger', (event) => {
      const { action, quest } = event.payload as { action: string; quest?: Quest };
      if (this.logging && quest) {
        console.log(`[Quest] 玩家行为触发任务：${action} → ${quest.title}`);
      }
    });

    this.eventBus.on('quest:story_trigger', (event) => {
      const { plot, quest } = event.payload as { plot: string; quest?: Quest };
      if (this.logging && quest) {
        console.log(`[Quest] 剧情触发任务：${plot} → ${quest.title}`);
      }
    });

    this.eventBus.on('quest:random_trigger', (event) => {
      const { quest } = event.payload as { quest?: Quest };
      if (this.logging && quest) {
        console.log(`[Quest] 随机事件触发任务：${quest.title}`);
      }
    });
  }

  /** 获取任务验证器 */
  getQuestValidator(): QuestValidator {
    return this.questValidator;
  }

  /** 创建任务 */
  async createQuest(quest: Quest): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const validation = this.questValidator.validateQuest(quest);
    
    if (!validation.valid) {
      console.error('[QuestValidator] 任务验证失败:', validation.errors);
      return { success: false, errors: validation.errors };
    }

    this.sceneManager.updateQuest({
      questId: quest.questId,
      title: quest.title,
      status: quest.status,
      description: quest.description,
    });

    this.eventBus.emit('quest:generated', { quest, source: 'engine' }, 'engine');
    
    return { success: true, quest };
  }

  /** 根据事件生成任务 */
  async generateQuestFromEvent(
    eventType: string,
    context: {
      playerLevel?: number;
      currentLocation?: string;
      relatedNPC?: string;
      difficulty?: 'easy' | 'medium' | 'hard';
      [key: string]: unknown;
    }
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: context.currentLocation || this.stateStore.getState().currentLocation,
        relatedNPC: context.relatedNPC,
        difficulty: context.difficulty || 'medium',
        ...context,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      this.sceneManager.updateQuest({
        questId: quest.questId,
        title: quest.title,
        status: quest.status,
        description: quest.description,
      });

      this.eventBus.emit('quest:player_action_trigger', { 
        action: eventType, 
        quest,
        context 
      }, 'engine');

      return { success: true, quest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[QuestGeneration] 事件任务生成失败:', errorMessage);
      return { success: false, errors: [errorMessage] };
    }
  }

  /** 生成随机任务 */
  async generateRandomQuest(
    context: {
      playerLevel?: number;
      plotType?: 'story' | 'side' | 'daily';
      difficulty?: 'easy' | 'medium' | 'hard';
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const state = this.stateStore.getState();
      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: state.currentLocation,
        difficulty: context.difficulty || 'medium',
        plotType: context.plotType || 'side',
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      this.sceneManager.updateQuest({
        questId: quest.questId,
        title: quest.title,
        status: quest.status,
        description: quest.description,
      });

      this.eventBus.emit('quest:random_trigger', { quest, context }, 'engine');

      return { success: true, quest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[QuestGeneration] 随机任务生成失败:', errorMessage);
      return { success: false, errors: [errorMessage] };
    }
  }

  /** 玩家行为触发任务生成 */
  async triggerQuestFromPlayerAction(
    action: string,
    context: {
      playerLevel?: number;
      currentLocation?: string;
      relatedNPC?: string;
      difficulty?: 'easy' | 'medium' | 'hard';
      [key: string]: unknown;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const state = this.stateStore.getState();
    const mergedContext = {
      playerLevel: context.playerLevel || 1,
      currentLocation: context.currentLocation || state.currentLocation,
      relatedNPC: context.relatedNPC,
      difficulty: context.difficulty || 'medium',
      ...context,
    };

    const result = await this.generateQuestFromEvent(action, mergedContext);
    
    if (result.success && result.quest) {
      this.eventBus.emit('quest:player_action_trigger', {
        action,
        quest: result.quest,
        context: mergedContext,
      }, 'engine');
    }

    return result;
  }

  /** 剧情发展触发任务生成 */
  async triggerQuestFromStory(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      currentLocation?: string;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const dramaCurator = this.getAgent('drama-curator') as DramaCurator | undefined;
    if (!dramaCurator) {
      return { success: false, errors: ['DramaCurator 未启用'] };
    }

    const state = this.stateStore.getState();
    const mergedContext = {
      playerLevel: context.playerLevel || 1,
      currentLocation: context.currentLocation || state.currentLocation,
      difficulty: context.difficulty || 'medium',
      ...context,
    };

    const result = await dramaCurator.generateStoryQuest(plotId, mergedContext);
    
    if (result.success && result.quest) {
      const plot = (dramaCurator as any).plotArcs?.find((p: any) => p.id === plotId);
      this.eventBus.emit('quest:story_trigger', {
        plot: plot?.name || plotId,
        quest: result.quest,
      }, 'agent');
    }

    return result;
  }

  /** 随机事件触发任务生成 */
  async triggerRandomQuest(
    context: {
      playerLevel?: number;
      plotType?: 'story' | 'side' | 'daily';
      difficulty?: 'easy' | 'medium' | 'hard';
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const result = await this.generateRandomQuest(context);
    
    if (result.success && result.quest) {
      this.eventBus.emit('quest:random_trigger', {
        quest: result.quest,
        context,
      }, 'engine');
    }

    return result;
  }

  /** NPC 交互触发任务生成 */
  async triggerQuestFromNPCInteraction(
    npcId: string,
    playerAction: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      relationship?: number;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const npcDirector = this.getAgent('npc-director') as NPCDirector | undefined;
    if (!npcDirector) {
      return { success: false, errors: ['NPCDirector 未启用'] };
    }

    const result = await npcDirector.generateQuestFromNPC(npcId, playerAction, context);
    
    if (result.success && result.quest) {
      const profile = (npcDirector as any).npcProfiles?.get(npcId);
      this.eventBus.emit('quest:npc_interaction', {
        npcId,
        npcName: profile?.name || npcId,
        playerAction,
        quest: result.quest,
      }, 'agent');
    }

    return result;
  }

  /** 探索地点触发任务生成 */
  async triggerQuestFromExploration(
    location: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      isFirstVisit?: boolean;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const state = this.stateStore.getState();
    const isFirstVisit = context.isFirstVisit ?? !state.playerState.visitedLocations.includes(location);
    
    const questType = isFirstVisit ? 'explore_new_location' : 'explore_location';
    const difficulty = isFirstVisit ? 'medium' : (context.difficulty || 'easy');
    
    const result = await this.generateQuestFromEvent(questType, {
      ...context,
      currentLocation: location,
      difficulty,
    });
    
    if (result.success && result.quest) {
      this.eventBus.emit('quest:exploration', {
        location,
        isFirstVisit,
        quest: result.quest,
      }, 'engine');
    }

    return result;
  }

  /** 战斗事件触发任务生成 */
  async triggerQuestFromCombat(
    enemyType: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      isVictory?: boolean;
      enemyCount?: number;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const questType = context.isVictory ? 'combat_victory' : 'combat_encounter';
    
    const result = await this.generateQuestFromEvent(questType, {
      ...context,
      enemyType,
    });
    
    if (result.success && result.quest) {
      this.eventBus.emit('quest:combat', {
        enemyType,
        isVictory: context.isVictory,
        quest: result.quest,
      }, 'engine');
    }

    return result;
  }

  /** 定时触发随机任务 */
  async triggerTimedRandomQuest(
    probability: number = 0.1,
    context: {
      playerLevel?: number;
      plotType?: 'story' | 'side' | 'daily';
    } = {}
  ): Promise<{ triggered: boolean; quest?: Quest; errors?: string[] }> {
    if (Math.random() > probability) {
      return { triggered: false };
    }

    const result = await this.generateRandomQuest(context);
    
    return {
      triggered: result.success,
      quest: result.quest,
      errors: result.errors,
    };
  }
}
