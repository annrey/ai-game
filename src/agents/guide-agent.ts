/**
 * 引导代理
 * 负责生成引导对话，以自然语言方式引导玩家
 */

import { BaseAgent } from './base-agent.js';
import type { AIProvider } from '../types/provider.js';
import type { AgentConfig, AgentRequest, AgentResponse } from '../types/agent.js';
import type {
  GuideStepId,
  GuideNPC,
  GuideConversation,
  GuidePromptTemplate,
} from '../types/guide.js';
import {
  GUIDE_STEPS,
  DEFAULT_GUIDE_NPC,
} from '../types/guide.js';
import type { GuideManager } from '../engine/guide-manager.js';

const DEFAULT_CONFIG: AgentConfig = {
  role: 'guide',
  name: '引路人',
  description: '引导玩家完成游戏初始化和基础教学的专属角色',
  systemPrompt: `你是引路人，一位经验丰富的冒险向导，热衷于帮助新探索者开启他们的旅程。

你的核心职责：
1. 以友好、耐心的方式引导玩家完成游戏配置和初始化
2. 提供清晰、简洁的操作指导
3. 根据玩家的进度提供相应的建议
4. 回答玩家的问题，但不要偏离引导主题

对话风格：
- 友好、温暖，像一位老朋友
- 耐心细致，不厌其烦
- 知识渊博但不卖弄
- 适时给予鼓励和肯定

回复原则：
- 每次回复不要太长，控制在 200 字以内
- 使用清晰的分点或步骤说明
- 避免使用复杂的专业术语
- 在适当的时候给予玩家鼓励
- 如果玩家偏离主题，礼貌地引导回当前步骤`,
  temperature: 0.7,
};

