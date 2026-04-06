import type { Quest } from '../types/scene.js';
import type { QuestGenerationContext, QuestValidationRules, ValidationResult, QuestGenerator } from '../types/validator.js';

const DEFAULT_QUEST_RULES: QuestValidationRules = {
  minTitleLength: 3,
  maxTitleLength: 100,
  minDescriptionLength: 10,
  maxDescriptionLength: 1000,
  minObjectives: 1,
  maxObjectives: 10,
  requireObjectives: true,
  maxGoldReward: 10000,
  maxExpReward: 5000,
};

export class QuestValidator implements QuestGenerator {
  private rules: QuestValidationRules;

  constructor(rules?: Partial<QuestValidationRules>) {
    this.rules = { ...DEFAULT_QUEST_RULES, ...rules };
  }

  validateQuest(quest: Quest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!quest.title || quest.title.trim().length === 0) {
      errors.push('任务标题不能为空');
    } else {
      if (quest.title.length < this.rules.minTitleLength) {
        errors.push(`任务标题长度不能少于 ${this.rules.minTitleLength} 个字符`);
      }
      if (quest.title.length > this.rules.maxTitleLength) {
        errors.push(`任务标题长度不能超过 ${this.rules.maxTitleLength} 个字符`);
      }
    }

    if (!quest.description || quest.description.trim().length === 0) {
      errors.push('任务描述不能为空');
    } else {
      if (quest.description.length < this.rules.minDescriptionLength) {
        errors.push(`任务描述长度不能少于 ${this.rules.minDescriptionLength} 个字符`);
      }
      if (quest.description.length > this.rules.maxDescriptionLength) {
        errors.push(`任务描述长度不能超过 ${this.rules.maxDescriptionLength} 个字符`);
      }
    }

    if (this.rules.requireObjectives && (!quest.objectives || quest.objectives.length === 0)) {
      errors.push('任务必须包含目标');
    } else if (quest.objectives) {
      if (quest.objectives.length < this.rules.minObjectives) {
        errors.push(`任务目标数量不能少于 ${this.rules.minObjectives} 个`);
      }
      if (quest.objectives.length > this.rules.maxObjectives) {
        errors.push(`任务目标数量不能超过 ${this.rules.maxObjectives} 个`);
      }
    }

    const validStatuses = ['active', 'completed', 'failed'];
    if (!validStatuses.includes(quest.status)) {
      errors.push(`任务状态必须是 ${validStatuses.join(', ')} 之一`);
    }

