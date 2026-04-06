/**
 * 环境系统管理器
 * 管理天气、可交互物体和环境效果
 */

import type {
  WeatherType,
  WeatherState,
  InteractableObject,
  ObjectAction,
  EnvironmentEffect,
  EnvironmentConfig,
} from '../types/environment.js';
import {
  WEATHER_STATES,
  TAVERN_OBJECTS,
  ENVIRONMENT_EFFECTS,
  DEFAULT_ENVIRONMENT_CONFIG,
} from '../types/environment.js';
import type { GameTime } from '../types/scene.js';

export class EnvironmentManager {
  private currentWeather: WeatherState;
  private objects = new Map<string, InteractableObject>();
  private effects: EnvironmentEffect[] = [];
  private config: EnvironmentConfig;
  private currentTurn = 0;
  private lastWeatherChange = 0;
  private objectCooldowns = new Map<string, number>();

  constructor(config: Partial<EnvironmentConfig> = {}) {
    this.config = { ...DEFAULT_ENVIRONMENT_CONFIG, ...config };
    this.currentWeather = { ...WEATHER_STATES.sunny };
    this.loadObjects(TAVERN_OBJECTS);
    this.effects = [...ENVIRONMENT_EFFECTS];
  }

  /** 加载可交互物体 */
  loadObjects(objects: InteractableObject[]): void {
    for (const obj of objects) {
      this.objects.set(obj.id, { ...obj });
    }
  }

  /** 设置当前回合 */
  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /** 获取当前天气 */
  getCurrentWeather(): WeatherState {
    return { ...this.currentWeather };
  }

  /** 设置天气 */
  setWeather(weatherType: WeatherType): void {
    this.currentWeather = { ...WEATHER_STATES[weatherType] };
    this.lastWeatherChange = this.currentTurn;
  }

