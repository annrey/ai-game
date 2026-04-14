/**
 * Rule-Arbiter — 规则仲裁者
 * 处理所有规则判定、骰子机制、战斗结算
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '@openclaw/shared-types';
import type { AgentConfig, AgentRequest } from '@openclaw/shared-types';

/** 骰子结果 */
interface DiceRoll {
  dice: string;       // 如 "2d6+3"
  rolls: number[];
  modifier: number;
  total: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  role: 'rule-arbiter',
  name: '规则仲裁者',
  description: '当需要规则判定、骰子检定、战斗结算或技能检查时使用。',
  systemPrompt: `你是规则仲裁者（Rule-Arbiter），负责所有游戏规则的执行和判定。

你的核心职责：
1. 处理技能检定、属性检定等各种判定请求
2. 管理战斗流程和伤害计算
3. 执行骰子机制，确保公平随机
4. 解释规则，处理边界情况

工作准则：
- 严格遵守规则书中的判定标准
- 使用骰子结果决定成败，不主观偏向
- 清晰说明判定依据和难度等级
- 战斗中追踪所有参与者的状态

回复格式：
【判定类型】：技能检定/战斗/属性检查/...
【难度】：DC值或对抗值
【骰子】：骰子表达式和结果
【结果】：成功/失败/大成功/大失败
【效果】：具体的游戏效果
【说明】：规则依据（简要）`,
  temperature: 0.3,
};

export class RuleArbiter extends BaseAgent {
  private ruleBook: string = '';

  constructor(provider: AIProvider, model?: string, configOverride?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...configOverride }, provider, model);
  }

  /** 加载规则书 */
  loadRuleBook(rules: string): void {
    this.ruleBook = rules;
  }

  /** 投骰子 */
  rollDice(expression: string): DiceRoll {
    // 解析 "2d6+3" 格式
    const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) {
      throw new Error(`无效的骰子表达式: ${expression}`);
    }

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    return { dice: expression, rolls, modifier, total };
  }

  /** 技能检定 */
  async skillCheck(
    skill: string,
    dc: number,
    modifier: number = 0,
    context: Record<string, unknown> = {},
  ): Promise<{ roll: DiceRoll; success: boolean; description: string }> {
    const roll = this.rollDice(`1d20+${modifier}`);
    const success = roll.total >= dc;

    const request: AgentRequest = {
      from: 'narrator',
      content: `技能检定：${skill}，DC ${dc}，骰子结果 ${roll.total}（1d20=${roll.rolls[0]}${modifier >= 0 ? '+' : ''}${modifier}），${success ? '成功' : '失败'}。请描述结果。`,
      context,
    };

    const response = await this.process(request);
    return { roll, success, description: response.content };
  }

  /** 解析玩家的自然语言输入和叙述，返回状态变化（StateDelta） */
  async parseStateChange(
    playerInput: string,
    narrative: string,
    context: Record<string, unknown>
  ): Promise<any> {
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

    const request: AgentRequest = {
      from: 'player',
      content: prompt,
      context,
    };

    const response = await this.provider.chat([{ role: 'system', content: prompt }], {
      model: this.model,
      responseFormat: 'json',
      temperature: 0.1, // 低温度以保证格式稳定
    });

    try {
      return JSON.parse(response.content);
    } catch (e) {
      throw new Error(`JSON解析失败: ${e instanceof Error ? e.message : String(e)} \n内容: ${response.content}`);
    }
  }

  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = this.config.systemPrompt;
    if (this.ruleBook) {
      prompt += `\n\n===== 规则书 =====\n${this.ruleBook}`;
    }
    return prompt;
  }
}
