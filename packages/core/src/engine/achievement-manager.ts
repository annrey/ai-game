import { EventBus, GameEvents } from './event-bus.js';
import { StateStore } from './state-store.js';
import type { Achievement } from '@openclaw/shared-types';

/** 预定义成就列表 */
export const ACHIEVEMENTS: Achievement[] = [
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

export class AchievementManager {
  private unlockedAchievements = new Set<string>();
  private achievementProgress = new Map<string, number>();
  private uniqueNPCsMet = new Set<string>();
  private uniqueItemsCollected = new Set<string>();
  private uniqueLocationsVisited = new Set<string>();

  constructor(private eventBus: EventBus, private stateStore: StateStore) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventBus.on('engine:turn_ended', (event) => {
      const { turnCount } = event.payload as { turnCount: number };
      this.checkTurnAchievements(turnCount);
      this.checkSpecialAchievements();

      const state = this.stateStore.getState();
      this.checkLocationAchievements(state.currentLocation);

      for (const npc of state.presentNPCs) {
        this.checkNPCAchievements(npc.name);
      }

      for (const item of state.playerState.inventory) {
        this.checkItemAchievements(item.name);
      }
    });

    this.eventBus.on(GameEvents.COMBAT_END, (event) => {
      const { isVictory } = event.payload as { isVictory: boolean };
      this.checkCombatAchievements(isVictory);
    });
  }

  /** 检查并解锁成就 */
  private unlockAchievement(achievementId: string): void {
    if (this.unlockedAchievements.has(achievementId)) return;

    this.unlockedAchievements.add(achievementId);
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (achievement) {
      this.eventBus.emit(GameEvents.ACHIEVEMENT_UNLOCKED, { achievement }, 'engine');
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
  private checkTurnAchievements(turnCount: number): void {
    if (turnCount >= 1) this.unlockAchievement('first_step');
    if (turnCount >= 10) this.unlockAchievement('story_beginner');
    if (turnCount >= 50) this.unlockAchievement('story_enthusiast');
    if (turnCount >= 100) this.unlockAchievement('legend');
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
}
