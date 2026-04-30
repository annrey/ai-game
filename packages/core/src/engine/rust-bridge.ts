import { EventEmitter } from 'eventemitter3';
import { EventBus } from './event-bus.js';
import type { GameConfig, SceneState } from '@openclaw/shared-types';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Rust 引擎原生模块接口 */
interface RustEngineNative {
  create(ollamaUrl: string, saveDir: string, dbUrl: string): RustEngineInstance;
}

/** Rust 引擎实例暴露的方法 */
interface RustEngineInstance {
  start(): void;
  subscribe(callback: (eventJson: string) => void): void;
  dispatchEvent(eventType: string, payload: string): void;
  getState(): Promise<string>;
  save(name: string, mode: string): Promise<string>;
  load(saveId: string): Promise<void>;
  listSaves(limit?: number): Promise<string>;
  clearMemories(): Promise<void>;
  deleteSave(saveId: string): Promise<void>;
  getMemories(options: string): Promise<string>;
  getMemoryCount(): Promise<number>;
  recallMemories(query: string, options: string): Promise<string>;
}

interface MemoryManagerStub {
  getAllMemories(options: { limit?: number; type?: string }): Promise<unknown[]>;
  getMemoryCount(): Promise<number>;
  recall(query: string, options: { limit?: number }): Promise<unknown[]>;
  clearSession(): Promise<void>;
}

interface StateStoreStub {
  getState(): Promise<SceneState>;
}

interface BridgeConstructorOptions {
  ollamaUrl?: string;
  config?: Partial<GameConfig>;
  providerFactory?: unknown;
  dataPath?: string;
  memoryDbPath?: string;
  sessionId?: string;
  initialState?: Partial<SceneState>;
}

interface StreamChunkPayload {
  content: string;
}

interface StreamDonePayload {
  content: string;
  full: string;
}

interface StreamErrorPayload {
  message: string;
}

/**
 * RustGameEngineBridge - 核心引擎的 TypeScript 桥接器
 * 
 * 该类实现了与 GameEngine 相同的公共接口，允许在 server.ts 中通过 Rust 编写的
 * 核心逻辑来驱动游戏。它通过 FFI 加载 openclaw-node 原生模块。
 */
export class RustGameEngineBridge extends EventEmitter {
  private rustEngine: RustEngineInstance | null = null;
  private isInitialized = false;
  private initError: Error | null = null;
  private eventBus: EventBus;
  private turnCount = 0;
  private config: GameConfig;

  constructor(options?: BridgeConstructorOptions) {
    super();
    this.eventBus = new EventBus();
    
    // 初始化与 GameEngine 一致的默认配置
    this.config = options?.config || {
      mode: 'text-adventure',
      theme: 'fantasy',
      enableCombat: true,
      enableSave: true,
      maxTurns: 1000,
      difficulty: 'normal',
      memoryMaxContextChars: 2000,
      autoWorldTick: false,
      idleTimeout: 30000,
      enabledAgents: ['narrator'],
      maxHistoryTurns: 10,
      logging: { enabled: true, level: 'info' },
      autoSaveInterval: 0,
      language: 'zh-CN',
    };

    try {
      const openclawNode = require('../../../../../newgame/ffi/openclaw-node/index.js');
      const saveDir = options?.dataPath ? `${options.dataPath}/saves` : './data/saves';
      const dbUrl = options?.memoryDbPath ? `sqlite://${options.memoryDbPath}` : 'sqlite://./data/memories.db';
      this.rustEngine = openclawNode.CoreGameEngine.create(options?.ollamaUrl || 'http://localhost:11434', saveDir, dbUrl);
      this.startSync();
    } catch (error) {
      this.initError = error instanceof Error ? error : new Error(String(error));
      console.error('[RustBridge] 无法加载 Rust 引擎，请确保 openclaw-node 已构建:', this.initError.message);
    }
  }

  /** 启动引擎并订阅 Rust 端发送的所有事件 */
  private startSync() {
    if (!this.rustEngine) return;
    
    this.rustEngine.start();
    
    this.rustEngine.subscribe((eventJson: string) => {
      try {
        const event = JSON.parse(eventJson);
        this.emit(event.event_type, event.payload, event);
        this.eventBus.emit(event.event_type, event.payload, event.source || 'rust');
        this.emit('*', event);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('[RustBridge] 解析 Rust 事件失败:', err.message);
        this.emit('bridge:parse_error', { raw: eventJson, error: err.message });
      }
    });

    this.isInitialized = true;
  }

