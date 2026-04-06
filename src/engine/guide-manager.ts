/**
 * 引导管理器
 * 管理整个引导流程，包括步骤管理、进度追踪和状态持久化
 */

import type {
  GuideStep,
  GuideStepId,
  GuideStepStatus,
  GuideProgress,
  GuideConfig,
  GuideEvent,
  GuideSubStep,
  AIConfigGuideData,
  BasicSetupGuideData,
} from '../types/guide.js';
import {
  GUIDE_STEPS,
  DEFAULT_GUIDE_CONFIG,
} from '../types/guide.js';
import { StateStore } from './state-store.js';

export class GuideManager {
  private progress: GuideProgress;
  private config: GuideConfig;
  private stateStore: StateStore | null = null;
  private eventHistory: GuideEvent[] = [];
  private currentStepData: Record<string, unknown> = {};

  constructor(initialConfig?: Partial<GuideConfig>) {
    this.config = { ...DEFAULT_GUIDE_CONFIG, ...initialConfig };
    this.progress = this.createInitialProgress();
  }

  /**
   * 创建初始引导进度
   */
  private createInitialProgress(): GuideProgress {
    const now = Date.now();
    const steps: Record<GuideStepId, GuideStepStatus> = {
      'ai-config': 'pending',
      'basic-setup': 'pending',
      'world-init': 'pending',
      'basic-tutorial': 'pending',
      'advanced-features': 'pending',
      'completed': 'pending',
    };

    return {
      currentStepId: 'ai-config',
      steps,
      isCompleted: false,
      isActive: this.config.enabled,
      createdAt: now,
      updatedAt: now,
      completedStepsCount: 0,
      totalStepsCount: Object.keys(GUIDE_STEPS).length - 1, // 不包括 completed
    };
  }

  /**
   * 设置状态存储（用于持久化）
   */
  setStateStore(stateStore: StateStore): void {
    this.stateStore = stateStore;
    this.loadProgress();
  }

  /**
   * 获取引导配置
   */
  getConfig(): GuideConfig {
    return this.config;
  }

  /**
   * 更新引导配置
   */
  updateConfig(config: Partial<GuideConfig>): void {
    this.config = { ...this.config, ...config };
    this.emitEvent('guide_deactivated', { config: this.config });
  }