    const questIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!quest.questId || !questIdPattern.test(quest.questId)) {
      errors.push('任务 ID 格式不合法，只能包含字母、数字、下划线和连字符');
    }

    if (!quest.id || quest.id.trim().length === 0) {
      errors.push('任务唯一标识符不能为空');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async generateQuest(context: QuestGenerationContext): Promise<Quest> {
    const { playerLevel = 1, plotType = 'side', difficulty = 'medium' } = context;

    const questTemplates = this.getQuestTemplates(plotType, difficulty);
    const template = questTemplates[Math.floor(Math.random() * questTemplates.length)];

    const rewardMultiplier = this.getRewardMultiplier(difficulty, playerLevel);
    const goldReward = Math.floor(template.baseGoldReward * rewardMultiplier);
    const expReward = Math.floor(template.baseExpReward * rewardMultiplier);

    const quest: Quest = {
      id: this.generateQuestId(),
      questId: template.questId,
      title: this.generateTitle(template, context),
      description: this.generateDescription(template, context),
      status: 'active',
      objectives: this.generateObjectives(template, context),
    };

    const validation = this.validateQuest(quest);
    if (!validation.valid) {
      throw new Error(`生成的任务未通过验证：${validation.errors.join(', ')}`);
    }

    return quest;
  }

  private getQuestTemplates(plotType: string, difficulty: string) {
    const templates: Array<{
      questId: string;
      baseGoldReward: number;
      baseExpReward: number;
      titlePatterns: string[];
      descriptionPatterns: string[];
      objectivePatterns: string[][];
    }> = [];

    if (plotType === 'story') {
      templates.push(
        {
          questId: 'story_001',
          baseGoldReward: 100,
          baseExpReward: 200,
          titlePatterns: ['{location}的秘密', '失落的{item}', '{npc}的委托'],
          descriptionPatterns: [
            '在{location}发现了一个神秘的线索，需要进一步调查。',
            '传说中存在一件古老的{item}，据说拥有强大的力量。',
            '{npc}请求你帮助完成一项重要的任务。',
          ],
          objectivePatterns: [
            ['调查{location}的异常现象', '收集相关证据', '向委托人汇报'],
            ['寻找{item}的下落', '克服途中的障碍', '成功获取{item}'],
            ['与{npc}详细交谈', '完成指定任务', '获得任务奖励'],
          ],
        },
        {
          questId: 'story_002',
          baseGoldReward: 150,
          baseExpReward: 300,
          titlePatterns: ['王国的危机', '古老的预言', '被遗忘的历史'],
          descriptionPatterns: [
            '王国面临着前所未有的危机，需要勇敢的英雄挺身而出。',
            '古老的预言正在应验，你必须揭开其中的真相。',
            '一段被遗忘的历史等待着你去发掘。',
          ],
          objectivePatterns: [
            ['收集王国的危机情报', '制定应对方案', '执行救援行动'],
            ['解读预言的内容', '寻找相关线索', '验证预言的真实性'],
            ['探索古代遗迹', '解读历史文献', '还原历史真相'],
          ],
        }
      );
    } else if (plotType === 'side') {
      templates.push(
        {
          questId: 'side_001',
          baseGoldReward: 50,
          baseExpReward: 100,
          titlePatterns: ['帮助{npc}', '寻找{item}', '清理{location}'],
          descriptionPatterns: [
            '{npc}遇到了麻烦，希望你能伸出援手。',
            '有人悬赏寻找{item}，这似乎是个不错的赚钱机会。',
            '{location}被一些不速之客占据了，需要有人清理。',
          ],
          objectivePatterns: [
            ['与{npc}交谈了解情况', '帮助解决问题', '获得感谢'],
            ['调查{item}的位置', '取得{item}', '交付给委托人'],
            ['前往{location}', '击败或驱赶入侵者', '确认区域安全'],
          ],
        },
        {
          questId: 'side_002',
          baseGoldReward: 75,
          baseExpReward: 150,
          titlePatterns: ['送货任务', '护送{npc}', '收集材料'],
          descriptionPatterns: [
            '需要将一批重要货物送到{location}。',
            '{npc}需要前往危险的地方，请求你的保护。',
            '有人需要收集一些稀有的材料，报酬丰厚。',
          ],
          objectivePatterns: [
            ['接收货物', '安全送达{location}', '获取回执'],
            ['与{npc}会合', '保护{npc}到达目的地', '确保护送成功'],
            ['收集指定材料', '确保材料质量', '交付给委托人'],
          ],
        }
      );
    } else {
      templates.push(
        {
          questId: 'daily_001',
          baseGoldReward: 20,
          baseExpReward: 50,
          titlePatterns: ['日常委托', '小帮忙', '临时任务'],
          descriptionPatterns: [
            '一些日常的小委托，完成后可以获得报酬。',
            '有人需要一点小帮助，虽然不是什么大事。',
            '临时接到一个任务，看起来不难。',
          ],
          objectivePatterns: [
            ['接受委托', '完成委托内容', '领取报酬'],
            ['了解需求', '提供帮助', '获得感谢'],
            ['确认任务内容', '执行任务', '汇报结果'],
          ],
        }
      );
    }

    return templates;
  }

  private getRewardMultiplier(difficulty: string, playerLevel: number): number {
    const baseMultiplier = ({
      easy: 0.8,
      medium: 1.0,
      hard: 1.5,
    } as const)[difficulty] ?? 1.0;

    const levelBonus = Math.min(playerLevel * 0.1, 2.0);
    return baseMultiplier + levelBonus;
  }

  private generateTitle(template: any, context: QuestGenerationContext): string {
    const pattern = template.titlePatterns[Math.floor(Math.random() * template.titlePatterns.length)];
    return pattern
      .replace(/{location}/g, context.currentLocation || '神秘之地')
      .replace(/{item}/g, '神秘物品')
      .replace(/{npc}/g, context.relatedNPC || '陌生人');
  }

  private generateDescription(template: any, context: QuestGenerationContext): string {
    const pattern = template.descriptionPatterns[Math.floor(Math.random() * template.descriptionPatterns.length)];
    return pattern
      .replace(/{location}/g, context.currentLocation || '某个神秘的地方')
      .replace(/{item}/g, '古老的宝物')
      .replace(/{npc}/g, context.relatedNPC || '一位需要帮助的人');
  }

  private generateObjectives(template: any, context: QuestGenerationContext): string[] {
    const objectivesPattern =
      template.objectivePatterns[Math.floor(Math.random() * template.objectivePatterns.length)];
    return objectivesPattern.map((obj: string) =>
      obj
        .replace(/{location}/g, context.currentLocation || '目的地')
        .replace(/{item}/g, '目标物品')
        .replace(/{npc}/g, context.relatedNPC || '委托人')
    );
  }

  private generateQuestId(): string {
    return `quest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
