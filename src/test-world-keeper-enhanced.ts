/**
 * 增强版 WorldKeeper 测试
 * 使用 0.5B 模型测试语义规则匹配
 */

import 'dotenv/config';
import chalk from 'chalk';
import { ProviderFactory } from './providers/provider-factory.js';
import { WorldKeeperEnhanced } from './agents/world-keeper-enhanced.js';
import type { WorldRules, RuleNode } from './rules/rule-types.js';

// 测试用的世界规则
const testWorldRules: WorldRules = {
  physics: [
    {
      id: 'magic-mana-cost',
      content: '魔法需要消耗生命力（mana），过度使用会虚弱甚至死亡',
      layer: 'physics',
      priority: 'hard',
      intent: '当场景涉及魔法使用时，强调代价和风险',
      keywords: ['魔法', '法术', 'mana', '魔力', '施法'],
      constant: true,
      tokenWeight: 1.5,
    },
    {
      id: 'no-modern-tech',
      content: '这个世界没有火药、电力和现代机械，技术停留在中世纪水平',
      layer: 'physics',
      priority: 'hard',
      intent: '限制科技发展，维持奇幻氛围',
      keywords: ['枪', '炮', '火药', '电', '机械', '汽车'],
    },
  ],
  society: [
    {
      id: 'noble-privilege',
      content: '贵族拥有法律特权，平民不得对贵族动武，违者重罚',
      layer: 'society',
      priority: 'soft',
      intent: '当场景涉及阶级冲突时，体现社会不平等',
      keywords: ['贵族', '平民', '阶级', '特权', '法律'],
    },
    {
      id: 'guild-magic-control',
      content: '所有法师必须注册于魔法行会，未经许可的魔法被视为黑魔法',
      layer: 'society',
      priority: 'soft',
      intent: '规范魔法使用者，增加身份冲突可能',
      keywords: ['法师', '行会', '注册', '黑魔法', '许可'],
    },
  ],
  narrative: [
    {
      id: 'ancient-prophecy',
      content: '古老预言说"当双月同天，封印将破，混沌再临"',
      layer: 'narrative',
      priority: 'suggestion',
      intent: '为史诗剧情提供背景张力',
      keywords: ['预言', '双月', '封印', '混沌'],
    },
  ],
  custom: [
    {
      id: 'dragon-treaty',
      content: '人类与龙族有千年和平条约，伤害龙族会引发全面战争',
      layer: 'custom',
      priority: 'hard',
      intent: '当场景涉及龙时，强调和平重要性',
      keywords: ['龙', 'dragon', '条约', '和平', '战争'],
    },
  ],
};

// 测试场景
const testScenes = [
  {
    name: '魔法治疗',
    description: '主角在贵族区的酒馆里，想用魔法治疗受伤的平民朋友',
    location: '贵族区酒馆',
    characters: ['主角', '受伤平民'],
    eventType: '治疗',
    userInput: '我施展治疗魔法',
    playerQuestion: '我能否用魔法治好他？',
  },
  {
    name: '龙族遭遇',
    description: '主角在野外遇到一条受伤的龙，龙看起来很虚弱',
    location: '野外',
    characters: ['主角', '龙'],
    eventType: '遭遇',
    userInput: '我想帮助这条龙',
    playerQuestion: '我可以治疗这条龙吗？',
  },
  {
    name: '阶级冲突',
    description: '一个贵族在酒馆里欺负平民，主角看不过去',
    location: '酒馆',
    characters: ['主角', '贵族', '平民'],
    eventType: '冲突',
    userInput: '我要阻止这个贵族',
    playerQuestion: '如果我动手会有什么后果？',
  },
];

