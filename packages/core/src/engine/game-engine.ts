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
import { MemoryManager } from '@openclaw/memory';
import { ItemManager } from './item-manager.js';
import { AchievementManager } from './achievement-manager.js';
import { QuestManager } from './quest-manager.js';
import type { SceneState, Quest } from '@openclaw/shared-types';
import type { GameMode, Achievement, AchievementType, GameConfig } from '@openclaw/shared-types';
import type { AgentRole, AgentResponse } from '@openclaw/shared-types';
import type { GameAgent } from '@openclaw/shared-types';
import type { Item, ItemType } from '@openclaw/shared-types';
import type { ItemGenerationContext, QuestGenerationContext } from '@openclaw/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { TIME, MEMORY, TEMPERATURE, COMMANDS, GAME } from '../constants.js';


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

  // 自动世界演化相关
  private lastPlayerActionTime = Date.now();
  private autoWorldTickTimer: NodeJS.Timeout | null = null;
  private isAutoTicking = false;

  // 各类管理器
  private achievementManager: AchievementManager;
  private questManager: QuestManager;
  private itemManager: ItemManager;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.providerFactory = options.providerFactory;
    this.eventBus = new EventBus();
    this.stateStore = new StateStore(options.dataPath, options.initialState);
    this.sceneManager = new SceneManager(this.eventBus, this.stateStore);
    this.memoryManager = new MemoryManager({
      dbPath: options.memoryDbPath,
      sessionId: options.sessionId ?? `session-${Date.now()}`,
      maxContextChars: options.config.memoryMaxContextChars,
    });
    this.initAgents();
    this.achievementManager = new AchievementManager(this.eventBus, this.stateStore);
    this.questManager = new QuestManager({
      eventBus: this.eventBus,
      stateStore: this.stateStore,
      sceneManager: this.sceneManager,
      getAgent: (role) => this.agents.get(role as any),
      logging: typeof this.config.logging === 'boolean' ? this.config.logging : this.config.logging?.enabled || false
    });
    this.itemManager = new ItemManager({
      eventBus: this.eventBus,
      sceneManager: this.sceneManager
    });

    this.setupEventHandlers();
    this.startAutoWorldTick();
  }

  /** 启动自动世界演化定时器 */
  private startAutoWorldTick(): void {
    if (this.autoWorldTickTimer) {
      clearInterval(this.autoWorldTickTimer);
    }

    // 每秒检查一次是否需要自动演化
    this.autoWorldTickTimer = setInterval(() => {
      this.checkAutoWorldTick();
    }, 1000);
  }

  /** 停止自动世界演化定时器 */
  private stopAutoWorldTick(): void {
    if (this.autoWorldTickTimer) {
      clearInterval(this.autoWorldTickTimer);
      this.autoWorldTickTimer = null;
    }
  }

  /** 检查是否需要执行自动世界演化 */
  private async checkAutoWorldTick(): Promise<void> {
    if (!this.config.autoWorldTick || this.isAutoTicking) {
      return;
    }

    const idleTimeout = (this.config.idleTimeout ?? 30) * 1000; // 转换为毫秒
    const elapsed = Date.now() - this.lastPlayerActionTime;

    if (elapsed >= idleTimeout) {
      this.isAutoTicking = true;
      try {
        await this.performAutoWorldTick();
      } finally {
        this.isAutoTicking = false;
        // 重置计时器，避免连续触发
        this.lastPlayerActionTime = Date.now();
      }
    }
  }

  /** 执行自动世界演化 */
  private async performAutoWorldTick(): Promise<void> {
    // 触发世界演化事件
    this.eventBus.emit('world:auto_tick', { turnCount: this.turnCount }, 'engine');

    // 推进游戏时间
    this.sceneManager.advanceTime(TIME.ADVANCE_PER_TURN * 2);

    // 如果有 World Keeper，让它生成世界演化描述
    const worldKeeper = this.agents.get('world-keeper');
    if (worldKeeper && 'generateWorldTick' in worldKeeper) {
      try {
        const context = this.stateStore.getContextSummary();
        const tickDescription = await (worldKeeper as any).generateWorldTick(context);
        if (tickDescription) {
          this.eventBus.emit('world:tick_description', { description: tickDescription }, 'world-keeper');
        }
      } catch (err) {
        console.error('[AutoWorldTick] World Keeper 生成演化描述失败:', err);
      }
    }

    // 记录记忆
    this.memoryManager.remember(
      `世界自动演化: 时间推进，世界在玩家闲置时悄然变化`,
      'event',
      GAME.IMPORTANCE_MEDIUM,
      ['auto_tick', 'world_change'],
    );
  }

  /** 更新玩家最后操作时间 */
  private updateLastActionTime(): void {
    this.lastPlayerActionTime = Date.now();
  }

  private initAgents(): void {
    const enabled = new Set(this.config.enabledAgents);

    // Narrator 永远启用
    const narratorProvider = this.providerFactory.getForAgent('narrator');
    this.narrator = new Narrator(narratorProvider.provider, narratorProvider.model);
    this.narrator.setMaxHistoryTurns(this.config.maxHistoryTurns);

    // 可选代理
    if (enabled.has('world-keeper')) {
      const wp = this.providerFactory.getForAgent('world-keeper');
      const wk = new WorldKeeper(wp.provider, wp.model);
      wk.setMaxHistoryTurns(this.config.maxHistoryTurns);
      this.agents.set('world-keeper', wk);
      this.narrator.registerSubAgent(wk);
    }

    if (enabled.has('npc-director')) {
      const np = this.providerFactory.getForAgent('npc-director');
      const nd = new NPCDirector(np.provider, np.model, undefined, this.eventBus);
      nd.setMaxHistoryTurns(this.config.maxHistoryTurns);
      this.agents.set('npc-director', nd);
      this.narrator.registerSubAgent(nd);
    }

    if (enabled.has('rule-arbiter')) {
      const rp = this.providerFactory.getForAgent('rule-arbiter');
      const ra = new RuleArbiter(rp.provider, rp.model);
      ra.setMaxHistoryTurns(this.config.maxHistoryTurns);
      this.agents.set('rule-arbiter', ra);
      this.narrator.registerSubAgent(ra);
    }

    if (enabled.has('drama-curator')) {
      const dp = this.providerFactory.getForAgent('drama-curator');
      const dc = new DramaCurator(dp.provider, dp.model, undefined, this.eventBus);
      dc.setMaxHistoryTurns(this.config.maxHistoryTurns);
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

    // 物品事件处理
    this.eventBus.on(GameEvents.ITEM_CREATED, (event) => {
      if (this.config.logging) {
        const payload = event.payload as any;
        console.log(`[Item] 创建：${payload.item?.name}`);
      }
    });

    this.eventBus.on(GameEvents.ITEM_REWARD, (event) => {
      if (this.config.logging) {
        const payload = event.payload as any;
        console.log(`[Item] 任务奖励：${payload.item?.name}, 任务 ID: ${payload.questId}`);
      }
    });

    this.eventBus.on(GameEvents.ITEM_DISCOVERED, (event) => {
      if (this.config.logging) {
        const payload = event.payload as any;
        console.log(`[Item] 探索发现：${payload.item?.name}, 地点：${payload.location}`);
      }
    });

    this.eventBus.on(GameEvents.ITEM_GIFT, (event) => {
      if (this.config.logging) {
        const payload = event.payload as any;
        console.log(`[Item] NPC 赠与：${payload.item?.name}, NPC: ${payload.npcName}`);
      }
    });
  }

  private async resolveActionAndPushState(playerInput: string, narrative: string, context: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    try {
      const ruleArbiter = this.agents.get('rule-arbiter') as RuleArbiter;
      if (!ruleArbiter) {
        return { success: false, error: 'RuleArbiter 未启用' };
      }

      const parsed = await ruleArbiter.parseStateChange(playerInput, narrative, context);

      if (parsed.locationChange && parsed.locationChange.name) {
        this.sceneManager.changeLocation(parsed.locationChange.name, parsed.locationChange.description || '');
      }
      if (parsed.timeAdvanceMinutes && typeof parsed.timeAdvanceMinutes === 'number' && parsed.timeAdvanceMinutes > 0) {
        this.sceneManager.advanceTime(parsed.timeAdvanceMinutes);
      }
      if (parsed.environmentChange) {
        this.sceneManager.updateEnvironment(parsed.environmentChange);
      }
      if (parsed.inventoryChange) {
        const changes = Array.isArray(parsed.inventoryChange) ? parsed.inventoryChange : [parsed.inventoryChange];
        changes.forEach((change: any) => {
          if (change && change.item && change.action && change.quantity) {
            this.sceneManager.updateInventoryItem({ name: change.item, action: change.action, quantity: change.quantity, description: change.description });
          }
        });
      }
      if (parsed.questUpdate) {
        const updates = Array.isArray(parsed.questUpdate) ? parsed.questUpdate : [parsed.questUpdate];
        updates.forEach((update: any) => {
          if (update && update.questId && update.title && update.status) {
            this.sceneManager.updateQuest({ questId: update.questId, title: update.title, status: update.status, description: update.description });
          }
        });
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[State Parse Error] 解析失败:', errorMessage);
      return { success: false, error: `状态解析失败: ${errorMessage}` };
    }
  }

  /** 准备回合上下文（提取的公共方法） */
  private prepareTurnContext(playerInput: string): { isIdle: boolean; actualInput: string; context: Record<string, unknown> } {
    this.turnCount++;
    this.memoryManager.setTurn(this.turnCount);

    // 更新玩家最后操作时间
    this.updateLastActionTime();

    const isIdle = playerInput === COMMANDS.IDLE;
    const actualInput = isIdle ? COMMANDS.IDLE_DESCRIPTION_STREAM : playerInput;

    // 记录玩家行动
    this.sceneManager.recordAction('custom', actualInput);

    // 每 N 回合推进游戏时间；如果是 idle 状态，额外推进时间
    if (this.turnCount % TIME.TURN_INTERVAL === 0) {
      this.sceneManager.advanceTime(TIME.ADVANCE_PER_TURN);
    }
    if (isIdle) {
      this.sceneManager.advanceTime(TIME.IDLE_EXTRA_MINUTES);
    }

    // 获取场景上下文
    const context = this.stateStore.getContextSummary();

    // 注入相关记忆到上下文
    const memoryContext = this.memoryManager.getContextMemories(actualInput);
    if (memoryContext) {
      context.memories = memoryContext;
    }

    return { isIdle, actualInput, context };
  }

  /** 完成回合处理（提取的公共方法） */
  private async finalizeTurn(actualInput: string, narrative: string, context: Record<string, unknown>): Promise<void> {
    // 解析玩家的自然语言输入，并动态推动游戏进程和场景发展（更新状态）
    await this.resolveActionAndPushState(actualInput, narrative, context);

    // 将本回合的叙事摘要存入记忆
    this.memoryManager.remember(
          `回合${this.turnCount}: 玩家行动「${actualInput}」→ ${narrative.slice(0, MEMORY.SUMMARY_MAX_LENGTH)}`,
          'event',
          this.estimateImportance(actualInput, narrative),
          this.extractTags(actualInput, narrative),
        );

    // 自动存档
    if (this.config.autoSaveInterval && this.config.autoSaveInterval > 0 && this.turnCount % this.config.autoSaveInterval === 0) {
      await this.save(`auto-save-${Date.now()}`);
    }

    // 触发回合结束事件以检查成就
    this.eventBus.emit('engine:turn_ended', { turnCount: this.turnCount }, 'engine');
  }

  /** 处理一回合玩家输入 */
  async processTurn(playerInput: string): Promise<TurnResult> {
    const { actualInput, context } = this.prepareTurnContext(playerInput);

    // 协调所有代理
    const result = await this.narrator.orchestrate(actualInput, context);

    // 完成回合处理
    await this.finalizeTurn(actualInput, result.narrative, context);

    return {
      narrative: result.narrative,
      agentDetails: result.agentResponses,
      stateSnapshot: this.stateStore.getContextSummary(),
    };
  }

  /** 流式处理（包含代理协调） */
  async *processStreamTurn(playerInput: string): AsyncIterable<string> {
    const { actualInput, context } = this.prepareTurnContext(playerInput);

    let full = '';
    for await (const payload of this.narrator.orchestrateStream(actualInput, context)) {
      if (payload.type === 'done') {
        full = payload.full;

        // 完成回合处理（使用 catch 处理异步错误，避免阻塞流）
        this.finalizeTurn(actualInput, full, context).catch(err => console.error('[FinalizeTurn Error]', err));
      }
      yield JSON.stringify(payload) + '\n';
    }
  }

  /** 获取当前状态 */
  getState(): Readonly<SceneState> {
    return this.stateStore.getState();
  }

  getConfig(): Readonly<GameConfig> {
    return this.config;
  }

  /** 获取场景管理器 */
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  /** 获取状态存储 */
  getStateStore(): StateStore {
    return this.stateStore;
  }

  /** 获取事件总线 */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /** 保存游戏 */
  async save(name: string): Promise<string> {
    return this.stateStore.save(name, this.config.mode);
  }

  async listSaves(limit?: number): Promise<Array<{ id: string; name: string; mode: GameMode; createdAt: string; updatedAt: string }>> {
    return this.stateStore.listSaves(limit);
  }

  /** 加载游戏 */
  async load(saveId: string): Promise<void> {
    await this.stateStore.load(saveId);
  }

  /** 删除存档 */
  async deleteSave(saveId: string): Promise<void> {
    await this.stateStore.deleteSave(saveId);
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

  clearMemories(): void {
    this.memoryManager.clearSession();
  }

  bootstrapWorld(input: {
    worldName?: string;
    genre?: string;
    tone?: string;
    conflict?: string;
    location?: string;
    locationDescription?: string;
    weather?: string;
    playerName?: string;
    playerRole?: string;
    playerBackground?: string;
  }): void {
    this.reset();
    const base = createDefaultSceneState();
    const location = input.location?.trim() || `${input.worldName?.trim() || '新世界'}·起点`;
    const locationDescription = input.locationDescription?.trim()
      || [input.worldName, input.genre, input.tone, input.conflict].filter(Boolean).join('，')
      || base.locationDescription;

    base.currentLocation = location;
    base.locationDescription = locationDescription;
    base.environment.weather = input.weather?.trim() || base.environment.weather;
    base.playerState = {
      ...base.playerState,
      name: input.playerName?.trim() || '冒险者',
      role: input.playerRole?.trim() || '旅者',
      background: input.playerBackground?.trim() || '',
      worldName: input.worldName?.trim() || '',
      genre: input.genre?.trim() || '',
      tone: input.tone?.trim() || '',
      visitedLocations: [location],
      explorationProgress: 0,
    };

    if (input.conflict?.trim()) {
      base.activePlots = [{
        id: uuidv4(),
        name: input.conflict.trim(),
        status: 'active',
        description: input.conflict.trim(),
      }];
    }

    this.stateStore.update(base);
  }

  setRuleBook(text: string): void {
    const ra = this.agents.get('rule-arbiter');
    if (ra instanceof RuleArbiter) {
      ra.loadRuleBook(text);
    }
  }

  close(): void {
    this.stopAutoWorldTick();
    this.memoryManager.close();
  }

  /** 评估事件重要性（简单规则） */
  private estimateImportance(playerInput: string, narrative: string): number {
    const combined = (playerInput + narrative).toLowerCase();
    const highImportanceKeywords = ['战斗', '死亡', '发现', '宝藏', 'boss', '关键', '秘密', '背叛', '盟友', '危险'];
    const medImportanceKeywords = ['对话', '交谈', '购买', '出售', '学习', '技能', '探索'];

    let importance: number = GAME.IMPORTANCE_BASE; // 基础重要性
    for (const kw of highImportanceKeywords) {
      if (combined.includes(kw)) { importance = Math.max(importance, GAME.IMPORTANCE_HIGH); break; }
    }
    for (const kw of medImportanceKeywords) {
      if (combined.includes(kw)) { importance = Math.max(importance, GAME.IMPORTANCE_MEDIUM); break; }
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

  // ============ 任务生成系统 ============

  /**
   * 创建任务
   * @param quest 任务对象
   * @returns 验证结果和创建的任务
   */
  async createQuest(quest: Quest): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    return this.questManager.createQuest(quest);
  }

  async generateQuestFromEvent(eventType: string, context: any) {
    return this.questManager.generateQuestFromEvent(eventType, context);
  }

  async generateRandomQuest(context: any = {}) {
    return this.questManager.generateRandomQuest(context);
  }

  getQuestValidator() {
    return this.questManager.getQuestValidator();
  }

  // ============ 任务生成触发器 ============

  /**
   * 玩家行为触发任务生成
   * @param action 玩家行为类型（如 'help_npc', 'explore_location', 'combat', 'trade'）
   * @param context 行为上下文
   * @returns 生成的任务或错误
   */
  async triggerQuestFromPlayerAction(action: string, context: any = {}) {
    return this.questManager.triggerQuestFromPlayerAction(action, context);
  }

  async triggerQuestFromStory(plotId: string, context: any = {}) {
    return this.questManager.triggerQuestFromStory(plotId, context);
  }

  async triggerRandomQuest(context: any = {}) {
    return this.questManager.triggerRandomQuest(context);
  }

  async triggerQuestFromNPCInteraction(npcId: string, playerAction: string, context: any = {}) {
    return this.questManager.triggerQuestFromNPCInteraction(npcId, playerAction, context);
  }

  async triggerQuestFromExploration(location: string, context: any = {}) {
    return this.questManager.triggerQuestFromExploration(location, context);
  }

  async triggerQuestFromCombat(enemyType: string, context: any = {}) {
    return this.questManager.triggerQuestFromCombat(enemyType, context);
  }

  async triggerTimedRandomQuest(probability: number = 0.1, context: any = {}) {
    return this.questManager.triggerTimedRandomQuest(probability, context);
  }

  // ============ 物品创造系统 ============

  createItem(item: Item, addToInventory: boolean = true) {
    return this.itemManager.createItem(item, addToInventory);
  }

  async generateItemFromReward(context: any) {
    return this.itemManager.generateItemFromReward(context);
  }

  async generateItemFromDiscovery(context: any) {
    return this.itemManager.generateItemFromDiscovery(context);
  }

  async generateItemFromGift(npcId: string, npcName: string, context: any) {
    return this.itemManager.generateItemFromGift(npcId, npcName, context);
  }

  // 获取成就（代理给 AchievementManager）
  getAchievements() {
    return this.achievementManager.getAchievements();
  }

  getUnlockedAchievementCount() {
    return this.achievementManager.getUnlockedAchievementCount();
  }
}