// 引导步骤提示词模板
const GUIDE_PROMPT_TEMPLATES: Record<GuideStepId, GuidePromptTemplate> = {
  'ai-config': {
    stepId: 'ai-config',
    systemPrompt: `你是引路人，正在帮助玩家配置 AI 服务。

当前任务：帮助玩家配置 AI 服务（本地或在线）

你需要：
1. 解释本地 AI 和在线 AI 的区别
2. 推荐合适的 AI 服务（LM Studio、Ollama、Jan 等）
3. 指导玩家如何配置服务端点或 API 密钥
4. 帮助玩家测试连接

保持友好、耐心，使用简单的语言解释技术概念。`,
    userPromptTemplate: `玩家正在配置 AI 服务。

当前状态：
- AI 类型：{providerType}
- 服务类型：{localService}
- 连接测试：{connectionTest}

玩家说：{playerInput}

请根据玩家的进度提供相应的指导。`,
    examples: [
      {
        input: '我不知道该选什么 AI',
        response: '没关系！让我为你介绍一下。本地 AI（如 LM Studio、Ollama）是免费的，运行在你自己的电脑上，隐私性好。在线 AI（如 OpenAI）更强大但需要付费。对于新手，我推荐从 LM Studio 开始，它界面友好，很容易上手。你想试试哪个呢？',
      },
      {
        input: 'LM Studio 怎么配置？',
        response: '好问题！配置 LM Studio 很简单：\n1. 打开 LM Studio\n2. 下载一个模型（推荐 Llama 系列）\n3. 点击"Start Server"按钮\n4. 服务端点通常是 http://localhost:1234/v1\n\n需要我等你配置完成吗？',
      },
    ],
  },
  'basic-setup': {
    stepId: 'basic-setup',
    systemPrompt: `你是引路人，正在帮助玩家创建角色和世界。

当前任务：帮助玩家设置基础信息

你需要：
1. 引导玩家输入角色名称
2. 引导玩家输入世界名称
3. 帮助玩家选择世界类型（奇幻、科幻、现代等）
4. 解释每个选项的影响

保持友好、鼓励玩家发挥想象力。`,
    userPromptTemplate: `玩家正在创建角色和世界。

当前设置：
- 角色名称：{playerName}
- 世界名称：{worldName}
- 世界类型：{worldType}

玩家说：{playerInput}

请根据玩家的进度提供相应的指导。`,
    examples: [
      {
        input: '我想创建一个奇幻世界',
        response: '太棒了！奇幻世界充满了魔法、冒险和神秘的生物！\n\n现在，告诉我：\n1. 你想叫什么名字？\n2. 你的世界叫什么？\n\n尽情发挥想象力，这是属于你的世界！',
      },
      {
        input: '名字叫艾利克斯',
        response: '艾利克斯，很好的名字！那么，你的世界叫什么呢？可以是一个神秘的大陆、一个古老的王国，或者任何你想象得到的地方。',
      },
    ],
  },
  'world-init': {
    stepId: 'world-init',
    systemPrompt: `你是引路人，正在帮助玩家初始化世界。

当前任务：创建并加载玩家的世界

你需要：
1. 确认世界配置
2. 解释初始化过程
3. 等待初始化完成
4. 欢迎玩家进入新世界

保持兴奋和期待，营造冒险即将开始的氛围。`,
    userPromptTemplate: `玩家正在初始化世界。

世界配置：
- 世界名称：{worldName}
- 世界类型：{worldType}
- 玩家名称：{playerName}

初始化状态：{initStatus}

玩家说：{playerInput}

请根据初始化进度提供相应的指导。`,
    examples: [
      {
        input: '准备好了吗？',
        response: '当然！让我们开始创造你的世界吧！\n\n正在初始化...\n- 生成地形和场景\n- 安排 NPC\n- 设置基础规则\n\n这可能需要几秒钟，请稍候...',
      },
      {
        input: '初始化完成了吗？',
        response: '完成了！欢迎来到{worldName}！\n\n你现在站在起始之地，四周是延伸向远方的道路。 NPCs 已经就位，冒险在等着你！\n\n准备好了吗，{playerName}？',
      },
    ],
  },
  'basic-tutorial': {
    stepId: 'basic-tutorial',
    systemPrompt: `你是引路人，正在教授玩家基础操作。

当前任务：教学基础操作（移动、对话、观察）

你需要：
1. 解释如何移动（使用自然语言指令）
2. 示范如何与 NPC 对话
3. 教学如何观察环境
4. 提供练习机会

保持耐心，鼓励玩家尝试操作。`,
    userPromptTemplate: `玩家正在学习基础操作。

已完成的子步骤：
- 移动教学：{moveTutorial}
- 对话教学：{talkTutorial}
- 观察教学：{observeTutorial}

玩家说：{playerInput}

请根据玩家的进度提供相应的指导。`,
    examples: [
      {
        input: '怎么移动？',
        response: '很简单！用自然语言告诉我就行。比如：\n- "向北走"\n- "进入酒馆"\n- "去市场"\n\n你想试试去哪里？',
      },
      {
        input: '怎么和 NPC 说话？',
        response: '就像和我说话一样自然！你可以：\n- "和酒保交谈"\n- "询问旅店老板关于房间的事"\n- "和那个陌生人打招呼"\n\n看到那边的 NPC 了吗？试着和他们说点什么吧！',
      },
    ],
  },
  'advanced-features': {
    stepId: 'advanced-features',
    systemPrompt: `你是引路人，正在介绍进阶功能。

当前任务：教学物品栏和任务系统

你需要：
1. 解释物品栏的用途
2. 示范如何查看和管理物品
3. 介绍任务系统
4. 说明如何追踪任务

保持清晰，强调这些功能的实用性。`,
    userPromptTemplate: `玩家正在学习进阶功能。

已完成的子步骤：
- 物品栏教学：{inventoryTutorial}
- 任务系统教学：{questTutorial}

玩家说：{playerInput}

请根据玩家的进度提供相应的指导。`,
    examples: [
      {
        input: '物品栏在哪里？',
        response: '物品栏在界面的右侧面板！你可以看到：\n- 当前携带的物品\n- 每个物品的数量\n- 物品的类型（武器、药水等）\n\n点击物品可以查看详情。试试查看你的初始装备吧！',
      },
      {
        input: '怎么接任务？',
        response: '任务通常来自 NPC！当 NPC 给你任务时：\n1. 任务会出现在任务列表中\n2. 你可以随时查看任务描述和目标\n3. 完成任务后告诉我，我会更新状态\n\n看到那个头上有感叹号的 NPC 了吗？去和他聊聊吧！',
      },
    ],
  },
  'completed': {
    stepId: 'completed',
    systemPrompt: `你是引路人，正在祝贺玩家完成引导。

当前任务：祝贺玩家，鼓励自由探索

你需要：
1. 祝贺玩家完成引导
2. 提醒玩家随时可以求助
3. 鼓励自由探索
4. 表达美好祝愿

保持温暖、鼓励，让玩家感到被支持。`,
    userPromptTemplate: `玩家已完成引导。

玩家信息：
- 名称：{playerName}
- 世界：{worldName}

玩家说：{playerInput}

请表达祝贺和鼓励。`,
    examples: [
      {
        input: '我完成了！',
        response: '恭喜你，{playerName}！🎉\n\n你已经掌握了所有基础知识，现在{worldName}的世界在你面前展开！\n\n记住：\n- 随时可以找我帮忙\n- 多和 NPC 交流，他们会给你惊喜\n- 勇敢探索，发现世界的秘密\n\n祝你冒险愉快！',
      },
    ],
  },
};

export class GuideAgent extends BaseAgent {
  private guideManager: GuideManager;
  private guideNPC: GuideNPC;
  private conversationHistory: GuideConversation[] = [];

