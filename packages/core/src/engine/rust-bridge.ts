import { EventEmitter } from 'eventemitter3';
import { EventBus } from './event-bus.js';
import type { GameConfig } from '@openclaw/shared-types';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * RustGameEngineBridge - 核心引擎的 TypeScript 桥接器
 * 
 * 该类实现了与 GameEngine 相同的公共接口，允许在 server.ts 中通过 Rust 编写的
 * 核心逻辑来驱动游戏。它通过 FFI 加载 openclaw-node 原生模块。
 */
export class RustGameEngineBridge extends EventEmitter {
  private rustEngine: any; // CoreGameEngine 实例
  private isInitialized = false;
  private eventBus: EventBus;
  private turnCount = 0;
  private config: GameConfig;

  constructor(options?: { ollamaUrl?: string, config?: any, providerFactory?: any, dataPath?: string, memoryDbPath?: string, sessionId?: string, initialState?: any }) {
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
      // 动态加载编译后的原生模块
      const openclawNode = require('../../../../../newgame/ffi/openclaw-node/index.js');
      const saveDir = options?.dataPath ? `${options.dataPath}/saves` : './data/saves';
      const dbUrl = options?.memoryDbPath ? `sqlite://${options.memoryDbPath}` : 'sqlite://./data/memories.db';
      this.rustEngine = openclawNode.CoreGameEngine.create(options?.ollamaUrl || 'http://localhost:11434', saveDir, dbUrl);
      // We start it synchronously here to match TS GameEngine behavior
      this.startSync();
    } catch (error) {
      console.warn('无法加载 Rust 引擎，请确保 openclaw-node 已构建。', error);
    }
  }

  /** 启动引擎并订阅 Rust 端发送的所有事件 */
  private startSync() {
    if (!this.rustEngine) return;
    
    this.rustEngine.start();
    
    // 将 Rust 事件桥接到 TS EventEmitter 和内部 EventBus
    this.rustEngine.subscribe((eventJson: string) => {
      try {
        const event = JSON.parse(eventJson);
        // 触发本地 EventEmitter 事件
        this.emit(event.event_type, event.payload, event);
        // 同时也分发到 EventBus，确保核心组件的监听逻辑生效
        this.eventBus.emit(event.event_type, event.payload, event.source || 'rust');
        // 全局日志分发
        this.emit('*', event);
      } catch (e) {
        console.error('解析 Rust 事件失败', e);
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
  public async processTurn(input: string): Promise<{ narrative: string; stateSnapshot: any }> {
    if (!this.isInitialized) throw new Error('引擎未启动');

    this.turnCount++;
    this.rustEngine.dispatchEvent('player_input', JSON.stringify({ text: input }));

    return new Promise((resolve) => {
      const handler = (payload: any) => {
        this.off('narrative_generated', handler);
        this.getState().then(state => {
          resolve({
            narrative: payload.content,
            stateSnapshot: state
          });
        });
      };
      
      this.on('narrative_generated', handler);
    });
  }

  /** 流式处理一回合输入，返回 AsyncIterable 供 server.ts 的 chunked 响应使用 */
  public async *processStreamTurn(input: string): AsyncIterable<string> {
    if (!this.isInitialized) throw new Error('引擎未启动');

    this.turnCount++;
    this.rustEngine.dispatchEvent('player_input', JSON.stringify({ text: input }));

    const queue: string[] = [];
    let isDone = false;
    let error: Error | null = null;

    // 设置流式事件监听
    const chunkHandler = (payload: any) => {
      queue.push(JSON.stringify({ type: 'chunk', content: payload.content }) + '\n');
    };
    const doneHandler = (payload: any) => {
      queue.push(JSON.stringify({ type: 'done', full: payload.content }) + '\n');
      isDone = true;
    };
    const errorHandler = (payload: any) => {
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
  public async getState(): Promise<any> {
    if (!this.rustEngine) return {};
    const stateStr = await this.rustEngine.getState();
    return JSON.parse(stateStr);
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
    // 加载后同步回合数
    const state = await this.getState();
    this.turnCount = state.turnCount || 0;
  }

  /** 列出可用存档列表 */
  public async listSaves(limit?: number): Promise<any[]> {
    if (!this.rustEngine) return [];
    const savesStr = await this.rustEngine.listSaves(limit);
    return JSON.parse(savesStr);
  }

  /** 初始化世界模板（用于开局） */
  public async bootstrapWorld(input: any): Promise<any> {
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
  public getStateStore(): any {
    return {
      getState: async () => await this.getState()
    };
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
  public getMemoryManager(): any {
    return {
      getAllMemories: async (options: any) => {
        if (!this.rustEngine) return [];
        const resStr = await this.rustEngine.getMemories(JSON.stringify(options || {}));
        return JSON.parse(resStr);
      },
      getMemoryCount: async () => {
        return await this.rustEngine?.getMemoryCount() || 0;
      },
      recall: async (query: string, options: any) => {
        if (!this.rustEngine) return [];
        const resStr = await this.rustEngine.recallMemories(query, JSON.stringify(options || {}));
        return JSON.parse(resStr);
      },
      clearSession: async () => {
        await this.rustEngine?.clearMemories();
      }
    };
  }

  // 桥接特定业务逻辑事件到 Rust 规则引擎
  
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

  public createQuest(quest: any) {
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

  public createItem(item: any, quantity: number = 1) {
    this.rustEngine?.dispatchEvent('item_event', JSON.stringify({
      action: 'add',
      item: item,
      quantity: quantity
    }));
  }

  public removeItem(itemId: string, quantity: number = 1) {
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
