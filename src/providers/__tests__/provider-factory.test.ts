/**
 * ProviderFactory 单元测试
 * 测试：构造器 / getDefault / getByType / getForAgent / fromEnv / agentOverrides
 *
 * 注意：ProviderFactory 在构造时会实例化真实 Provider (Ollama/Local)，
 * 这里我们测试工厂逻辑本身，而非真实 AI 连接。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderFactory } from '../provider-factory.js';

describe('ProviderFactory', () => {
  describe('constructor & getDefault', () => {
    it('应根据配置创建默认 provider', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { host: 'http://localhost:11434', defaultModel: 'test' },
      });

      const provider = factory.getDefault();
      expect(provider).toBeDefined();
      expect(provider.type).toBe('ollama');
    });

    it('应创建 local provider', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'local',
        local: { endpoint: 'http://localhost:8080', defaultModel: 'test' },
      });

      const provider = factory.getDefault();
      expect(provider).toBeDefined();
      expect(provider.type).toBe('local');
    });
  });

  describe('getByType', () => {
    it('应按类型获取指定 provider', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { defaultModel: 'test' },
      });

      expect(factory.getByType('ollama').type).toBe('ollama');
      expect(factory.getByType('local').type).toBe('local');
    });

    it('获取不存在的类型应抛出错误', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
      });

      // openai 没有配置 apiKey，不会被创建
      expect(() => factory.getByType('openai')).toThrow();
    });
  });

  describe('getForAgent', () => {
    it('无 override 时应返回默认 provider', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { defaultModel: 'test' },
      });

      const result = factory.getForAgent('narrator');
      expect(result.provider.type).toBe('ollama');
      expect(result.model).toBeUndefined();
    });

    it('有 override 时应返回指定 provider 和 model', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { defaultModel: 'default-model' },
        local: { endpoint: 'http://localhost:8080' },
        agentOverrides: {
          narrator: { providerType: 'local', model: 'narrator-model' },
        },
      });

      const result = factory.getForAgent('narrator');
      expect(result.provider.type).toBe('local');
      expect(result.model).toBe('narrator-model');
    });

    it('未配置 override 的角色应使用默认', () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { defaultModel: 'test' },
        agentOverrides: {
          narrator: { providerType: 'ollama', model: 'special' },
        },
      });

      const result = factory.getForAgent('world-keeper');
      expect(result.provider.type).toBe('ollama');
      expect(result.model).toBeUndefined();
    });
  });

  describe('fromEnv', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      // 恢复环境变量
      process.env = { ...originalEnv };
    });

    it('应从环境变量创建工厂', () => {
      process.env.DEFAULT_PROVIDER = 'ollama';
      process.env.OLLAMA_HOST = 'http://localhost:11434';
      process.env.OLLAMA_MODEL = 'qwen2.5:7b';

      const factory = ProviderFactory.fromEnv();
      expect(factory.getDefault().type).toBe('ollama');
    });

    it('无 OPENAI_API_KEY 时不应创建 OpenAI provider', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.DEFAULT_PROVIDER = 'ollama';

      const factory = ProviderFactory.fromEnv();
      expect(() => factory.getByType('openai')).toThrow();
    });

    it('应解析 agent 级别的环境变量覆盖', () => {
      process.env.DEFAULT_PROVIDER = 'ollama';
      process.env.NARRATOR_PROVIDER = 'local';
      process.env.NARRATOR_MODEL = 'narrator-special';

      const factory = ProviderFactory.fromEnv();
      const result = factory.getForAgent('narrator');
      expect(result.provider.type).toBe('local');
      expect(result.model).toBe('narrator-special');
    });
  });

  describe('checkAvailability', () => {
    it('应返回所有 provider 的可用性状态', async () => {
      const factory = new ProviderFactory({
        defaultProvider: 'ollama',
        ollama: { host: 'http://localhost:11434' },
      });

      const results = await factory.checkAvailability();
      expect(typeof results).toBe('object');
      expect('ollama' in results).toBe(true);
      expect('local' in results).toBe(true);
    });
  });
});
