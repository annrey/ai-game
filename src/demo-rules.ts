/**
 * 增强规则系统演示
 * 展示语义规则匹配、冲突检测、效果预测
 */

import { RuleEngine } from './rules/rule-engine.js';
import { RulePredictor } from './rules/rule-predictor.js';
import type { WorldRules, RuleNode, SceneContext } from './rules/rule-types.js';

// 示例世界规则
const exampleWorldRules: WorldRules = {
  physics: [
    {
      id: 'magic-exists',
      content: '这个世界存在魔法，但魔法需要消耗生命力（mana）',
      layer: 'physics',
      priority: 'hard',
      intent: '当场景涉及超自然力量使用时，确保魔法有代价',
      keywords: ['魔法', '法术', 'mana', '魔力'],
      constant: true,
      tokenWeight: 1.5,
    },
    {
      id: 'no-gunpowder',
      content: '这个世界没有火药，远程武器只有弓箭和魔法',
      layer: 'physics',
      priority: 'hard',
      intent: '限制科技发展水平，维持中世纪奇幻氛围',
      keywords: ['枪', '炮', '火药', '火器', '射击'],
      conflictsWith: ['tech-guns'],
    },
  ],
  society: [
    {
      id: 'noble-commoner-gap',
      content: '贵族与平民之间存在严格的阶级壁垒，平民不得佩戴武器进入贵族区',
      layer: 'society',
      priority: 'soft',
      intent: '当场景涉及社会互动时，体现阶级差异',
      keywords: ['贵族', '平民', '阶级', '武器', '贵族区'],
    },
    {
      id: 'guild-system',
      content: '所有职业者必须加入对应行会，否则被视为非法从业者',
      layer: 'society',
      priority: 'soft',
      intent: '规范职业行为，增加组织冲突可能',
      keywords: ['行会', '职业', '公会', '从业者'],
    },
  ],
  narrative: [
    {
      id: 'hero-prophecy',
      content: '传说中会有一位"星之子"拯救世界，但没人知道是谁',
      layer: 'narrative',
      priority: 'suggestion',
      intent: '为主线剧情提供背景张力，但不强制',
      keywords: ['星之子', '预言', '拯救', '传说'],
    },
  ],
  custom: [
    {
      id: 'dragon-peace',
      content: '龙族与人类有千年和平条约，任何一方先攻击都会引发战争',
      layer: 'custom',
      priority: 'hard',
      intent: '当场景涉及龙族时，强调和平条约的重要性',
      keywords: ['龙', 'dragon', '条约', '和平'],
    },
  ],
};

// 示例场景
const exampleScenes: SceneContext[] = [
  {
    description: '主角在贵族区的酒馆里，想用魔法治疗受伤的平民',
    location: '贵族区酒馆',
    characters: ['主角', '受伤平民'],
    eventType: '治疗',
    userInput: '我施展治疗魔法',
  },
  {
    description: '主角在野外遇到一条龙，龙看起来很友好',
    location: '野外',
    characters: ['主角', '龙'],
    eventType: '遭遇',
    userInput: '我想和龙交谈',
  },
  {
    description: '主角想购买一把火枪防身',
    location: '武器店',
    characters: ['主角', '店主'],
    eventType: '交易',
    userInput: '我要买火枪',
  },
];

function demoRuleEngine() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     增强规则系统 - 语义匹配演示          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const engine = new RuleEngine();
  engine.loadWorldRules(exampleWorldRules);

  // 展示规则图谱信息
  const graphInfo = {
    totalRules: exampleWorldRules.physics.length +
      exampleWorldRules.society.length +
      exampleWorldRules.narrative.length +
      exampleWorldRules.custom.length,
    layerDistribution: {
      physics: exampleWorldRules.physics.length,
      society: exampleWorldRules.society.length,
      narrative: exampleWorldRules.narrative.length,
      custom: exampleWorldRules.custom.length,
    },
  };

  console.log('📊 规则图谱概览');
  console.log(`   总规则数: ${graphInfo.totalRules}`);
  console.log(`   层级分布: 物理${graphInfo.layerDistribution.physics} | 社会${graphInfo.layerDistribution.society} | 叙事${graphInfo.layerDistribution.narrative} | 自定义${graphInfo.layerDistribution.custom}`);
  console.log('');

  // 场景匹配演示
  for (let i = 0; i < exampleScenes.length; i++) {
    const scene = exampleScenes[i];
    console.log(`\n📍 场景 ${i + 1}: ${scene.description.slice(0, 40)}...`);
    console.log(`   玩家输入: "${scene.userInput}"`);
    console.log('');

    const matches = engine.matchRules(scene);
    console.log('   匹配的规则:');
    for (const match of matches.slice(0, 3)) {
      const icon = match.reason === 'keyword' ? '🔑' : match.reason === 'constant' ? '⭐' : '🧠';
      console.log(`   ${icon} ${match.rule.id} [${match.rule.layer}] ${(match.score * 100).toFixed(1)}%`);
      console.log(`      → ${match.rule.content.slice(0, 50)}...`);
    }

    // 组装规则上下文
    const assembled = engine.assembleRules(matches, {
      maxTokens: 1000,
      detectConflicts: true,
      autoResolveConflicts: true,
      minRules: 1,
      maxRules: 5,
    });

    console.log('   组装后的规则上下文:');
    console.log('   ' + assembled.split('\n').join('\n   '));
  }
}

