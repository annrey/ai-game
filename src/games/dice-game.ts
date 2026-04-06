/**
 * 骰子游戏实现
 * 提供多种骰子游戏模式
 */

import type {
  DiceGame,
  DiceGameConfig,
  DiceRollResult,
  GameResult,
} from '../types/game.js';
import { DEFAULT_DICE_GAME_CONFIG } from '../types/game.js';

/**
 * 掷骰子
 * @param count 骰子数量
 * @param sides 骰子面数
 * @returns 骰子结果
 */
export function rollDice(count: number, sides: number): DiceRollResult {
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    values.push(Math.floor(Math.random() * sides) + 1);
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const isCritical = values.every(v => v === sides);
  const isFumble = values.every(v => v === 1);

  return {
    values,
    sum,
    isCritical,
    isFumble,
  };
}

/**
 * 创建新的骰子游戏
 * @param playerId 玩家ID
 * @param npcId NPC ID
 * @param bet 赌注
 * @param mode 游戏模式
 * @param config 游戏配置
 * @returns 骰子游戏实例
 */
export function createDiceGame(
  playerId: string,
  npcId: string,
  bet: number = 10,
  mode: DiceGame['mode'] = 'higher',
  config: DiceGameConfig = DEFAULT_DICE_GAME_CONFIG,
): DiceGame {
  const gameId = `dice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: gameId,
    type: 'dice',
    name: getGameModeName(mode),
    description: getGameModeDescription(mode),
    state: 'waiting',
    result: 'pending',
    participants: [playerId, npcId],
    bet,
    createdAt: Date.now(),
    diceCount: config.defaultDiceCount,
    diceSides: config.defaultDiceSides,
    playerRolls: [],
    npcRolls: [],
    mode,
    currentRound: 0,
    maxRounds: config.defaultMaxRounds,
  };
}

/**
 * 开始游戏
 * @param game 骰子游戏
 */
export function startGame(game: DiceGame): void {
  game.state = 'playing';
  game.currentRound = 1;
}

/**
 * 进行一轮游戏
 * @param game 骰子游戏
 * @returns 本轮结果描述
 */
export function playRound(game: DiceGame): {
  playerResult: DiceRollResult;
  npcResult: DiceRollResult;
  roundWinner: 'player' | 'npc' | 'draw';
  description: string;
} {
  if (game.state !== 'playing') {
    throw new Error('游戏未开始');
  }

  // 掷骰子
  const playerResult = rollDice(game.diceCount, game.diceSides);
  const npcResult = rollDice(game.diceCount, game.diceSides);

  game.playerRolls.push(...playerResult.values);
  game.npcRolls.push(...npcResult.values);

  // 判断胜负
  let roundWinner: 'player' | 'npc' | 'draw';
  let description: string;

  switch (game.mode) {
    case 'higher':
      // 比大
      if (playerResult.sum > npcResult.sum) {
        roundWinner = 'player';
        description = `你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。你赢了！`;
      } else if (playerResult.sum < npcResult.sum) {
        roundWinner = 'npc';
        description = `你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。你输了。`;
      } else {
        roundWinner = 'draw';
        description = `你们都掷出了 ${playerResult.sum} 点。平局！`;
      }
      break;

    case 'lower':
      // 比小
      if (playerResult.sum < npcResult.sum) {
        roundWinner = 'player';
        description = `你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。你赢了！`;
      } else if (playerResult.sum > npcResult.sum) {
        roundWinner = 'npc';
        description = `你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。你输了。`;
      } else {
        roundWinner = 'draw';
        description = `你们都掷出了 ${playerResult.sum} 点。平局！`;
      }
      break;

    case 'exact':
      // 猜点数
      const target = game.targetValue || 7;
      const playerDiff = Math.abs(playerResult.sum - target);
      const npcDiff = Math.abs(npcResult.sum - target);

      if (playerDiff < npcDiff) {
        roundWinner = 'player';
        description = `目标 ${target} 点，你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。你更接近！`;
      } else if (playerDiff > npcDiff) {
        roundWinner = 'npc';
        description = `目标 ${target} 点，你掷出了 ${playerResult.sum} 点，${game.participants[1]} 掷出了 ${npcResult.sum} 点。${game.participants[1]} 更接近。`;
      } else {
        roundWinner = 'draw';
        description = `目标 ${target} 点，你们都掷出了接近 ${playerResult.sum} 和 ${npcResult.sum} 点。平局！`;
      }
      break;

    case 'sum':
      // 累计点数
      const playerTotal = game.playerRolls.reduce((a, b) => a + b, 0);
      const npcTotal = game.npcRolls.reduce((a, b) => a + b, 0);

      if (playerTotal > npcTotal) {
        roundWinner = 'player';
        description = `本轮你掷出了 ${playerResult.sum} 点，总计 ${playerTotal} 点。${game.participants[1]} 总计 ${npcTotal} 点。你领先！`;
      } else if (playerTotal < npcTotal) {
        roundWinner = 'npc';
        description = `本轮你掷出了 ${playerResult.sum} 点，总计 ${playerTotal} 点。${game.participants[1]} 总计 ${npcTotal} 点。你落后。`;
      } else {
        roundWinner = 'draw';
        description = `本轮你掷出了 ${playerResult.sum} 点，总计 ${playerTotal} 点。${game.participants[1]} 也是 ${npcTotal} 点。平局！`;
      }
      break;

    default:
      roundWinner = 'draw';
      description = '未知的游戏模式';
  }

  // 检查特殊结果
  if (playerResult.isCritical) {
    description += ' 🎲 暴击！所有骰子都是最大值！';
  } else if (playerResult.isFumble) {
    description += ' 💀 大失败！所有骰子都是最小值！';
  }

  game.currentRound++;

  // 检查游戏是否结束
  if (game.currentRound > game.maxRounds) {
    finishGame(game);
  }

  return {
    playerResult,
    npcResult,
    roundWinner,
    description,
  };
}

/**
 * 结束游戏
 * @param game 骰子游戏
 */
export function finishGame(game: DiceGame): GameResult {
  game.state = 'finished';
  game.endedAt = Date.now();

  // 计算最终结果
  const playerTotal = game.playerRolls.reduce((a, b) => a + b, 0);
  const npcTotal = game.npcRolls.reduce((a, b) => a + b, 0);

  switch (game.mode) {
    case 'higher':
    case 'sum':
      game.result = playerTotal > npcTotal ? 'win' : playerTotal < npcTotal ? 'lose' : 'draw';
      break;
    case 'lower':
      game.result = playerTotal < npcTotal ? 'win' : playerTotal > npcTotal ? 'lose' : 'draw';
      break;
    case 'exact':
      const target = game.targetValue || 7;
      const playerDiff = Math.abs(playerTotal - target);
      const npcDiff = Math.abs(npcTotal - target);
      game.result = playerDiff < npcDiff ? 'win' : playerDiff > npcDiff ? 'lose' : 'draw';
      break;
    default:
      game.result = 'draw';
  }

  return game.result;
}

/**
 * 获取游戏模式名称
 */
function getGameModeName(mode: DiceGame['mode']): string {
  const names: Record<DiceGame['mode'], string> = {
    higher: '比大小',
    lower: '比小',
    exact: '猜点数',
    sum: '累计点数',
  };
  return names[mode];
}

/**
 * 获取游戏模式描述
 */
function getGameModeDescription(mode: DiceGame['mode']): string {
  const descriptions: Record<DiceGame['mode'], string> = {
    higher: '掷骰子比大小，点数大者获胜',
    lower: '掷骰子比小，点数小者获胜',
    exact: '掷骰子猜点数，最接近目标者获胜',
    sum: '多轮掷骰子累计点数，总点数决定胜负',
  };
  return descriptions[mode];
}

/**
 * 获取游戏结果描述
 */
export function getGameResultDescription(game: DiceGame): string {
  if (game.state !== 'finished') {
    return '游戏尚未结束';
  }

  const playerTotal = game.playerRolls.reduce((a, b) => a + b, 0);
  const npcTotal = game.npcRolls.reduce((a, b) => a + b, 0);

  switch (game.result) {
    case 'win':
      return `你赢了！你的总点数是 ${playerTotal}，对手是 ${npcTotal}。你获得了 ${game.bet} 金币！`;
    case 'lose':
      return `你输了。你的总点数是 ${playerTotal}，对手是 ${npcTotal}。你失去了 ${game.bet} 金币。`;
    case 'draw':
      return `平局！你们的总点数都是 ${playerTotal}。赌注退还。`;
    default:
      return '游戏结果未知';
  }
}