  /** 随机改变天气 */
  randomizeWeather(): WeatherType {
    const weathers: WeatherType[] = ['sunny', 'rainy', 'cloudy', 'foggy', 'stormy', 'snowy'];
    const weights = [0.4, 0.2, 0.2, 0.1, 0.05, 0.05]; // 权重

    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < weathers.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        this.setWeather(weathers[i]);
        return weathers[i];
      }
    }

    this.setWeather('sunny');
    return 'sunny';
  }

  /** 更新天气（根据时间自动变化） */
  updateWeather(time: GameTime): boolean {
    // 检查是否需要改变天气
    if (this.currentTurn - this.lastWeatherChange >= this.config.weatherChangeInterval) {
      this.randomizeWeather();
      return true;
    }
    return false;
  }

  /** 获取所有可交互物体 */
  getAllObjects(): InteractableObject[] {
    return Array.from(this.objects.values());
  }

  /** 获取可交互物体 */
  getObject(objectId: string): InteractableObject | undefined {
    return this.objects.get(objectId);
  }

  /** 检查物体是否可以使用 */
  canUseObject(objectId: string, actionId: string, userId: string): {
    canUse: boolean;
    reason?: string;
  } {
    const obj = this.objects.get(objectId);
    if (!obj) {
      return { canUse: false, reason: '物体不存在' };
    }

    const action = obj.actions.find(a => a.id === actionId);
    if (!action) {
      return { canUse: false, reason: '动作不存在' };
    }

    // 检查冷却时间
    const cooldownKey = `${objectId}-${actionId}`;
    const lastUsed = this.objectCooldowns.get(cooldownKey) || 0;
    if (this.currentTurn - lastUsed < action.cooldown) {
      return { canUse: false, reason: '动作正在冷却中' };
    }

    // 检查是否被占用
    if (obj.state === 'in_use' && !action.allowMultiple && obj.currentUser !== userId) {
      return { canUse: false, reason: '物体正被其他人使用' };
    }

    return { canUse: true };
  }

  /** 使用物体 */
  useObject(
    objectId: string,
    actionId: string,
    userId: string,
  ): {
    success: boolean;
    message: string;
    effects?: Array<{ type: string; value: number }>;
  } {
    const check = this.canUseObject(objectId, actionId, userId);
    if (!check.canUse) {
      return { success: false, message: check.reason || '无法使用' };
    }

    const obj = this.objects.get(objectId)!;
    const action = obj.actions.find(a => a.id === actionId)!;

    // 设置冷却时间
    const cooldownKey = `${objectId}-${actionId}`;
    this.objectCooldowns.set(cooldownKey, this.currentTurn);

    // 更新物体状态
    if (!action.allowMultiple) {
      obj.state = 'in_use';
      obj.currentUser = userId;
    }

    return {
      success: true,
      message: `你${action.name}了${obj.name}`,
      effects: action.effects,
    };
  }

  /** 释放物体 */
  releaseObject(objectId: string, userId: string): boolean {
    const obj = this.objects.get(objectId);
    if (!obj) return false;

    if (obj.currentUser === userId) {
      obj.state = 'idle';
      obj.currentUser = undefined;
      return true;
    }

    return false;
  }

  /** 获取当前环境效果 */
  getActiveEffects(time: GameTime): EnvironmentEffect[] {
    if (!this.config.enableEffects) return [];

    const activeEffects: EnvironmentEffect[] = [];

    for (const effect of this.effects) {
      let isActive = false;

      switch (effect.trigger.type) {
        case 'weather':
          isActive = effect.trigger.value === this.currentWeather.type;
          break;
        case 'time':
          isActive = effect.trigger.value === time.period;
          break;
        case 'location':
          // 简化处理，假设所有效果都在酒馆
          isActive = true;
          break;
        case 'object':
          // 检查是否有物体被使用
          const obj = this.objects.get(effect.trigger.value);
          isActive = obj?.state === 'in_use';
          break;
      }

      if (isActive) {
        activeEffects.push(effect);
      }
    }

    return activeEffects;
  }

  /** 获取环境描述 */
  getEnvironmentDescription(time: GameTime): string {
    const parts: string[] = [];

    // 天气描述
    parts.push(`天气：${this.currentWeather.description}`);
    parts.push(`温度：${this.currentWeather.temperature}°C`);

    // 时间描述
    const timeDescriptions: Record<string, string> = {
      dawn: '黎明时分，天刚蒙蒙亮',
      morning: '早晨，阳光透过窗户洒进来',
      noon: '正午，酒馆里人声鼎沸',
      afternoon: '下午，阳光变得柔和',
      dusk: '黄昏，夕阳的余晖照进酒馆',
      evening: '夜晚，酒馆里点起了蜡烛',
      night: '深夜，酒馆里安静下来',
      midnight: '午夜，只有少数客人还在',
    };
    parts.push(timeDescriptions[time.period] || '');

    // 环境效果描述
    const effects = this.getActiveEffects(time);
    for (const effect of effects) {
      parts.push(effect.description);
    }

    return parts.filter(Boolean).join('，');
  }

  /** 获取环境对心情的影响 */
  getMoodEffect(time: GameTime): number {
    let effect = this.currentWeather.moodEffect;

    const effects = this.getActiveEffects(time);
    for (const envEffect of effects) {
      for (const e of envEffect.effects) {
        if (e.type === 'mood') {
          effect += e.value;
        }
      }
    }

    return effect;
  }

  /** 获取正在使用的物体列表 */
  getInUseObjects(): InteractableObject[] {
    return Array.from(this.objects.values()).filter(obj => obj.state === 'in_use');
  }

  /** 获取可用的物体列表 */
  getAvailableObjects(): InteractableObject[] {
    return Array.from(this.objects.values()).filter(obj => obj.state !== 'broken');
  }

  /** 重置环境系统 */
  reset(): void {
    this.currentWeather = { ...WEATHER_STATES.sunny };
    this.currentTurn = 0;
    this.lastWeatherChange = 0;
    this.objectCooldowns.clear();
    this.objects.clear();
    this.loadObjects(TAVERN_OBJECTS);
  }

  /** 更新环境系统（每回合调用） */
  update(time: GameTime): {
    weatherChanged: boolean;
    activeEffects: EnvironmentEffect[];
  } {
    // 更新天气
    const weatherChanged = this.updateWeather(time);

    // 获取当前效果
    const activeEffects = this.getActiveEffects(time);

    // 清理已释放的物体
    for (const obj of this.objects.values()) {
      if (obj.state === 'in_use') {
        // 检查是否应该自动释放（简化处理，实际应该基于时间）
        const hasCooldown = Array.from(this.objectCooldowns.keys()).some(key =>
          key.startsWith(obj.id),
        );
        if (!hasCooldown) {
          obj.state = 'idle';
          obj.currentUser = undefined;
        }
      }
    }

    return { weatherChanged, activeEffects };
  }
}
