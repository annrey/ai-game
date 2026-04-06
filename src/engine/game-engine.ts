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
import { ItemValidator } from '../validators/item-validator.js';
import { QuestValidator } from '../validators/quest-validator.js';
import type { SceneState, Quest } from '../types/scene.js';
import type { GameMode, Achievement, AchievementType, GameConfig } from '../types/game.js';
import type { AgentRole, AgentResponse } from '../types/agent.js';
import type { GameAgent } from '../types/agent.js';
import type { Item, ItemType } from '../types/economy.js';
import type { ItemGenerationContext, QuestGenerationContext } from '../types/validator.js';
import { v4 as uuidv4 } from 'uuid';
import { TIME, MEMORY, TEMPERATURE, COMMANDS, GAME } from '../constants.js';

/** 预定义成就列表 */
const ACHIEVEMENTS: Achievement[] = [
  // 剧情成就
  { id: 'first_step', name: '第一步', description: '完成第一次行动', type: 'story', icon: '🌟' },
  { id: 'story_beginner', name: '故事开始', description: '完成第10个回合', type: 'story', icon: '📖' },
  { id: 'story_enthusiast', name: '故事爱好者', description: '完成第50个回合', type: 'story', icon: '📚' },
  { id: 'legend', name: '传说', description: '完成第100个回合', type: 'story', icon: '🏆' },
  // 探索成就
  { id: 'explorer', name: '探索者', description: '访问3个不同地点', type: 'exploration', icon: '🗺️', maxProgress: 3 },
  { id: 'world_traveler', name: '世界旅人', description: '访问10个不同地点', type: 'exploration', icon: '🌍', maxProgress: 10 },
  // 战斗成就
  { id: 'first_blood', name: '初战', description: '参与第一次战斗', type: 'combat', icon: '⚔️' },
  { id: 'victory', name: '胜利', description: '赢得一场战斗', type: 'combat', icon: '🛡️' },
  // 社交成就
  { id: 'socialite', name: '社交达人', description: '与5个不同NPC对话', type: 'social', icon: '💬', maxProgress: 5 },
  { id: 'diplomat', name: '外交官', description: '与10个不同NPC对话', type: 'social', icon: '🤝', maxProgress: 10 },
  // 收集成就
  { id: 'collector', name: '收藏家', description: '获得5件不同物品', type: 'collection', icon: '🎒', maxProgress: 5 },
  { id: 'treasure_hunter', name: '寻宝猎人', description: '获得15件不同物品', type: 'collection', icon: '💎', maxProgress: 15 },
  // 特殊成就
  { id: 'night_owl', name: '夜猫子', description: '在夜晚进行行动', type: 'special', icon: '🌙' },
  { id: 'survivor', name: '幸存者', description: '在生命值低于20%时存活', type: 'special', icon: '❤️' },
  { id: 'master', name: '大师', description: '解锁所有非隐藏成就', type: 'special', icon: '👑', secret: true },
];

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

  // 成就系统
  private unlockedAchievements = new Set<string>();
  private achievementProgress = new Map<string, number>();
  private uniqueNPCsMet = new Set<string>();
  private uniqueItemsCollected = new Set<string>();
  private uniqueLocationsVisited = new Set<string>();

  // 任务生成系统
  private questValidator: QuestValidator;

  // 物品生成系统
  private itemValidator: ItemValidator;

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
    this.questValidator = new QuestValidator();
    this.itemValidator = new ItemValidator();

    this.initAgents();
    this.setupEventHandlers();
    this.startAutoWorldTick();
    this.setupQuestEventHandlers();
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

  private setupQuestEventHandlers(): void {
    this.eventBus.on('quest:generated', (event) => {
      const { quest, source } = event.payload as { quest: Quest; source: string };
      if (this.config.logging) {
        console.log(`[Quest] 新任务生成：${quest.title} (来源：${source})`);
      }
    });

    this.eventBus.on('quest:player_action_trigger', (event) => {
      const { action, quest } = event.payload as { action: string; quest?: Quest };
      if (this.config.logging && quest) {
        console.log(`[Quest] 玩家行为触发任务：${action} → ${quest.title}`);
      }
    });

    this.eventBus.on('quest:story_trigger', (event) => {
      const { plot, quest } = event.payload as { plot: string; quest?: Quest };
      if (this.config.logging && quest) {
        console.log(`[Quest] 剧情触发任务：${plot} → ${quest.title}`);
      }
    });

    this.eventBus.on('quest:random_trigger', (event) => {
      const { quest } = event.payload as { quest?: Quest };
      if (this.config.logging && quest) {
        console.log(`[Quest] 随机事件触发任务：${quest.title}`);
      }
    });
  }

  private async resolveActionAndPushState(playerInput: string, narrative: string, context: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    const prompt = `你是一个游戏状态解析器。根据玩家的自然语言行动和主叙述者的回应，判断游戏状态发生了什么变化。
玩家输入："${playerInput}"
叙述者回应："${narrative}"
当前场景：${context.location}

请提取以下状态变化（如果未发生变化则设为null或忽略）：
1. locationChange: 如果玩家移动到了新地点或探索发现了新区域，返回 {"name": "新地点名称", "description": "新地点的简单描述"}。
2. timeAdvanceMinutes: 如果行动消耗了时间，返回消耗的分钟数（数字），否则返回0。
3. environmentChange: 如果天气或环境改变，返回 {"weather": "新天气", "lighting": "新光照"}。
4. inventoryChange: 如果玩家获得或失去了物品，返回 {"item": "物品名称", "action": "add" 或 "remove", "quantity": 数量, "description": "物品描述"}。可以是一个对象或对象数组。
5. questUpdate: 如果任务状态改变（接到新任务、完成或失败），返回 {"questId": "任务唯一标识", "title": "任务标题", "status": "active"、"completed" 或 "failed", "description": "任务描述"}。可以是一个对象或对象数组。

返回严格的 JSON 格式，不要包含 Markdown 格式化。例如：
{"locationChange": {"name": "新地点", "description": "描述"}, "timeAdvanceMinutes": 10, "inventoryChange": [{"item": "铁剑", "action": "add", "quantity": 1}], "questUpdate": {"questId": "goblin", "title": "清理哥布林", "status": "active"}}`;

    let responseContent: string | undefined;

    try {
      const provider = this.providerFactory.getForAgent('rule-arbiter');
      const response = await provider.provider.chat([{ role: 'system', content: prompt }], { model: provider.model, responseFormat: 'json', temperature: TEMPERATURE.STATE_PARSE });
      responseContent = response.content;
      const parsed = JSON.parse(responseContent);

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
      console.error('[State Parse Error] JSON解析失败:', errorMessage);
      console.error('[State Parse Error] 原始响应内容:', responseContent || '无响应内容');
      console.error('[State Parse Error] 玩家输入:', playerInput);
      console.error('[State Parse Error] 当前场景:', context.location);

      return {
        success: false,
        error: `状态解析失败: ${errorMessage}`
      };
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

    // 检查成就
    this.checkTurnAchievements();
    this.checkSpecialAchievements();

    // 检查地点成就
    const state = this.stateStore.getState();
    this.checkLocationAchievements(state.currentLocation);

    // 检查NPC成就
    for (const npc of state.presentNPCs) {
      this.checkNPCAchievements(npc.name);
    }

    // 检查物品成就
    for (const item of state.playerState.inventory) {
      this.checkItemAchievements(item.name);
    }
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

  // ============ 成就系统 ============

  /** 检查并解锁成就 */
  private unlockAchievement(achievementId: string): void {
    if (this.unlockedAchievements.has(achievementId)) return;

    this.unlockedAchievements.add(achievementId);
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (achievement) {
      this.eventBus.emit('achievement:unlocked', { achievement }, 'engine');
    }

    // 检查大师成就
    this.checkMasterAchievement();
  }

  /** 更新成就进度 */
  private updateAchievementProgress(achievementId: string, progress: number): void {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement || this.unlockedAchievements.has(achievementId)) return;

    const currentProgress = this.achievementProgress.get(achievementId) || 0;
    const newProgress = Math.min(progress, achievement.maxProgress || 1);
    this.achievementProgress.set(achievementId, newProgress);

    if (newProgress >= (achievement.maxProgress || 1)) {
      this.unlockAchievement(achievementId);
    }
  }

  /** 更新物品进度并触发成就检查 */
  updateItemProgress(itemName: string): void {
    this.uniqueItemsCollected.add(itemName);
    this.updateAchievementProgress('collector', this.uniqueItemsCollected.size);
    this.updateAchievementProgress('treasure_hunter', this.uniqueItemsCollected.size);
  }

  /** 检查大师成就 */
  private checkMasterAchievement(): void {
    const nonSecretAchievements = ACHIEVEMENTS.filter(a => !a.secret);
    const allUnlocked = nonSecretAchievements.every(a => this.unlockedAchievements.has(a.id));
    if (allUnlocked) {
      this.unlockAchievement('master');
    }
  }

  /** 检查回合相关成就 */
  private checkTurnAchievements(): void {
    if (this.turnCount >= 1) this.unlockAchievement('first_step');
    if (this.turnCount >= 10) this.unlockAchievement('story_beginner');
    if (this.turnCount >= 50) this.unlockAchievement('story_enthusiast');
    if (this.turnCount >= 100) this.unlockAchievement('legend');
  }

  /** 检查地点相关成就 */
  private checkLocationAchievements(location: string): void {
    this.uniqueLocationsVisited.add(location);
    this.updateAchievementProgress('explorer', this.uniqueLocationsVisited.size);
    this.updateAchievementProgress('world_traveler', this.uniqueLocationsVisited.size);
  }

  /** 检查NPC相关成就 */
  private checkNPCAchievements(npcName: string): void {
    this.uniqueNPCsMet.add(npcName);
    this.updateAchievementProgress('socialite', this.uniqueNPCsMet.size);
    this.updateAchievementProgress('diplomat', this.uniqueNPCsMet.size);
  }

  /** 检查物品相关成就 */
  private checkItemAchievements(itemName: string): void {
    this.uniqueItemsCollected.add(itemName);
    this.updateAchievementProgress('collector', this.uniqueItemsCollected.size);
    this.updateAchievementProgress('treasure_hunter', this.uniqueItemsCollected.size);
  }

  /** 检查战斗相关成就 */
  private checkCombatAchievements(isVictory: boolean): void {
    this.unlockAchievement('first_blood');
    if (isVictory) this.unlockAchievement('victory');
  }

  /** 检查特殊成就 */
  private checkSpecialAchievements(): void {
    const state = this.stateStore.getState();
    const hour = state.worldTime.hour;

    // 夜猫子成就
    if (hour >= 22 || hour < 5) {
      this.unlockAchievement('night_owl');
    }

    // 幸存者成就
    const healthPercent = (state.playerState.health / state.playerState.maxHealth) * 100;
    if (healthPercent < 20 && healthPercent > 0) {
      this.unlockAchievement('survivor');
    }
  }

  /** 获取所有成就状态 */
  getAchievements(): Achievement[] {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlockedAt: this.unlockedAchievements.has(a.id) ? new Date().toISOString() : undefined,
      progress: this.achievementProgress.get(a.id) || (this.unlockedAchievements.has(a.id) ? a.maxProgress || 1 : 0),
    }));
  }

  /** 获取已解锁成就数量 */
  getUnlockedAchievementCount(): { total: number; unlocked: number } {
    const nonSecret = ACHIEVEMENTS.filter(a => !a.secret);
    return {
      total: nonSecret.length,
      unlocked: nonSecret.filter(a => this.unlockedAchievements.has(a.id)).length,
    };
  }

  // ============ 任务生成系统 ============

  /**
   * 创建任务
   * @param quest 任务对象
   * @returns 验证结果和创建的任务
   */
  async createQuest(quest: Quest): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const validation = this.questValidator.validateQuest(quest);
    
    if (!validation.valid) {
      console.error('[QuestValidator] 任务验证失败:', validation.errors);
      return {
        success: false,
        errors: validation.errors,
      };
    }

    this.sceneManager.updateQuest({
      questId: quest.questId,
      title: quest.title,
      status: quest.status,
      description: quest.description,
    });

    this.eventBus.emit('quest:generated', { quest, source: 'engine' }, 'engine');
    
    return {
      success: true,
      quest,
    };
  }

  /**
   * 根据事件生成任务
   * @param eventType 事件类型（如 'help_npc', 'explore_location', 'combat'）
   * @param context 事件上下文
   * @returns 生成的任务或错误
   */
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

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[QuestGeneration] 事件任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 生成随机任务
   * @param context 任务生成上下文
   * @returns 生成的任务或错误
   */
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

      return {
        success: true,
        quest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[QuestGeneration] 随机任务生成失败:', errorMessage);
      return {
        success: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * 获取任务验证器（供其他模块使用）
   */
  getQuestValidator(): QuestValidator {
    return this.questValidator;
  }

  // ============ 任务生成触发器 ============

  /**
   * 玩家行为触发任务生成
   * @param action 玩家行为类型（如 'help_npc', 'explore_location', 'combat', 'trade'）
   * @param context 行为上下文
   * @returns 生成的任务或错误
   */
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

  /**
   * 剧情发展触发任务生成
   * @param plotId 剧情点 ID
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async triggerQuestFromStory(
    plotId: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      currentLocation?: string;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const dramaCurator = this.agents.get('drama-curator') as DramaCurator;
    if (!dramaCurator) {
      return {
        success: false,
        errors: ['DramaCurator 未启用'],
      };
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

  /**
   * 随机事件触发任务生成
   * @param context 上下文
   * @returns 生成的任务或错误
   */
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

  /**
   * NPC 交互触发任务生成
   * @param npcId NPC 标识
   * @param playerAction 玩家行为
   * @param context 上下文
   * @returns 生成的任务或错误
   */
  async triggerQuestFromNPCInteraction(
    npcId: string,
    playerAction: string,
    context: {
      playerLevel?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      relationship?: number;
    } = {}
  ): Promise<{ success: boolean; quest?: Quest; errors?: string[] }> {
    const npcDirector = this.agents.get('npc-director') as NPCDirector;
    if (!npcDirector) {
      return {
        success: false,
        errors: ['NPCDirector 未启用'],
      };
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

  /**
   * 探索地点触发任务生成
   * @param location 地点名称
   * @param context 上下文
   * @returns 生成的任务或错误
   */
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

  /**
   * 战斗事件触发任务生成
   * @param enemyType 敌人类型
   * @param context 上下文
   * @returns 生成的任务或错误
   */
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

  /**
   * 定时触发随机任务（可配置概率）
   * @param probability 触发概率（0-1 之间，默认 0.1 即 10%）
   * @param context 上下文
   * @returns 生成的任务或 null（未触发）
   */
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

  // ============ 物品创造系统 ============

  /**
   * 创建物品
   * @param item 要创建的物品
   * @param addToInventory 是否添加到玩家背包
   * @returns 创建结果
   */
  createItem(item: Item, addToInventory: boolean = true): {
    success: boolean;
    message: string;
    item?: Item;
  } {
    const validation = this.itemValidator.validateItem(item);
    if (!validation.valid) {
      return {
        success: false,
        message: `物品验证失败：${validation.errors.join(', ')}`,
      };
    }

    if (validation.warnings.length > 0) {
      console.warn('[ItemValidator] 警告:', validation.warnings.join(', '));
    }

    if (addToInventory) {
      this.sceneManager.updateInventoryItem({
        name: item.name,
        action: 'add',
        quantity: 1,
        description: item.description,
      });
      this.updateItemProgress(item.name);
    }

    this.eventBus.emit('item:created', { item, reason: 'system' }, 'engine');

    return {
      success: true,
      message: `成功创建物品：${item.name}`,
      item,
    };
  }

  /**
   * 从任务奖励生成物品
   * @param context 物品生成上下文
   * @returns 生成的物品
   */
  async generateItemFromReward(context: {
    questId?: string;
    playerLevel?: number;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemType?: ItemType;
  }): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'reward',
        relatedQuest: context.questId,
      } as ItemGenerationContext);

      const result = this.createItem(item, true);
      
      if (result.success) {
        this.eventBus.emit('item:reward', { item, questId: context.questId }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成任务奖励物品失败：${errorMessage}`,
      };
    }
  }

  /**
   * 从探索发现生成物品
   * @param context 物品生成上下文
   * @returns 生成的物品
   */
  async generateItemFromDiscovery(context: {
    location?: string;
    playerLevel?: number;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemType?: ItemType;
  }): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'discovery',
      } as ItemGenerationContext);

      const result = this.createItem(item, true);

      if (result.success) {
        this.eventBus.emit('item:discovered', { item, location: context.location }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成探索发现物品失败：${errorMessage}`,
      };
    }
  }

  /**
   * 从 NPC 赠与生成物品
   * @param npcId NPC ID
   * @param npcName NPC 名称
   * @param context 物品生成上下文
   * @returns 生成的物品
   */
  async generateItemFromGift(
    npcId: string,
    npcName: string,
    context: {
      playerLevel?: number;
      rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
      itemType?: ItemType;
    }
  ): Promise<{
    success: boolean;
    message: string;
    item?: Item;
  }> {
    try {
      const item = await this.itemValidator.generateItem({
        itemType: context.itemType || 'misc',
        rarity: context.rarity || 'common',
        playerLevel: context.playerLevel || 1,
        reason: 'gift',
      } as ItemGenerationContext);

      const result = this.createItem(item, true);

      if (result.success) {
        this.eventBus.emit('item:gift', { item, npcId, npcName }, 'engine');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `生成 NPC 赠与物品失败：${errorMessage}`,
      };
    }
  }
}
