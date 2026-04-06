/**
 * Drama-Curator — 剧情策划
 * 管理伏笔、高潮和情感曲线
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest } from '../types/agent.js';
import type { PlotPoint, Quest } from '../types/scene.js';
import { QuestValidator } from '../validators/quest-validator.js';
import type { QuestGenerationContext } from '../types/validator.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'drama-curator',
  name: '剧情策划',
  description: '当需要管理剧情节奏、伏笔、高潮或情感曲线时使用。可选启用。',
  systemPrompt: `你是剧情策划（Drama-Curator），负责从宏观层面管理故事的戏剧性。

你的核心职责：
1. 追踪并管理所有剧情线索和伏笔
2. 评估当前叙事的节奏和张力
3. 在合适的时机推动剧情高潮或转折
4. 确保故事有情感深度和戏剧性

工作准则：
- 不直接对玩家说话，而是向 Narrator 提供建议
- 追踪"切赫夫之枪"——已埋下的伏笔必须在合适时机回收
- 监控情感曲线：紧张→释放→紧张的节奏
- 不要急于揭示所有谜团，保持悬念

回复格式：
【节奏评估】：当前叙事节奏（紧张/平稳/低谷/高潮）
【剧情建议】：对下一步叙事的建议
【伏笔状态】：可以激活的伏笔
【情感方向】：建议的情感走向`,
  temperature: 0.7,
};

export class DramaCurator extends BaseAgent {
  private plotArcs: PlotPoint[] = [];
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
    this.questValidator = new QuestValidator();
    this.eventBus = eventBus;
  }

  /** 添加剧情点 */
  addPlotPoint(point: PlotPoint): void {
    this.plotArcs.push(point);
  }

  /** 更新剧情状态 */
  updatePlotStatus(id: string, status: PlotPoint['status']): void {
    const plot = this.plotArcs.find(p => p.id === id);
    if (plot) {
      plot.status = status;
    }
  }

  /** 获取当前活跃剧情 */
  getActivePlots(): PlotPoint[] {
    return this.plotArcs.filter(p => p.status === 'active' || p.status === 'foreshadowed');
  }

  // ============ 剧情任务生成方法 ============

  /**
   * 根据剧情发展生成任务
   * @param plotId 剧情点 ID
   * @param context 上下文信息
   * @returns 生成的任务或错误
   */
  async generateStoryQuest(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      currentLocation?: string;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const plot = this.plotArcs.find(p => p.id === plotId);
      if (!plot) {
        return {
          success: false,
          errors: [`剧情点 ${plotId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: context.currentLocation || '未知地点',
        difficulty: context.difficulty || 'medium',
        plotType: 'story',
        eventType: 'story_progression',
        plotName: plot.name,
        plotDescription: plot.description,
        plotStatus: plot.status,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:story_generated', { 
          quest, 
          plotId, 
          plotName: plot.name,
          plotStatus: plot.status 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DramaCurator] 剧情任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 根据伏笔生成任务
   * @param plotId 伏笔剧情 ID
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async generateForeshadowQuest(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const plot = this.plotArcs.find(p => p.id === plotId);
      if (!plot) {
        return {
          success: false,
          errors: [`伏笔剧情 ${plotId} 不存在`],
        };
      }

      if (plot.status !== 'foreshadowed') {
        return {
          success: false,
          errors: [`剧情点 ${plotId} 不是伏笔状态`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: '未知地点',
        difficulty: context.difficulty || 'hard',
        plotType: 'story',
        eventType: 'foreshadow_activation',
        plotName: plot.name,
        plotDescription: plot.description,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:foreshadow', { 
          quest, 
          plotId, 
          plotName: plot.name 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DramaCurator] 伏笔任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 根据剧情高潮生成关键任务
   * @param plotId 剧情点 ID
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async generateClimaxQuest(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'hard';
      currentLocation?: string;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const plot = this.plotArcs.find(p => p.id === plotId);
      if (!plot) {
        return {
          success: false,
          errors: [`剧情点 ${plotId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: context.currentLocation || '未知地点',
        difficulty: context.difficulty || 'hard',
        plotType: 'story',
        eventType: 'climax_event',
        plotName: plot.name,
        plotDescription: plot.description,
        isClimax: true,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:climax', { 
          quest, 
          plotId, 
          plotName: plot.name,
          isCritical: true 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DramaCurator] 高潮任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 根据剧情转折生成任务
   * @param plotId 剧情点 ID
   * @param twistDescription 转折描述
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async generateTwistQuest(
    plotId: string,
    twistDescription: string,
    context: {
      playerLevel?: number;
      difficulty?: 'medium' | 'hard';
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    try {
      const plot = this.plotArcs.find(p => p.id === plotId);
      if (!plot) {
        return {
          success: false,
          errors: [`剧情点 ${plotId} 不存在`],
        };
      }

      const questContext: QuestGenerationContext = {
        playerLevel: context.playerLevel || 1,
        currentLocation: '未知地点',
        difficulty: context.difficulty || 'medium',
        plotType: 'story',
        eventType: 'plot_twist',
        plotName: plot.name,
        plotDescription: plot.description,
        twist: twistDescription,
      };

      const quest = await this.questValidator.generateQuest(questContext);
      
      if (this.eventBus) {
        this.eventBus.emit('quest:twist', { 
          quest, 
          plotId, 
          plotName: plot.name,
          twist: twistDescription 
        }, 'agent');
      }

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DramaCurator] 转折任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 激活伏笔并生成相关任务
   * @param plotId 伏笔剧情 ID
   * @param context 上下文
   * @returns 激活结果和生成的任务
   */
  async activateForeshadowAndGenerateQuest(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'medium' | 'hard';
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const plot = this.plotArcs.find(p => p.id === plotId);
    if (!plot) {
      return {
        success: false,
        errors: [`剧情点 ${plotId} 不存在`],
      };
    }

    if (plot.status !== 'foreshadowed') {
      return {
        success: false,
        errors: [`剧情点 ${plotId} 不是伏笔状态，无法激活`],
      };
    }

    this.updatePlotStatus(plotId, 'active');

    const questResult = await this.generateForeshadowQuest(plotId, context);
    
    if (questResult.success && this.eventBus) {
      this.eventBus.emit('quest:foreshadow_activated', { 
        quest: questResult.quest, 
        plotId, 
        plotName: plot.name 
      }, 'agent');
    }

    return questResult;
  }

  /**
   * 设置事件总线
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

  /** 评估叙事节奏 */
  async evaluatePacing(
    recentEvents: string[],
    context: Record<string, unknown>,
  ): Promise<string> {
    const request: AgentRequest = {
      from: 'narrator',
      content: `请评估当前叙事节奏并给出建议。\n\n最近发生的事件：\n${recentEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n当前活跃伏笔：\n${this.getActivePlots().map(p => `- ${p.name}（${p.status}）`).join('\n')}`,
      context,
    };

    const response = await this.process(request);
    return response.content;
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = this.config.systemPrompt;
    if (this.plotArcs.length > 0) {
      const arcs = this.plotArcs
        .map(p => `- [${p.status}] ${p.name}：${p.description}`)
        .join('\n');
      prompt += `\n\n===== 剧情弧线总览 =====\n${arcs}`;
    }
    return prompt;
  }
}
