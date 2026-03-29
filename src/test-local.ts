/**
 * 快速验证脚本 — 测试本地 AI 连通性
 * 用法：npx tsx src/test-local.ts
 */

import 'dotenv/config';
import chalk from 'chalk';
import { ProviderFactory } from './providers/provider-factory.js';

async function main() {
  console.log(chalk.bold.cyan('\n===== 本地 AI 连通性测试 =====\n'));

  const factory = ProviderFactory.fromEnv();

  // 1. 检测所有 Provider 可用性
  console.log(chalk.yellow('检测 Provider 可用性...'));
  const availability = await factory.checkAvailability();
  for (const [name, available] of Object.entries(availability)) {
    console.log(`  ${available ? chalk.green('✓') : chalk.red('✗')} ${name}`);
  }
  console.log();

  // 2. 列出可用模型
  console.log(chalk.yellow('列出可用模型...'));
  const allModels = await factory.listAllModels();
  for (const [provider, models] of Object.entries(allModels)) {
    if (models.length > 0) {
      console.log(`  ${chalk.cyan(provider)}:`);
      for (const m of models) {
        console.log(`    - ${m.id}`);
      }
    }
  }
  console.log();

  // 3. 快速对话测试
  const defaultProvider = factory.getDefault();
  const isUp = await defaultProvider.isAvailable();

  if (!isUp) {
    console.log(chalk.red(`默认 Provider (${defaultProvider.name}) 不可用，跳过对话测试。`));
    console.log(chalk.yellow('请确保 Ollama 或 LM Studio 已启动。\n'));
    return;
  }

  console.log(chalk.yellow(`对话测试（使用 ${defaultProvider.name}）...`));
  const testMessages = [
    { role: 'system' as const, content: '你是一个简洁的助手，用中文回答。' },
    { role: 'user' as const, content: '用一句话描述一个奇幻世界的酒馆场景。' },
  ];

  try {
    console.log(chalk.gray('  请求中...\n'));
    const response = await defaultProvider.chat(testMessages, { temperature: 0.8 });
    console.log(chalk.green('  回复：') + response.content);
    if (response.usage) {
      console.log(chalk.gray(`  Token: prompt=${response.usage.promptTokens}, completion=${response.usage.completionTokens}`));
    }
    console.log(chalk.green('\n✓ 本地 AI 连接成功！可以启动游戏了。\n'));
  } catch (err) {
    console.log(chalk.red(`  对话失败：${err instanceof Error ? err.message : err}`));
  }

  // 4. 流式输出测试
  console.log(chalk.yellow('流式输出测试...'));
  try {
    process.stdout.write(chalk.green('  '));
    for await (const chunk of defaultProvider.stream(testMessages, { temperature: 0.8 })) {
      if (chunk.content) process.stdout.write(chunk.content);
    }
    console.log(chalk.green('\n\n✓ 流式输出正常！\n'));
  } catch (err) {
    console.log(chalk.red(`\n  流式测试失败：${err instanceof Error ? err.message : err}\n`));
  }
}

main().catch(console.error);