function demoConflictDetection() {
  console.log('\n\n╔══════════════════════════════════════════╗');
  console.log('║         规则冲突检测演示                 ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const engine = new RuleEngine();

  // 添加冲突的规则
  const conflictingRules: RuleNode[] = [
    {
      id: 'no-magic',
      content: '这个世界不存在魔法',
      layer: 'physics',
      priority: 'hard',
      intent: '禁止任何魔法元素',
      keywords: ['魔法'],
      conflictsWith: ['magic-exists'],
    },
    {
      id: 'magic-exists',
      content: '魔法是这个世界的基础',
      layer: 'physics',
      priority: 'hard',
      intent: '确保魔法存在',
      keywords: ['魔法'],
      conflictsWith: ['no-magic'],
    },
  ];

  for (const rule of conflictingRules) {
    engine.addRule(rule);
  }

  const validation = engine.validateRules(conflictingRules);

  console.log('⚠️  检测到规则冲突:');
  for (const conflict of validation.conflicts) {
    console.log(`   ❌ ${conflict.ruleA.id} vs ${conflict.ruleB.id}`);
    console.log(`      类型: ${conflict.conflictType}`);
    console.log(`      描述: ${conflict.description}`);
  }

  // 展示冲突解决
  const scene: SceneContext = {
    description: '测试场景',
    userInput: '使用魔法',
  };

  const matches = engine.matchRules(scene);
  console.log('\n🔄 自动冲突解决后:');
  const assembled = engine.assembleRules(matches, {
    maxTokens: 500,
    detectConflicts: true,
    autoResolveConflicts: true,
    minRules: 1,
    maxRules: 5,
  });
  console.log('   ' + assembled.split('\n').join('\n   '));
}

async function demoRulePredictor() {
  console.log('\n\n╔══════════════════════════════════════════╗');
  console.log('║         规则效果预测演示                 ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const predictor = new RulePredictor(); // 无 AI  provider，使用启发式

  const testRule: RuleNode = {
    id: 'demo-rule',
    content: '所有贵族必须在日落前返回城堡，违者将被剥夺头衔',
    layer: 'society',
    priority: 'hard',
    intent: '当场景涉及贵族夜间活动时，限制其行为',
    keywords: ['贵族', '城堡', '日落', '头衔'],
  };

  const testScene: SceneContext = {
    description: '一位贵族想深夜留在酒馆调查线索',
    location: '酒馆',
    characters: ['贵族调查员'],
    eventType: '调查',
    userInput: '我要整夜待在酒馆',
  };

  console.log('📝 测试规则:');
  console.log(`   ${testRule.content}`);
  console.log('');
  console.log('🎬 测试场景:');
  console.log(`   ${testScene.description}`);
  console.log(`   玩家输入: "${testScene.userInput}"`);
  console.log('');

  const result = await predictor.predict({
    rule: testRule,
    testScene,
  });

  console.log('🔮 预测结果:');
  console.log(`   场景影响: ${result.prediction.sceneImpact}`);
  console.log(`   生成偏向: ${result.prediction.generationBias}`);
  console.log(`   置信度: ${(result.prediction.confidence * 100).toFixed(1)}%`);
  console.log('');

  console.log('💡 建议:');
  for (const suggestion of result.suggestions) {
    console.log(`   • ${suggestion}`);
  }

  if (result.potentialIssues.length > 0) {
    console.log('');
    console.log('⚠️  潜在问题:');
    for (const issue of result.potentialIssues) {
      console.log(`   • ${issue}`);
    }
  }
}

// 运行演示
async function main() {
  demoRuleEngine();
  demoConflictDetection();
  await demoRulePredictor();

  console.log('\n\n✨ 演示完成！');
  console.log('这些功能已集成到 WorldKeeperEnhanced 中');
}

main().catch(console.error);
