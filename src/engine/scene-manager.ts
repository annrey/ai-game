/**
 * 场景管理器
 * 管理场景切换、NPC进出和环境变化
 */

import { EventBus, GameEvents } from './event-bus.js';
import { StateStore } from './state-store.js';
import type { NPCState, EnvironmentState, Action, PlotPoint } from '../types/scene.js';
import { v4 as uuidv4 } from 'uuid';

export class SceneManager {
  private eventBus: EventBus;
  private stateStore: StateStore;

  constructor(eventBus: EventBus, stateStore: StateStore) {
    this.eventBus = eventBus;
    this.stateStore = stateStore;
  }

  /** 切换场景 */
  changeLocation(location: string, description: string): void {
    const previous = this.stateStore.getState().currentLocation;
    this.stateStore.update({
      currentLocation: location,
      locationDescription: description,
      presentNPCs: [], // 切换场景时清空NPC
    });
    this.eventBus.emit(GameEvents.LOCATION_CHANGE, {
      from: previous,
      to: location,
      description,
    });
  }

  /** NPC 进入场景 */
  addNPC(npc: NPCState): void {
    const state = this.stateStore.getState();
    const npcs = [...state.presentNPCs, npc];
    this.stateStore.update({ presentNPCs: npcs });
    this.eventBus.emit(GameEvents.NPC_ENTER, { npc });
  }

  /** NPC 离开场景 */
  removeNPC(npcId: string): void {
    const state = this.stateStore.getState();
    const npc = state.presentNPCs.find(n => n.id === npcId);
    const npcs = state.presentNPCs.filter(n => n.id !== npcId);
    this.stateStore.update({ presentNPCs: npcs });
    if (npc) {
      this.eventBus.emit(GameEvents.NPC_EXIT, { npc });
    }
  }

  /** 更新环境 */
  updateEnvironment(env: Partial<EnvironmentState>): void {
    const state = this.stateStore.getState();
    this.stateStore.update({
      environment: { ...state.environment, ...env },
    });
    this.eventBus.emit(GameEvents.ENVIRONMENT_CHANGE, { environment: env });
  }

  /** 记录玩家行动 */
  recordAction(type: Action['type'], description: string, target?: string): Action {
    const action: Action = {
      id: uuidv4(),
      actor: 'player',
      type,
      description,
      target,
      timestamp: Date.now(),
    };

    const state = this.stateStore.getState();
    const actions = [...state.playerActions, action].slice(-50); // 保留最近50个
    this.stateStore.update({ playerActions: actions });
    this.eventBus.emit(GameEvents.PLAYER_ACTION, { action });

    return action;
  }

  /** 推进时间 */
  advanceTime(minutes: number): void {
    this.stateStore.advanceTime(minutes);
    this.eventBus.emit(GameEvents.TIME_ADVANCE, {
      time: this.stateStore.getState().worldTime,
      advanced: minutes,
    });
  }

  /** 添加剧情点 */
  addPlot(plot: PlotPoint): void {
    const state = this.stateStore.getState();
    this.stateStore.update({
      activePlots: [...state.activePlots, plot],
    });
    this.eventBus.emit(GameEvents.PLOT_ADVANCE, { plot });
  }

  /** 推进剧情 */
  advancePlot(plotId: string, status: PlotPoint['status']): void {
    const state = this.stateStore.getState();
    const plots = state.activePlots.map(p =>
      p.id === plotId ? { ...p, status } : p,
    );
    this.stateStore.update({ activePlots: plots });
    this.eventBus.emit(GameEvents.PLOT_ADVANCE, { plotId, status });
  }
}
