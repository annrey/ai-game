/**
 * 思维链（Chain of Thought）单元测试
 * 测试 BaseAgent 中的思维链提取和生成功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAgent } from '../base-agent.js';
import { MockProvider } from '../../test/mock-provider.js';
import type { AgentConfig, AgentRequest, ChainOfThought, CoTStep } from '../../types/agent.js';

/** 用于测试的 ConcreteAgent 类 */
class TestAgent extends BaseAgent {
  constructor(provider: MockProvider, config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      role: 'narrator',
      name: 'Test Agent',
      description: '用于测试思维链的代理',
      systemPrompt: '你是一个测试代理。',
      ...config,
    };
    super(defaultConfig, provider);
  }

  // 公开 protected 方法以便测试
  public testExtractChainOfThought(content: string, startTime: number, endTime: number): ChainOfThought {
    return this.extractChainOfThought(content, startTime, endTime);
  }

  public testBuildChainOfThoughtPrompt(): string {
    return this.buildChainOfThoughtPrompt();
  }
}

describe('思维链（Chain of Thought）', () => {
  let provider: MockProvider;
  let agent: TestAgent;

  beforeEach(() => {
    provider = new MockProvider();
    agent = new TestAgent(provider);
  });

  describe('extractChainOfThought - 提取思维链', () => {
    it('应能从带有标准标记的响应中提取完整的思维链', () => {
      const content = `
【观察】
玩家选择向北走，进入了幽暗的森林。当前天气晴朗，时间是白天。

【分析】
玩家似乎在探索新区域，可能对冒险充满好奇。需要描述森林的环境和可能的危险。

【推理】
根据世界观设定，这片森林是精灵的领地，可能会有精灵巡逻队出现。

【决策】
应该先描述森林的环境，然后引入一个 NPC 相遇事件，增加趣味性。

【行动】
生成叙事文本：你走进了一片幽暗的森林，阳光透过树叶洒下斑驳的光影...
`;

      const startTime = Date.now() - 1000;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      expect(chainOfThought).toBeDefined();
      expect(chainOfThought.id).toBeDefined();
      expect(chainOfThought.agentRole).toBe('narrator');
      expect(chainOfThought.steps).toHaveLength(5);

      // 验证每个步骤
      const stepTypes: CoTStep['step'][] = ['observation', 'analysis', 'reasoning', 'decision', 'action'];
      stepTypes.forEach((stepType, index) => {
        expect(chainOfThought.steps[index].step).toBe(stepType);
        expect(chainOfThought.steps[index].content).toBeTruthy();
        expect(chainOfThought.steps[index].content.length).toBeGreaterThan(0);
      });

      // 验证摘要
      expect(chainOfThought.summary).toBeDefined();
      expect(chainOfThought.summary.length).toBeGreaterThan(0);
    });

    it('应能从带有英文标记的响应中提取思维链', () => {
      const content = `
[Observation]
The player chose to go north into the dark forest.

[Analysis]
The player seems to be exploring new areas.

[Reasoning]
According to the world settings, this forest is elf territory.

[Decision]
I should describe the forest environment first.

[Action]
Generate narrative text about the forest.
`;

      const startTime = Date.now() - 500;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      expect(chainOfThought.steps).toHaveLength(5);
      expect(chainOfThought.steps[0].step).toBe('observation');
      expect(chainOfThought.steps[1].step).toBe('analysis');
    });

    it('应能从带有 Markdown 标记的响应中提取思维链', () => {
      const content = `
## Observation
玩家选择了等待时间流逝。

## Analysis
玩家可能想观察环境变化或休息。

## Reasoning
应该描写周围环境的自然演变。

## Decision
生成环境描写和可能的随机事件。

## Action
天色渐暗，微风吹过...
`;

      const startTime = Date.now() - 800;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      expect(chainOfThought.steps).toHaveLength(5);
      expect(chainOfThought.steps[0].content).toContain('等待时间流逝');
    });

    it('当响应没有标记时应生成简化的思维链', () => {
      const content = '这是一个普通的响应，没有任何思维链标记。';
      const startTime = Date.now() - 600;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      expect(chainOfThought.steps).toHaveLength(5);
      expect(chainOfThought.steps[0].step).toBe('observation');
      expect(chainOfThought.steps[0].content).toContain('收到请求');
      expect(chainOfThought.steps[1].step).toBe('analysis');
      expect(chainOfThought.steps[2].step).toBe('reasoning');
      expect(chainOfThought.steps[3].step).toBe('decision');
      expect(chainOfThought.steps[4].step).toBe('action');
    });

    it('应能处理部分标记的响应', () => {
      const content = `
【观察】
玩家与 NPC 交谈。

【分析】
NPC 是酒馆老板，性格友好。

玩家想知道最近的冒险任务。
`;

      const startTime = Date.now() - 400;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      // 应至少提取到 2 个步骤
      expect(chainOfThought.steps.length).toBeGreaterThanOrEqual(2);
      expect(chainOfThought.steps[0].step).toBe('observation');
      expect(chainOfThought.steps[1].step).toBe('analysis');
    });

    it('应正确计算每个步骤的耗时', () => {
      const content = `
【观察】观察内容
【分析】分析内容
【推理】推理内容
【决策】决策内容
【行动】行动内容
`;

      const startTime = 1000000;
      const endTime = 1001000; // 总耗时 1000ms

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      // 每个步骤应该分配到大约 200ms (1000ms / 5)
      chainOfThought.steps.forEach((step) => {
        expect(step.duration).toBeDefined();
        expect(step.duration).toBeGreaterThan(0);
      });

      const totalDuration = chainOfThought.steps.reduce((sum, step) => sum + (step.duration || 0), 0);
      expect(totalDuration).toBeCloseTo(1000, -1); // 允许一定误差
    });

    it('应生成合理的思维链摘要', () => {
      const content = `
【观察】这是第一个步骤的详细内容，描述了当前情境。
【分析】这是第二个步骤的内容，分析了玩家意图。
【推理】这是推理步骤。
【决策】这是决策步骤。
【行动】这是行动步骤。
`;

      const startTime = Date.now() - 500;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      expect(chainOfThought.summary).toBeDefined();
      expect(chainOfThought.summary).toContain('👁️ 观察');
      expect(chainOfThought.summary).toContain('🧠 分析');
    });
  });

  describe('buildChainOfThoughtPrompt - 构建思维链提示词', () => {
    it('应生成包含所有步骤标记的提示词', () => {
      const prompt = agent.testBuildChainOfThoughtPrompt();

      expect(prompt).toBeDefined();
      expect(prompt).toContain('【观察】');
      expect(prompt).toContain('【分析】');
      expect(prompt).toContain('【推理】');
      expect(prompt).toContain('【决策】');
      expect(prompt).toContain('【行动】');
    });

    it('应为每个步骤提供清晰的说明', () => {
      const prompt = agent.testBuildChainOfThoughtPrompt();

      expect(prompt).toContain('描述你观察到的当前情境');
      expect(prompt).toContain('分析情境的重要性');
      expect(prompt).toContain('基于你的知识和规则');
      expect(prompt).toContain('决定最佳的响应方式');
      expect(prompt).toContain('描述你将采取的具体行动');
    });

    it('应包含结构化的格式说明', () => {
      const prompt = agent.testBuildChainOfThoughtPrompt();

      expect(prompt).toContain('请按照以下结构生成你的思考过程');
      expect(prompt).toContain('这种结构化的思考过程有助于提高响应的质量');
    });
  });

  describe('思维链集成测试', () => {
    it('应能在 process 响应中返回思维链', async () => {
      const contentWithCoT = `
【观察】玩家说"我向北走"
【分析】玩家想要探索北方区域
【推理】北方有一座神秘的城堡
【决策】描述城堡的外观
【行动】生成叙事文本
`;

      provider.addResponse(contentWithCoT);

      const response = await agent.process({
        from: 'player',
        content: '我向北走',
        context: { location: '起始之地' },
      });

      expect(response.chainOfThought).toBeDefined();
      expect(response.chainOfThought?.agentRole).toBe('narrator');
      expect(response.chainOfThought?.steps.length).toBeGreaterThan(0);
    });

    it('思维链应包含正确的元数据', async () => {
      const contentWithCoT = `
【观察】测试观察
【分析】测试分析
【推理】测试推理
【决策】测试决策
【行动】测试行动
`;

      provider.addResponse(contentWithCoT);

      const response = await agent.process({
        from: 'player',
        content: '测试',
      });

      const cot = response.chainOfThought;
      expect(cot).toBeDefined();

      if (cot) {
        expect(cot.id).toBeDefined();
        expect(cot.timestamp).toBeDefined();
        expect(cot.timestamp).toBeGreaterThan(Date.now() - 1000);
        expect(cot.steps).toHaveLength(5);
        expect(cot.summary).toBeDefined();
      }
    });

    it('应能处理流式响应并生成思维链', async () => {
      const contentWithCoT = `
【观察】流式测试观察
【分析】流式测试分析
【推理】流式测试推理
【决策】流式测试决策
【行动】流式测试行动
`;

      provider.addResponse(contentWithCoT);

      const chunks: string[] = [];
      for await (const chunk of agent.processStream({
        from: 'player',
        content: '流式测试',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('思维链边界情况', () => {
    it('应能处理空响应', () => {
      const startTime = Date.now() - 100;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought('', startTime, endTime);

      expect(chainOfThought.steps).toHaveLength(5);
      expect(chainOfThought.steps[0].content).toContain('收到请求');
    });

    it('应能处理非常长的响应', () => {
      const longContent = `
【观察】${'长'.repeat(1000)}
【分析】${'长'.repeat(1000)}
【推理】${'长'.repeat(1000)}
【决策】${'长'.repeat(1000)}
【行动】${'长'.repeat(1000)}
`;

      const startTime = Date.now() - 1000;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(longContent, startTime, endTime);

      expect(chainOfThought.steps).toHaveLength(5);
      expect(chainOfThought.steps[0].content.length).toBeGreaterThan(100);
    });

    it('应能处理乱序的思维链标记', () => {
      const content = `
【行动】这是行动
【观察】这是观察
【分析】这是分析
【决策】这是决策
【推理】这是推理
`;

      const startTime = Date.now() - 500;
      const endTime = Date.now();

      const chainOfThought = agent.testExtractChainOfThought(content, startTime, endTime);

      // 应该仍然能正确提取所有步骤
      expect(chainOfThought.steps.length).toBeGreaterThanOrEqual(3);
    });
  });
});