  /**
   * 获取引导进度
   */
  getProgress(): GuideProgress {
    return this.progress;
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(): GuideStep | null {
    const stepId = this.progress.currentStepId;
    if (stepId === 'completed' || !GUIDE_STEPS[stepId]) {
      return null;
    }

    const stepDef = GUIDE_STEPS[stepId];
    const status = this.progress.steps[stepId];

    return {
      ...stepDef,
      status,
    };
  }

  /**
   * 获取所有步骤
   */
  getAllSteps(): GuideStep[] {
    return Object.values(GUIDE_STEPS).map(stepDef => ({
      ...stepDef,
      status: this.progress.steps[stepDef.id],
    }));
  }

  /**
   * 获取指定步骤
   */
  getStep(stepId: GuideStepId): GuideStep | null {
    if (!GUIDE_STEPS[stepId]) {
      return null;
    }

    const stepDef = GUIDE_STEPS[stepId];
    const status = this.progress.steps[stepId];

    return {
      ...stepDef,
      status,
    };
  }

  /**
   * 开始引导
   */
  startGuide(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (this.progress.isCompleted) {
      return false;
    }

    this.progress.isActive = true;
    this.progress.updatedAt = Date.now();

    // 找到第一个未完成的步骤
    const nextStep = this.findNextIncompleteStep();
    if (nextStep) {
      this.progress.currentStepId = nextStep;
      this.progress.steps[nextStep] = 'active';
    }

    this.emitEvent('guide_activated', { stepId: nextStep });
    this.saveProgress();

    return true;
  }

  /**
   * 开始指定步骤
   */
  startStep(stepId: GuideStepId): boolean {
    if (!GUIDE_STEPS[stepId] || stepId === 'completed') {
      return false;
    }

    if (!this.progress.isActive) {
      return false;
    }

    // 检查前置步骤是否完成
    if (!this.arePrerequisitesComplete(stepId)) {
      return false;
    }

    // 将当前步骤设为非活动状态
    const currentStep = this.progress.currentStepId;
    if (currentStep !== 'completed' && this.progress.steps[currentStep] === 'active') {
      this.progress.steps[currentStep] = 'pending';
    }

    // 开始新步骤
    this.progress.currentStepId = stepId;
    this.progress.steps[stepId] = 'active';
    this.progress.updatedAt = Date.now();

    this.emitEvent('step_started', { stepId });
    this.saveProgress();

    return true;
  }

  /**
   * 完成当前步骤
   */
  completeStep(stepData?: Record<string, unknown>): boolean {
    const currentStep = this.progress.currentStepId;

    if (currentStep === 'completed' || !GUIDE_STEPS[currentStep]) {
      return false;
    }

    // 保存步骤数据
    if (stepData) {
      this.currentStepData[currentStep] = stepData;
    }

    // 标记步骤为完成
    this.progress.steps[currentStep] = 'completed';
    this.progress.completedStepsCount++;
    this.progress.updatedAt = Date.now();

    this.emitEvent('step_completed', { stepId: currentStep, data: stepData });

    // 检查是否所有步骤都已完成
    if (this.areAllStepsCompleted()) {
      this.completeGuide();
    } else {
      // 自动开始下一个步骤
      const nextStep = this.findNextIncompleteStep();
      if (nextStep) {
        this.progress.currentStepId = nextStep;
        this.progress.steps[nextStep] = 'active';
      }
    }

    this.saveProgress();
    return true;
  }

  /**
   * 跳过当前步骤
   */
  skipStep(): boolean {
    const currentStep = this.progress.currentStepId;

    if (currentStep === 'completed' || !GUIDE_STEPS[currentStep]) {
      return false;
    }

    if (!this.config.allowSkip) {
      return false;
    }

    // 标记步骤为跳过
    this.progress.steps[currentStep] = 'skipped';
    this.progress.updatedAt = Date.now();

    this.emitEvent('step_skipped', { stepId: currentStep });

    // 检查是否所有步骤都已完成或跳过
    if (this.areAllStepsCompletedOrSkipped()) {
      this.completeGuide();
    } else {
      // 自动开始下一个步骤
      const nextStep = this.findNextIncompleteStep();
      if (nextStep) {
        this.progress.currentStepId = nextStep;
        this.progress.steps[nextStep] = 'active';
      }
    }

    this.saveProgress();
    return true;
  }

  /**
   * 完成引导
   */
  completeGuide(): void {
    this.progress.isCompleted = true;
    this.progress.currentStepId = 'completed';
    this.progress.steps['completed'] = 'completed';
    this.progress.updatedAt = Date.now();

    this.emitEvent('guide_completed', {});
    this.saveProgress();
  }

  /**
   * 重置引导
   */
  resetGuide(): void {
    this.progress = this.createInitialProgress();
    this.currentStepData = {};
    this.eventHistory = [];

    this.emitEvent('guide_deactivated', {});
    this.saveProgress();
  }

  /**
   * 获取步骤数据
   */
  getStepData(stepId: GuideStepId): Record<string, unknown> | undefined {
    return this.currentStepData[stepId];
  }

  /**
   * 获取 AI 配置数据
   */
  getAIConfigData(): AIConfigGuideData | undefined {
    return this.currentStepData['ai-config'] as AIConfigGuideData | undefined;
  }

  /**
   * 获取基础设置数据
   */
  getBasicSetupData(): BasicSetupGuideData | undefined {
    return this.currentStepData['basic-setup'] as BasicSetupGuideData | undefined;
  }

  /**
   * 获取引导进度百分比
   */
  getProgressPercentage(): number {
    if (this.progress.totalStepsCount === 0) {
      return 0;
    }
    return Math.round((this.progress.completedStepsCount / this.progress.totalStepsCount) * 100);
  }

  /**
   * 获取事件历史
   */
  getEventHistory(): GuideEvent[] {
    return [...this.eventHistory];
  }

  /**
   * 检查步骤是否完成
   */
  isStepCompleted(stepId: GuideStepId): boolean {
    return this.progress.steps[stepId] === 'completed';
  }

  /**
   * 检查步骤是否可开始
   */
  isStepAvailable(stepId: GuideStepId): boolean {
    if (this.progress.steps[stepId] === 'completed') {
      return true;
    }

    return this.arePrerequisitesComplete(stepId);
  }

  /**
   * 检查引导是否激活
   */
  isGuideActive(): boolean {
    return this.progress.isActive && !this.progress.isCompleted;
  }

  /**
   * 检查引导是否完成
   */
  isGuideCompleted(): boolean {
    return this.progress.isCompleted;
  }

  /**
   * 保存进度到状态存储
   */
  private saveProgress(): void {
    if (!this.stateStore) {
      return;
    }

    try {
      // 将引导进度保存到状态存储中
      // 注意：这里使用自定义的持久化方式，因为 state-store 可能没有直接的引导进度字段
      const state = this.stateStore.getState();
      (state as Record<string, unknown>).__guideProgress = this.progress;
      (state as Record<string, unknown>).__guideConfig = this.config;
      (state as Record<string, unknown>).__guideStepData = this.currentStepData;
    } catch (error) {
      console.error('保存引导进度失败:', error);
    }
  }

  /**
   * 从状态存储加载进度
   */
  private loadProgress(): void {
    if (!this.stateStore) {
      return;
    }

    try {
      const state = this.stateStore.getState();
      const savedProgress = (state as Record<string, unknown>).__guideProgress as GuideProgress | undefined;
      const savedConfig = (state as Record<string, unknown>).__guideConfig as GuideConfig | undefined;
      const savedStepData = (state as Record<string, unknown>).__guideStepData as Record<string, unknown> | undefined;

      if (savedProgress) {
        this.progress = savedProgress;
      }

      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      if (savedStepData) {
        this.currentStepData = savedStepData;
      }
    } catch (error) {
      console.error('加载引导进度失败:', error);
    }
  }

  /**
   * 查找下一个未完成的步骤
   */
  private findNextIncompleteStep(): GuideStepId | null {
    const stepOrder: GuideStepId[] = [
      'ai-config',
      'basic-setup',
      'world-init',
      'basic-tutorial',
      'advanced-features',
    ];

    for (const stepId of stepOrder) {
      const status = this.progress.steps[stepId];
      if (status !== 'completed' && status !== 'skipped') {
        return stepId;
      }
    }

    return null;
  }

  /**
   * 检查前置步骤是否完成
   */
  private arePrerequisitesComplete(stepId: GuideStepId): boolean {
    const stepOrder: GuideStepId[] = [
      'ai-config',
      'basic-setup',
      'world-init',
      'basic-tutorial',
      'advanced-features',
    ];

    const currentIndex = stepOrder.indexOf(stepId);
    if (currentIndex <= 0) {
      return true;
    }

    // 检查所有前置步骤是否完成或跳过
    for (let i = 0; i < currentIndex; i++) {
      const prevStep = stepOrder[i];
      const status = this.progress.steps[prevStep];
      if (status !== 'completed' && status !== 'skipped') {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查所有步骤是否完成
   */
  private areAllStepsCompleted(): boolean {
    const stepOrder: GuideStepId[] = [
      'ai-config',
      'basic-setup',
      'world-init',
      'basic-tutorial',
      'advanced-features',
    ];

    return stepOrder.every(stepId => this.progress.steps[stepId] === 'completed');
  }

  /**
   * 检查所有步骤是否完成或跳过
   */
  private areAllStepsCompletedOrSkipped(): boolean {
    const stepOrder: GuideStepId[] = [
      'ai-config',
      'basic-setup',
      'world-init',
      'basic-tutorial',
      'advanced-features',
    ];

    return stepOrder.every(stepId => {
      const status = this.progress.steps[stepId];
      return status === 'completed' || status === 'skipped';
    });
  }

  /**
   * 发出事件
   */
  private emitEvent(type: GuideEvent['type'], payload: GuideEvent['payload']): void {
    const event: GuideEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    this.eventHistory.push(event);

    // 限制事件历史长度
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(-100);
    }
  }
}