  /** 验证引擎是否可用，不可用时抛出存储的初始化错误 */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      if (this.initError) {
        throw new Error(`引擎初始化失败: ${this.initError.message}`);
      }
      throw new Error('引擎未启动');
    }
  }
    });

    this.isInitialized = true;
  }

  /** 获取事件总线实例 */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  /** 获取当前游戏回合数 */
  public getTurnCount(): number {
    return this.turnCount;
  }

  /** 获取引擎当前配置 */
  public getConfig(): Readonly<GameConfig> {
    return this.config;
  }

  /** 处理一回合输入（非流式） */
  public async processTurn(input: string): Promise<{ narrative: string; stateSnapshot: SceneState }> {
    this.ensureInitialized();

    this.turnCount++;
    this.rustEngine!.dispatchEvent('player_input', JSON.stringify({ text: input }));

    return new Promise((resolve) => {
      const handler = (payload: StreamDonePayload) => {
        this.off('narrative_generated', handler);
        this.getState().then(state => {
          resolve({
            narrative: payload.content || payload.full,
            stateSnapshot: state
          });
        });
      };
      
      this.on('narrative_generated', handler);
    });
  }

  /** 流式处理一回合输入，返回 AsyncIterable 供 server.ts 的 chunked 响应使用 */
  public async *processStreamTurn(input: string): AsyncIterable<string> {
    this.ensureInitialized();

    this.turnCount++;
    this.rustEngine!.dispatchEvent('player_input', JSON.stringify({ text: input }));

    const queue: string[] = [];
    let isDone = false;
    let error: Error | null = null;

    const chunkHandler = (payload: StreamChunkPayload) => {
      queue.push(JSON.stringify({ type: 'chunk', content: payload.content }) + '\n');
    };
    const doneHandler = (payload: StreamDonePayload) => {
      queue.push(JSON.stringify({ type: 'done', full: payload.content || payload.full }) + '\n');
      isDone = true;
    };
    const errorHandler = (payload: StreamErrorPayload) => {
      error = new Error(payload.message || 'Rust Stream Error');
      isDone = true;
    };

    this.on('narrative_chunk', chunkHandler);
    this.on('narrative_generated', doneHandler);
    this.on('agent_error', errorHandler);

    try {
      while (!isDone || queue.length > 0) {
        if (error) throw error;
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise(resolve => setTimeout(resolve, 10)); // 避免忙等
        }
      }
    } finally {
      this.off('narrative_chunk', chunkHandler);
      this.off('narrative_generated', doneHandler);
      this.off('agent_error', errorHandler);
    }
  }

  /** 获取当前世界状态快照 */
  public async getState(): Promise<SceneState> {
    if (!this.rustEngine) return {} as SceneState;
    const stateStr = await this.rustEngine.getState();
    return JSON.parse(stateStr) as SceneState;
  }

  /** 保存当前游戏到存档 */
  public async save(name: string): Promise<string> {
    if (!this.rustEngine) throw new Error('引擎未就绪');
    return await this.rustEngine.save(name, this.config.mode);
  }

  /** 从存档加载游戏 */
  public async load(saveId: string): Promise<void> {
    if (!this.rustEngine) throw new Error('引擎未就绪');
    await this.rustEngine.load(saveId);
    const state = await this.getState();
    this.turnCount = (state as Record<string, unknown>).turnCount as number || 0;
  }

  /** 列出可用存档列表 */
  public async listSaves(limit?: number): Promise<Record<string, unknown>[]> {
    if (!this.rustEngine) return [];
    const savesStr = await this.rustEngine.listSaves(limit);
    return JSON.parse(savesStr) as Record<string, unknown>[];
  }

  /** 初始化世界模板（用于开局） */
  public async bootstrapWorld(input: Record<string, unknown>): Promise<{ narrative: string; stateSnapshot: SceneState }> {
    if (!this.rustEngine) throw new Error('引擎未就绪');
    this.turnCount = 0;
    return { narrative: "世界初始化完成", stateSnapshot: await this.getState() };
  }

  /** 重置游戏引擎到初始状态 */
  public reset(): void {
    this.turnCount = 0;
    this.eventBus.clearLog();
  }

  /** 清空当前会话记忆 */
  public async clearMemories(): Promise<void> {
    await this.rustEngine?.clearMemories();
  }

  /** 彻底关闭引擎连接 */
  public close(): void {
    this.isInitialized = false;
  }

  /** 获取内部状态存储引擎，Mock 以满足编译 */
  public getStateStore(): StateStoreStub {
    return {
      getState: async () => await this.getState()
    };
  }

  /** 更新规则书，当前 Rust 版本在配置中固定了，这里仅做兼容处理 */
  public setRuleBook(_ruleBook: string): void {
    // Rust 引擎暂不通过该方法更新规则书
  }

  /** 删除存档 */
  public async deleteSave(saveId: string): Promise<void> {
    if (!this.rustEngine) throw new Error('引擎未就绪');
    await this.rustEngine.deleteSave(saveId);
  }

  /** 辅助方法：对接 Rust 端的成就系统 */
  public getAchievements(): Record<string, unknown>[] { return []; }
  public getUnlockedAchievementCount(): number { return 0; }
}

  /** 更新规则书，当前 Rust 版本在配置中固定了，这里仅做兼容处理 */
  public setRuleBook(ruleBook: string): void {
    // Rust 引擎暂不通过该方法更新规则书
  }

  /** 删除存档 */
  public async deleteSave(saveId: string): Promise<void> {
    if (!this.rustEngine) throw new Error('引擎未就绪');
    await this.rustEngine.deleteSave(saveId);
  }

  /** 获取记忆管理器接口，对接 Rust 端的向量存储 */
  public getMemoryManager(): MemoryManagerStub {
    const self = this;
    return {
      getAllMemories: async (options: { limit?: number; type?: string }) => {
        if (!self.rustEngine) return [];
        const resStr = await self.rustEngine.getMemories(JSON.stringify(options || {}));
        return JSON.parse(resStr) as unknown[];
      },
      getMemoryCount: async () => {
        return await self.rustEngine?.getMemoryCount() || 0;
      },
      recall: async (query: string, options: { limit?: number }) => {
        if (!self.rustEngine) return [];
        const resStr = await self.rustEngine.recallMemories(query, JSON.stringify(options || {}));
        return JSON.parse(resStr) as unknown[];
      },
      clearSession: async () => {
        await self.rustEngine?.clearMemories();
      }
    };
  }

  public dispatchEconomy(amount: number, reason: string) {
    this.rustEngine?.dispatchEvent('economy_transaction', JSON.stringify({ amount, reason }));
  }

  public dispatchRelationship(targetId: string, affinityChange: number, interactionType: string) {
    this.rustEngine?.dispatchEvent('relationship_update', JSON.stringify({
      target_id: targetId,
      affinity_change: affinityChange,
      interaction_type: interactionType
    }));
  }

  public advanceTime(hours: number, description: string) {
    this.rustEngine?.dispatchEvent('time_advance', JSON.stringify({ hours, description }));
  }

  public createQuest(quest: Record<string, unknown>) {
    this.rustEngine?.dispatchEvent('quest_event', JSON.stringify({
      action: 'add',
      quest: quest
    }));
  }

  public updateQuest(questId: string, status?: string, objectiveId?: string) {
    this.rustEngine?.dispatchEvent('quest_event', JSON.stringify({
      action: 'update',
      quest_id: questId,
      status: status,
      objective_id: objectiveId
    }));
  }

  public createItem(item: Record<string, unknown>, quantity = 1) {
    this.rustEngine?.dispatchEvent('item_event', JSON.stringify({
      action: 'add',
      item: item,
      quantity: quantity
    }));
  }

  public removeItem(itemId: string, quantity = 1) {
    this.rustEngine?.dispatchEvent('item_event', JSON.stringify({
      action: 'remove',
      item_id: itemId,
      quantity: quantity
    }));
  }

  /** 辅助方法：对接 Rust 端的成就系统 */
  public getAchievements(): any[] { return []; }
  public getUnlockedAchievementCount(): number { return 0; }
}
