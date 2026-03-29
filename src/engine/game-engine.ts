/**
 * 游戏引擎主控
 * 整合所有模块，提供统一的游戏交互入口
 */

import { EventBus, GameEvents } from './event-bus.js';
import { StateStore, createDefaultSceneState } from './state-store.js';
import { SceneManager } from './scene-manager.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import { Narrator } from '../agents/narrator.js';
import { WorldKeeper } from '../agents/world-keeper.js';
import { NPCDirector } from '../agents/npc-director.js';
import { RuleArbiter } from '../agents/rule-arbiter.js';
import { DramaCurator } from '../agents/drama-curator.js';
import { MemoryManager } from '../memory/memory-manager.js';
import type { GameConfig, GameMode, SceneState } from '../types/game.js';
import type { AgentRole, AgentResponse } from '../types/agent.js';
import type { GameAgent } from '../types/agent.js';

export interface EngineOptions {
  config: GameConfig;
  providerFactory: ProviderFactory;
  dataPath: string;
  initialState?: SceneState;
  /** 记忆系统数据库路径（不传则使用内存数据库） */
  memoryDbPath?: string;
  /** 会话 ID（用于记忆隔离） */
  sessionId?: string;
}

export interface TurnResult {
  narrative: string;
  agentDetails: AgentResponse[];
  stateSnapshot: Record<string, unknown>;
}

export class GameEngine {
  private config: GameConfig;
  private providerFactory: ProviderFactory;
  private eventBus: EventBus;
  private stateStore: StateStore;
  private sceneManager: SceneManager;
  private memoryManager: MemoryManager;

  // 代理
  private narrator!: Narrator;
  private agents = new Map<AgentRole, GameAgent>();

  private turnCount = 0;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.providerFactory = options.providerFactory;
    this.eventBus = new EventBus();
    this.stateStore = new StateStore(options.dataPath, options.initialState);
    this.sceneManager = new SceneManager(this.eventBus, this.stateStore);
    this.memoryManager = new MemoryManager({
      dbPath: options.memoryDbPath,
      sessionId: options.sessionId ?? `session-${Date.now()}`,
    });