async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     增强版 WorldKeeper 测试 (使用 qwen2.5:0.5b)            ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  // 1. 初始化 Provider
  console.log(chalk.yellow('初始化 AI Provider...'));
  const factory = ProviderFactory.fromEnv();
  const provider = factory.getDefault();

  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    console.log(chalk.red('❌ Provider 不可用，请检查 Ollama 服务'));
    return;
  }
  console.log(chalk.green(`✓ Provider 就绪: ${provider.name}\n`));

  // 2. 初始化增强版 WorldKeeper
  console.log(chalk.yellow('初始化增强版 WorldKeeper...'));
  const worldKeeper = new WorldKeeperEnhanced(provider, 'qwen2.5:0.5b');
  worldKeeper.loadWorldRules(testWorldRules);
  console.log(chalk.green('✓ WorldKeeper 已加载规则'));

  // 显示规则图谱信息
  const graphInfo = worldKeeper.getRuleGraphInfo();
  console.log(chalk.gray(`  总规则数: ${graphInfo.totalRules}`));
  console.log(chalk.gray(`  层级分布: ${JSON.stringify(graphInfo.layerDistribution)}`));
  console.log(chalk.gray(`  冲突数: ${graphInfo.conflicts}\n`));

  // 3. 测试每个场景
  for (let i = 0; i < testScenes.length; i++) {
    const scene = testScenes[i];

    console.log(chalk.bold.blue(`\n📍 场景 ${i + 1}: ${scene.name}`));
    console.log(chalk.gray(`   ${scene.description}`));
    console.log(chalk.gray(`   玩家输入: "${scene.userInput}"`));
    console.log(chalk.gray(`   玩家问题: "${scene.playerQuestion}"`));
    console.log('');

    // 3.1 展示语义匹配结果
    console.log(chalk.yellow('   语义规则匹配:'));
    const analysis = worldKeeper.analyzeScene({
      sceneDescription: scene.description,
      location: scene.location,
      characters: scene.characters,
      eventType: scene.eventType,
    });

    for (const match of analysis.matchedRules) {
      const icon = match.reason === 'keyword' ? '🔑' : match.reason === 'constant' ? '⭐' : '🧠';
      const color = match.score > 0.5 ? chalk.green : match.score > 0.2 ? chalk.yellow : chalk.gray;
      console.log(color(`   ${icon} ${match.rule.id} [${match.rule.layer}] ${(match.score * 100).toFixed(1)}% - ${match.reason}`));
    }

    // 3.2 调用 WorldKeeper 处理
    console.log(chalk.yellow('\n   WorldKeeper 响应:'));
    try {
      const response = await worldKeeper.processEnhanced(
        {
          from: 'player',
          content: scene.playerQuestion,
          context: {
            scene: scene.description,
            location: scene.location,
          },
        },
        {
          sceneDescription: scene.description,
          location: scene.location,
          characters: scene.characters,
          eventType: scene.eventType,
          userInput: scene.userInput,
        },
      );

      // 格式化输出
      const lines = response.content.split('\n');
      for (const line of lines) {
        if (line.startsWith('【')) {
          console.log(chalk.cyan(`   ${line}`));
        } else if (line.trim()) {
          console.log(`   ${line}`);
        }
      }

      // 显示元数据
      if (response.metadata?.matchedRules) {
        console.log(chalk.gray(`\n   [匹配规则: ${(response.metadata.matchedRules as string[]).join(', ')}]`));
      }
      if (response.usage) {
        console.log(chalk.gray(`   [Token: ${response.usage.totalTokens}]`));
      }
    } catch (err) {
      console.log(chalk.red(`   错误: ${err instanceof Error ? err.message : err}`));
    }

    console.log(chalk.gray('\n   ──────────────────────────────────────────'));
  }

  // 4. 测试规则冲突检测
  console.log(chalk.bold.blue('\n\n⚠️  规则冲突检测测试'));

  // 添加冲突规则
  const conflictRule: RuleNode = {
    id: 'no-magic-allowed',
    content: '这个世界完全禁止魔法，任何魔法行为都是死罪',
    layer: 'physics',
    priority: 'hard',
    intent: '禁止一切魔法',
    keywords: ['魔法', '法术'],
    conflictsWith: ['magic-mana-cost'],
  };

  worldKeeper.addRule(conflictRule);

  const conflicts = worldKeeper.detectConflicts();
  if (conflicts.conflicts.length > 0) {
    console.log(chalk.yellow('   检测到冲突:'));
    for (const conflict of conflicts.conflicts) {
      console.log(chalk.red(`   ❌ ${conflict.ruleA.id} vs ${conflict.ruleB.id}`));
      console.log(chalk.gray(`      ${conflict.description}`));
    }
  } else {
    console.log(chalk.green('   ✓ 无冲突'));
  }

  // 5. 总结
  console.log(chalk.bold.cyan('\n\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                    测试完成                                ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray('\n使用 0.5B 模型虽然质量有限，但足以验证:'));
  console.log(chalk.gray('1. 语义规则匹配正常工作'));
  console.log(chalk.gray('2. 规则上下文正确组装'));
  console.log(chalk.gray('3. 冲突检测功能正常'));
  console.log(chalk.gray('\n建议在 Mac 上使用 7B/14B 模型获得更好效果\n'));
}

main().catch(err => {
  console.error(chalk.red('测试失败:'), err);
  process.exit(1);
});
