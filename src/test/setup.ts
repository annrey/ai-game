/**
 * Vitest 全局 setup
 * 在所有测试运行之前执行
 */

// 设置测试环境变量，避免连接真实 AI 后端
process.env.NODE_ENV = 'test';
process.env.DEFAULT_PROVIDER = 'ollama';
process.env.OLLAMA_HOST = 'http://localhost:11434';
process.env.OLLAMA_MODEL = 'test-model';