    this.initAgents();
    this.setupEventHandlers();
  }

  private initAgents(): void {
    const enabled = new Set(this.config.enabledAgents);

    // Narrator 永远启用
    const narratorProvider = this.providerFactory.getForAgent('narrator');
    this.narrator = new Narrator(narratorProvider.provider, narratorProvider.model);

    // 可选代理
    if (enabled.has('world-keeper')) {
      const wp = this.providerFactory.getForAgent('world-keeper');
      const wk = new WorldKeeper(wp.provider, wp.model);
      this.agents.set('world-keeper', wk);
      this.narrator.registerSubAgent(wk);
    }

    if (enabled.has('npc-director')) {
      const np = this.providerFactory.getForAgent('npc-director');
      const nd = new NPCDirector(np.provider, np.model);
      this.agents.set('npc-director', nd);
      this.narrator.registerSubAgent(nd);
    }

    if (enabled.has('rule-arbiter')) {
      const rp = this.providerFactory.getForAgent('rule-arbiter');
      const ra = new RuleArbiter(rp.provider, rp.model);
      this.agents.set('rule-arbiter', ra);
      this.narrator.registerSubAgent(ra);
    }

    if (enabled.has('drama-curator')) {
      const dp = this.providerFactory.getForAgent('drama-curator');
      const dc = new DramaCurator(dp.provider, dp.model);
      this.agents.set('drama-curator', dc);
      this.narrator.registerSubAgent(dc);
    }
  }

  private setupEventHandlers(): void {
    // 全局事件日志
    this.eventBus.on('*', (event) => {
      if (this.config.logging) {
        console.log(`[Event] ${event.type} from ${event.source}`);
      }
    });

    // 错误处理
    this.eventBus.on(GameEvents.AGENT_ERROR, (event) => {
      console.error(`[Agent Error]`, event.payload);
    });
  }

  /** 处理一回合玩家输入 */
  async processTurn(playerInput: string): Promise<TurnResult> {
    this.turnCount++;
    this.memoryManager.setTurn(this.turnCount);

    // 记录玩家行动
    this.sceneManager.recordAction('custom', playerInput);

    // 每 5 回合推进 30 分钟游戏时间
    if (this.turnCount % 5 === 0) {
      this.sceneManager.advanceTime(30);
    }

    // 获取场景上下文
    const context = this.stateStore.getContextSummary();

    // 注入相关记忆到上下文
    const memoryContext = this.memoryManager.getContextMemories(playerInput);
    if (memoryContext) {
      (context as Record<string, unknown>).memories = memoryContext;
    }

    // 协调所有代理
    const result = await this.narrator.orchestrate(playerInput, context);

    // 将本回合的叙事摘要存入记忆
    this.memoryManager.remember(
      `回合${this.turnCount}: 玩家行动「${playerInput}」→ ${result.narrative.slice(0, 200)}`,
      'event',
      this.estimateImportance(playerInput, result.narrative),
      this.extractTags(playerInput, result.narrative),
    );

    return {
      narrative: result.narrative,
      agentDetails: result.agentResponses,
      stateSnapshot: this.stateStore.getContextSummary(),
    };
  }

  /** 流式处理（仅主叙事） */
  async *processStreamTurn(playerInput: string): AsyncIterable<string> {
    this.turnCount++;
    this.sceneManager.recordAction('custom', playerInput);

    const context = this.stateStore.getContextSummary();

    yield* this.narrator.processStream({
      from: 'player',
      content: playerInput,
      context,
    });
  }

  /** 获取当前状态 */
  getState(): Readonly<SceneState> {
    return this.stateStore.getState();
  }

  /** 获取场景管理器 */
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  /** 获取事件总线 */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /** 保存游戏 */
  async save(name: string): Promise<string> {
    return this.stateStore.save(name, this.config.mode);
  }

  /** 加载游戏 */
  async load(saveId: string): Promise<void> {
    await this.stateStore.load(saveId);
  }

  /** 重置游戏 */
  reset(): void {
    this.stateStore.reset();
    this.narrator.reset();
    for (const agent of this.agents.values()) {
      agent.reset();
    }
    this.eventBus.clearLog();
    this.turnCount = 0;
  }

  /** 获取回合数 */
  getTurnCount(): number {
    return this.turnCount;
  }

  /** 获取记忆管理器 */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  /** 评估事件重要性（简单规则） */
  private estimateImportance(playerInput: string, narrative: string): number {
    const combined = (playerInput + narrative).toLowerCase();
    const highImportanceKeywords = ['战斗', '死亡', '发现', '宝藏', 'boss', '关键', '秘密', '背叛', '盟友', '危险'];
    const medImportanceKeywords = ['对话', '交谈', '购买', '出售', '学习', '技能', '探索'];

    let importance = 0.4; // 基础重要性
    for (const kw of highImportanceKeywords) {
      if (combined.includes(kw)) { importance = Math.max(importance, 0.8); break; }
    }
    for (const kw of medImportanceKeywords) {
      if (combined.includes(kw)) { importance = Math.max(importance, 0.6); break; }
    }
    return importance;
  }

  /** 从文本中提取标签 */
  private extractTags(playerInput: string, narrative: string): string[] {
    const tags: string[] = [];
    const state = this.stateStore.getState();

    // 添加当前位置
    tags.push(state.currentLocation);

    // 添加在场 NPC 名称
    for (const npc of state.presentNPCs) {
      tags.push(npc.name);
    }

    // 提取动作类型关键词
    const actionKeywords = ['战斗', '对话', '探索', '移动', '使用', '检查'];
    for (const kw of actionKeywords) {
      if (playerInput.includes(kw) || narrative.includes(kw)) {
        tags.push(kw);
      }
    }

    return [...new Set(tags)]; // 去重
  }
}