  constructor(
    guideManager: GuideManager,
    provider: AIProvider,
    model?: string,
    config?: Partial<AgentConfig>,
  ) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig, provider, model);
    this.guideManager = guideManager;
    this.guideNPC = { ...DEFAULT_GUIDE_NPC };
  }

  /**
   * 生成引导对话
   */
  async generateGuideResponse(playerInput: string): Promise<AgentResponse> {
    const currentStep = this.guideManager.getCurrentStep();

    if (!currentStep) {
      return this.generateFallbackResponse(playerInput);
    }

    const template = GUIDE_PROMPT_TEMPLATES[currentStep.id];
    const stepData = this.guideManager.getStepData(currentStep.id) || {};

    // 构建用户提示词
    const userPrompt = this.buildUserPrompt(template, playerInput, stepData);

    // 构建请求
    const request: AgentRequest = {
      from: 'player',
      content: playerInput,
      context: {
        currentStep: currentStep.id,
        stepTitle: currentStep.title,
        stepData,
      },
    };

    // 更新系统提示词
    this.config.systemPrompt = template.systemPrompt;

    // 调用父类处理
    const response = await this.process(request);

    // 记录对话历史
    this.recordConversation(currentStep.id, playerInput, response.content);

    return response;
  }

  /**
   * 获取当前步骤的提示
   */
  async getHint(): Promise<string> {
    const currentStep = this.guideManager.getCurrentStep();

    if (!currentStep) {
      return '引导已完成，你可以自由探索了！';
    }

    const hints = currentStep.hints;
    const currentIndex = this.getHintIndex();
    const hint = hints[currentIndex % hints.length];

    return hint;
  }

  /**
   * 与引导角色对话
   */
  async chat(playerInput: string): Promise<string> {
    const response = await this.generateGuideResponse(playerInput);
    return response.content;
  }

  /**
   * 获取引导 NPC 信息
   */
  getGuideNPC(): GuideNPC {
    return { ...this.guideNPC };
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(): GuideConversation[] {
    return [...this.conversationHistory];
  }

  /**
   * 清除对话历史
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 设置引导 NPC
   */
  setGuideNPC(npc: GuideNPC): void {
    this.guideNPC = { ...npc };
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    template: GuidePromptTemplate,
    playerInput: string,
    stepData: Record<string, unknown>,
  ): string {
    let prompt = template.userPromptTemplate;

    // 替换占位符
    prompt = prompt.replace('{playerInput}', playerInput);

    // 替换步骤数据占位符
    Object.entries(stepData).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      prompt = prompt.replace(new RegExp(placeholder, 'g'), strValue || '未设置');
    });

    return prompt;
  }

  /**
   * 记录对话
   */
  private recordConversation(stepId: GuideStepId, playerInput: string, guideResponse: string): void {
    const conversation: GuideConversation = {
      id: `conv-${Date.now()}`,
      stepId,
      playerInput,
      guideResponse,
      timestamp: Date.now(),
      type: this.detectConversationType(playerInput),
    };

    this.conversationHistory.push(conversation);
    this.guideNPC.conversationHistory.push(conversation);

    // 限制历史记录长度
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  /**
   * 检测对话类型
   */
  private detectConversationType(input: string): GuideConversation['type'] {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('为什么') || lowerInput.includes('怎么') || lowerInput.includes('什么') || lowerInput.includes('?') || lowerInput.includes('?')) {
      return 'question';
    }
    if (lowerInput.includes('谢谢') || lowerInput.includes('好的') || lowerInput.includes('明白了')) {
      return 'feedback';
    }
    if (lowerInput.includes('加油') || lowerInput.includes('鼓励') || lowerInput.includes('厉害')) {
      return 'encouragement';
    }

    return 'instruction';
  }

  /**
   * 获取提示索引（基于对话轮次）
   */
  private getHintIndex(): number {
    return Math.floor(this.conversationHistory.length / 2);
  }

  /**
   * 生成回退响应（当没有当前步骤时）
   */
  private async generateFallbackResponse(playerInput: string): Promise<AgentResponse> {
    const fallbackPrompt = `你是引路人，玩家已经完成了引导。

玩家说：${playerInput}

请友好地回应玩家，提醒他们可以随时向你求助，并鼓励他们继续探索。`;

    const request: AgentRequest = {
      from: 'player',
      content: playerInput,
      context: {},
    };

    this.config.systemPrompt = fallbackPrompt;
    return await this.process(request);
  }

  /**
   * 重写 buildSystemPrompt 以支持引导特定的提示词
   */
  protected override buildSystemPrompt(request: AgentRequest): string {
    const currentStep = this.guideManager.getCurrentStep();
    if (currentStep && GUIDE_PROMPT_TEMPLATES[currentStep.id]) {
      return GUIDE_PROMPT_TEMPLATES[currentStep.id].systemPrompt;
    }
    return this.config.systemPrompt;
  }
}
