/**
 * 游戏管理器
 * 管理所有迷你游戏的生命周期和状态
 */

import type {
  MiniGame,
  GameHistory,
  GameManagerConfig,
  DiceGame,
} from '../types/game.js';
import {
  createDiceGame,
  startGame as startDiceGame,
  playRound as playDiceRound,
  finishGame as finishDiceGame,
  getGameResultDescription,
} from '../games/dice-game.js';

const DEFAULT_CONFIG: GameManagerConfig = {
  enabled: true,
  defaultBet: 10,
  cooldownTime: 60000, // 1分钟冷却
  maxConcurrentGames: 3,
  enableHistory: true,
};

export class GameManager {
  private games = new Map<string, MiniGame>();
  private gameHistory: GameHistory[] = [];
  private config: GameManagerConfig;
  private playerCooldowns = new Map<string, number>();

  constructor(config: Partial<GameManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 检查玩家是否可以开始新游戏 */
  canStartGame(playerId: string): boolean {
    if (!this.config.enabled) return false;

    // 检查冷却时间
    const lastGameTime = this.playerCooldowns.get(playerId) || 0;
    if (Date.now() - lastGameTime < this.config.cooldownTime) {
      return false;
    }

    // 检查并发游戏数
    const activeGames = this.getActiveGamesForPlayer(playerId);
    if (activeGames.length >= this.config.maxConcurrentGames) {
      return false;
    }

    return true;
  }

  /** 获取玩家的活跃游戏 */
  getActiveGamesForPlayer(playerId: string): MiniGame[] {
    return Array.from(this.games.values()).filter(
      game => game.participants.includes(playerId) && game.state === 'playing'
    );
  }

  /** 创建骰子游戏 */
  createDiceGame(
    playerId: string,
    npcId: string,
    bet: number = this.config.defaultBet,
    mode: DiceGame['mode'] = 'higher',
  ): DiceGame | null {
    if (!this.canStartGame(playerId)) {
      return null;
    }

    const game = createDiceGame(playerId, npcId, bet, mode);
    this.games.set(game.id, game);
    return game;
  }

  /** 开始游戏 */
  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.state !== 'waiting') return false;

    if (game.type === 'dice') {
      startDiceGame(game as DiceGame);
    }

    return true;
  }

  /** 进行游戏回合 */
  playRound(gameId: string): {
    success: boolean;
    description?: string;
    game?: DiceGame;
  } {
    const game = this.games.get(gameId);
    if (!game || game.state !== 'playing') {
      return { success: false };
    }

    if (game.type === 'dice') {
      const diceGame = game as DiceGame;
      const result = playDiceRound(diceGame);

      // 检查游戏是否结束
      if (diceGame.state === 'finished') {
        this.finishGame(gameId);
      }

      return {
        success: true,
        description: result.description,
        game: diceGame,
      };
    }

    return { success: false };
  }

  /** 结束游戏 */
  finishGame(gameId: string): MiniGame | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    if (game.type === 'dice') {
      finishDiceGame(game as DiceGame);
    }

    // 记录冷却时间
    for (const participant of game.participants) {
      this.playerCooldowns.set(participant, Date.now());
    }

    // 记录游戏历史
    if (this.config.enableHistory) {
      this.recordGameHistory(game);
    }

    return game;
  }

  /** 取消游戏 */
  cancelGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.state === 'finished') return false;

    game.state = 'cancelled';
    game.endedAt = Date.now();
    return true;
  }

  /** 获取游戏 */
  getGame(gameId: string): MiniGame | undefined {
    return this.games.get(gameId);
  }

  /** 获取游戏结果描述 */
  getGameResult(gameId: string): string {
    const game = this.games.get(gameId);
    if (!game) return '游戏不存在';

    if (game.type === 'dice') {
      return getGameResultDescription(game as DiceGame);
    }

    return '未知的游戏类型';
  }

  /** 记录游戏历史 */
  private recordGameHistory(game: MiniGame): void {
    const goldChange: Record<string, number> = {};

    for (const participant of game.participants) {
      if (game.result === 'win' && participant === game.participants[0]) {
        goldChange[participant] = game.bet;
      } else if (game.result === 'lose' && participant === game.participants[0]) {
        goldChange[participant] = -game.bet;
      } else if (game.result === 'win' && participant !== game.participants[0]) {
        goldChange[participant] = -game.bet;
      } else if (game.result === 'lose' && participant !== game.participants[0]) {
        goldChange[participant] = game.bet;
      } else {
        goldChange[participant] = 0;
      }
    }

    const history: GameHistory = {
      id: `hist-${Date.now()}`,
      gameType: game.type,
      participants: game.participants,
      result: game.result,
      goldChange,
      playedAt: game.createdAt,
      duration: (game.endedAt || Date.now()) - game.createdAt,
    };

    this.gameHistory.push(history);

    // 限制历史记录数量
    if (this.gameHistory.length > 50) {
      this.gameHistory.shift();
    }
  }

  /** 获取游戏历史 */
  getGameHistory(playerId?: string): GameHistory[] {
    if (playerId) {
      return this.gameHistory.filter(h => h.participants.includes(playerId));
    }
    return [...this.gameHistory];
  }

  /** 获取统计信息 */
  getStats(playerId: string): {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    totalGoldWon: number;
    totalGoldLost: number;
  } {
    const playerHistory = this.getGameHistory(playerId);

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalGoldWon = 0;
    let totalGoldLost = 0;

    for (const game of playerHistory) {
      const goldChange = game.goldChange[playerId] || 0;

      if (goldChange > 0) {
        wins++;
        totalGoldWon += goldChange;
      } else if (goldChange < 0) {
        losses++;
        totalGoldLost += Math.abs(goldChange);
      } else {
        draws++;
      }
    }

    return {
      totalGames: playerHistory.length,
      wins,
      losses,
      draws,
      totalGoldWon,
      totalGoldLost,
    };
  }

  /** 清除所有游戏 */
  clear(): void {
    this.games.clear();
    this.gameHistory = [];
    this.playerCooldowns.clear();
  }

  /** 获取活跃游戏数量 */
  getActiveGameCount(): number {
    return Array.from(this.games.values()).filter(g => g.state === 'playing').length;
  }
}
