/**
 * Narrator 集成测试（使用 MockProvider）
 * 测试：process / orchestrate / registerSubAgent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Narrator } from '../narrator.js';
import { MockProvider } from '../../test/mock-provider.js';
import type { AgentRequest, GameAgent, AgentConfig, AgentResponse } from '../../types/agent.js';

/** 创建简单的 MockSubAgent */
class MockSubAgent implements GameAgent {
  readonly role;
  readonly name;
  readonly config: AgentConfig;
  public lastRequest?: AgentRequest;
  public responseContent: string;

  constructor(role: GameAgent['role'], response: string) {
    this.role = role;
    this.name = `Mock ${role}`;
    this.config = {
      role,
      name: this.name,
      description: 'test',
      systemPrompt: 'test',
    };
    this.responseContent = response;
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    this.lastRequest = request;
    return {
      from: this.role,
      content: this.responseContent,
    };
  }

  async *processStream(request: AgentRequest): AsyncIterable<string> {
    yield this.responseContent;
  }

  reset(): void {}
}

describe('Narrator', () => {
  let provider: MockProvider;
  let narrator: Narrator;

  beforeEach(() => {
    provider = new MockProvider();
    narrator = new Narrator(provider);
  });

  describe('process (基础对话)', () => {
    it('应发送消息给 AI 并返回响应', async () => {
      provider.addResponse('你走进了一片幽暗的森林...');

      const response = await narrator.process({
        from: 'player',
        content: '我向北走',
        context: { location: '起始之地' },
      });

      expect(response.from).toBe('narrator');
      expect(response.content).toBe('你走进了一片幽暗的森林...');
      expect(provider.chatCalls).toHaveLength(1);
    });

    it('应在消息中包含系统提示词', async () => {
      provider.addResponse('响应');

      await narrator.process({
        from: 'player',
        content: '测试',
      });

      const messages = provider.chatCalls[0].messages;
      const systemMsg = messages.find(m => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg!.content).toContain('主叙述者');
    });

    it('应在消息中包含上下文', async () => {
      provider.addResponse('响应');

      await narrator.process({
        from: 'player',
        content: '测试',
        context: { location: '森林', weather: '下雨' },
      });

      const messages = provider.chatCalls[0].messages;
      const contextMsg = messages.find(m => m.content.includes('场景上下文'));
      expect(contextMsg).toBeDefined();
    });
  });

  describe('orchestrate (协调流程)', () => {
    it('无子代理时应直接生成叙事', async () => {
      provider.addResponse('你踏上了冒险之旅...');

      const result = await narrator.orchestrate('出发冒险', { location: '起始之地' });

      expect(result.narrative).toBe('你踏上了冒险之旅...');
      expect(result.agentResponses).toHaveLength(0);
    });

    it('有子代理时应先分析再协调', async () => {
      // 第一次 chat：分析需要咨询哪些代理
      provider.addResponse(JSON.stringify({ consult: ['world-keeper'], reason: '涉及世界设定' }));
      // 第二次 chat：最终叙事
      provider.addResponse('经过世界观守护者的确认，这片森林充满了古老的魔法...');

      const worldKeeper = new MockSubAgent('world-keeper', '这片森林是精灵领地');
      narrator.registerSubAgent(worldKeeper);

      const result = await narrator.orchestrate('探索森林', { location: '神秘森林' });

      expect(result.narrative).toContain('古老的魔法');
      expect(result.agentResponses).toHaveLength(1);
      expect(result.agentResponses[0].from).toBe('world-keeper');
    });

    it('分析 JSON 解析失败时应降级处理', async () => {
      // 返回无效 JSON
      provider.addResponse('这不是有效的JSON');
      // 最终叙事
      provider.addResponse('你继续前行...');

      const worldKeeper = new MockSubAgent('world-keeper', '世界观信息');
      narrator.registerSubAgent(worldKeeper);

      const result = await narrator.orchestrate('前进', { location: '道路' });

      // 应优雅降级，不应抛出错误
      expect(result.narrative).toBe('你继续前行...');
    });

    it('应并行咨询多个子代理', async () => {
      provider.addResponse(JSON.stringify({
        consult: ['world-keeper', 'npc-director'],
        reason: '涉及世界和 NPC',
      }));
      provider.addResponse('综合所有信息...');

      narrator.registerSubAgent(new MockSubAgent('world-keeper', '世界观回复'));
      narrator.registerSubAgent(new MockSubAgent('npc-director', 'NPC回复'));

      const result = await narrator.orchestrate('和NPC交谈', { location: '酒馆' });

      expect(result.agentResponses).toHaveLength(2);
    });
  });

  describe('registerSubAgent', () => {
    it('应注册子代理', async () => {
      const agent = new MockSubAgent('world-keeper', '测试');
      narrator.registerSubAgent(agent);

      // 注册后 orchestrate 应能使用
      provider.addResponse(JSON.stringify({ consult: ['world-keeper'], reason: 'test' }));
      provider.addResponse('叙事');

      const result = await narrator.orchestrate('test', {});
      expect(result.agentResponses).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('应清空对话历史', async () => {
      provider.addResponse('第一次回复');
      await narrator.process({ from: 'player', content: '第一轮' });

      narrator.reset();

      provider.addResponse('重置后回复');
      await narrator.process({ from: 'player', content: '第二轮' });

      // 重置后第二次调用不应包含第一次的历史
      const messages = provider.chatCalls[1].messages;
      const hasFirstRound = messages.some(m => m.content.includes('第一轮'));
      // 当前消息应是 "第二轮"
      const hasSecondRound = messages.some(m => m.content === '第二轮');
      expect(hasSecondRound).toBe(true);
      // 不应有第一轮的历史消息（注意：当前用户消息中不会包含"第一轮"）
      const historyMsgs = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      expect(historyMsgs.length).toBe(1); // 只有当前这一条
    });
  });
});
