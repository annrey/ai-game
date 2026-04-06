/**
 * AI 说书人委员会 — 交互式 Demo
 * 使用方法：npx tsx src/demo.ts [--mode adventure|battle|sandbox|roleplay]
 */

import { loadTestConfig } from './utils/config.js';
loadTestConfig();

import * as readline from 'readline';
import chalk from 'chalk';
import { ProviderFactory } from './providers/provider-factory.js';
import { createTextAdventure } from './modes/text-adventure.js';
import { createAIBattle } from './modes/ai-battle.js';
import { createNPCSandbox, SandboxTemplates } from './modes/npc-sandbox.js';
import { createChatRoleplay, RoleplayTemplates } from './modes/chat-roleplay.js';
import type { GameEngine } from './engine/game-engine.js';
import type { GameMode } from './types/game.js';
import { GameModeNames } from './types/game.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data');

async function main() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     AI 说书人委员会 · 游戏引擎 v0.1     ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝\n'));

  // 解析命令行参数
  const modeArg = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--mode') + 1]
    ?? 'adventure';

  const modeMap: Record<string, GameMode> = {
    adventure: 'text-adventure',
    battle: 'ai-battle',
    sandbox: 'npc-sandbox',
    roleplay: 'chat-roleplay',
  };

  const mode = modeMap[modeArg] ?? 'text-adventure';
  console.log(chalk.yellow(`游戏模式：${GameModeNames[mode]}`));

  // 初始化 Provider
  console.log(chalk.gray('正在初始化 AI Provider...'));
  const factory = await ProviderFactory.fromEnv();
  const availability = await factory.checkAvailability();

  for (const [name, available] of Object.entries(availability)) {
    console.log(`  ${available ? chalk.green('✓') : chalk.red('✗')} ${name}`);
  }
  console.log();

  // 创建引擎
  let engine: GameEngine;
  switch (mode) {
    case 'text-adventure':
      engine = createTextAdventure(factory, DATA_PATH);
      break;
    case 'ai-battle':
      engine = createAIBattle(factory, DATA_PATH);
      break;
    case 'npc-sandbox':
      engine = createNPCSandbox(factory, DATA_PATH);
      break;
    case 'chat-roleplay':
      engine = createChatRoleplay(factory, DATA_PATH);
      break;
    default:
      engine = createTextAdventure(factory, DATA_PATH);
  }

  // 生成开场
  console.log(chalk.gray('正在生成开场场景...\n'));
  try {
    const opening = await engine.processTurn('（游戏开始）请描述开场场景。');
    console.log(chalk.white(opening.narrative));
    console.log();
  } catch (err) {
    console.log(chalk.red(`AI 连接失败：${err instanceof Error ? err.message : err}`));
    console.log(chalk.yellow('请确保你的 AI 服务已启动并正确配置 .env 文件。\n'));
    return;
  }

  // 交互循环
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(chalk.green('\n> 你的行动：'), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // 特殊命令
      if (trimmed === '/quit' || trimmed === '/exit') {
        console.log(chalk.cyan('\n故事暂时告一段落...再见！\n'));
        rl.close();
        return;
      }

      if (trimmed === '/save') {
        const id = await engine.save(`save-${Date.now()}`);
        console.log(chalk.yellow(`\n已保存：${id}`));
        prompt();
        return;
      }

      if (trimmed === '/status') {
        const state = engine.getState();
        console.log(chalk.yellow(`\n位置：${state.currentLocation}`));
        console.log(chalk.yellow(`时间：第${state.worldTime.day}天 ${state.worldTime.hour}:${String(state.worldTime.minute).padStart(2, '0')}`));
        console.log(chalk.yellow(`NPC：${state.presentNPCs.map(n => n.name).join(', ') || '无'}`));
        console.log(chalk.yellow(`回合：${engine.getTurnCount()}`));
        prompt();
        return;
      }

      if (trimmed === '/help') {
        console.log(chalk.cyan('\n可用命令：'));
        console.log(chalk.gray('  /save   - 保存游戏'));
        console.log(chalk.gray('  /status - 查看当前状态'));
        console.log(chalk.gray('  /help   - 显示帮助'));
        console.log(chalk.gray('  /quit   - 退出游戏'));
        console.log(chalk.gray('  其他任何输入 - 作为游戏行动'));
        prompt();
        return;
      }

      // 处理玩家输入
      try {
        console.log(chalk.gray('\n（思考中...）'));
        const result = await engine.processTurn(trimmed);
        console.log(chalk.white(`\n${result.narrative}`));

        if (result.agentDetails.length > 0) {
          console.log(chalk.gray(`\n  [${result.agentDetails.map(d => d.from).join(', ')} 参与了本轮叙事]`));
        }
      } catch (err) {
        console.log(chalk.red(`\n处理失败：${err instanceof Error ? err.message : err}`));
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
