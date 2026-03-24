import { describe, it, expect } from "vitest";
import { TileType as TT } from "../tile/index.js";
import {
  createGame,
  startGame,
  processRoundResult,
  calculateFinalResult,
  getCurrentRoundInfo,
} from "./game.js";
import { GamePhase } from "./types.js";
import type { RoundResult, WinEntry } from "../round/index.js";
import { RoundEndReason } from "../round/index.js";
import {
  createDefaultRuleConfig,
  createTonpuDefaults,
  GameLength,
  TobiRule,
} from "../rule/index.js";

// ===== ヘルパー =====

function makeWinResult(opts: {
  dealerKeeps: boolean;
  scoreChanges: [number, number, number, number];
  wins?: WinEntry[];
  riichiSticksInRound?: number;
}): RoundResult {
  return {
    reason: RoundEndReason.Win,
    wins: opts.wins ?? [
      {
        winnerIndex: 0,
        loserIndex: 1,
        scoreResult: {} as WinEntry["scoreResult"],
      },
    ],
    scoreChanges: opts.scoreChanges,
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: opts.dealerKeeps,
    incrementHonba: opts.dealerKeeps,
    riichiSticksInRound: opts.riichiSticksInRound ?? 0,
  };
}

function makeDrawResult(opts: {
  dealerKeeps: boolean;
  scoreChanges?: [number, number, number, number];
  riichiSticksInRound?: number;
}): RoundResult {
  return {
    reason: RoundEndReason.ExhaustiveDraw,
    wins: [],
    scoreChanges: opts.scoreChanges ?? [0, 0, 0, 0],
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: opts.dealerKeeps,
    incrementHonba: true,
    riichiSticksInRound: opts.riichiSticksInRound ?? 0,
  };
}

// ===== createGame =====

describe("createGame", () => {
  it("デフォルト半荘ルールでゲームを作成できる", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    expect(game.phase).toBe(GamePhase.NotStarted);
    expect(game.scores).toEqual([25000, 25000, 25000, 25000]);
    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 1 });
    expect(game.dealerIndex).toBe(0);
    expect(game.honba).toBe(0);
    expect(game.riichiSticks).toBe(0);
    expect(game.roundHistory).toHaveLength(0);
  });

  it("東風ルールでも作成できる", () => {
    const rule = createTonpuDefaults();
    const game = createGame(rule);
    expect(game.phase).toBe(GamePhase.NotStarted);
    expect(game.ruleConfig.gameLength).toBe(GameLength.Tonpu);
  });
});

// ===== startGame =====

describe("startGame", () => {
  it("InProgress に遷移する", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);
    expect(game.phase).toBe(GamePhase.InProgress);
  });
});

// ===== processRoundResult =====

describe("processRoundResult", () => {
  it("得点変動が正しく反映される", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    const result = makeWinResult({
      dealerKeeps: false,
      scoreChanges: [8000, -8000, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.scores).toEqual([33000, 17000, 25000, 25000]);
  });

  it("履歴が追加される", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    const result = makeWinResult({
      dealerKeeps: false,
      scoreChanges: [0, 0, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.roundHistory).toHaveLength(1);
    expect(game.roundHistory[0].roundIndex).toEqual({ roundWind: TT.Ton, roundNumber: 1 });
  });

  it("親流れ: 東1局→東2局に進む", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    const result = makeWinResult({
      dealerKeeps: false,
      scoreChanges: [0, 0, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 2 });
    expect(game.dealerIndex).toBe(1);
  });

  it("連荘: 東1局で親和了→東1局1本場", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    const result = makeWinResult({
      dealerKeeps: true,
      scoreChanges: [8000, -8000, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 1 });
    expect(game.dealerIndex).toBe(0);
    expect(game.honba).toBe(1);
  });

  it("東4局で親流れ → 南1局に進む（半荘）", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    // 東1~3局を親流れで進める
    for (let i = 0; i < 3; i++) {
      processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));
    }

    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 4 });
    expect(game.dealerIndex).toBe(3);

    // 東4局で親流れ
    processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));

    expect(game.currentRound).toEqual({ roundWind: TT.Nan, roundNumber: 1 });
    expect(game.dealerIndex).toBe(0);
  });

  it("南4局で親流れ → ゲーム終了（半荘）", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    // 東1~4 + 南1~3 で親流れ（計7局）
    for (let i = 0; i < 7; i++) {
      processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));
    }

    expect(game.currentRound).toEqual({ roundWind: TT.Nan, roundNumber: 4 });
    expect(game.phase).toBe(GamePhase.InProgress);

    // 南4局で親流れ → 終了
    processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));

    expect(game.phase).toBe(GamePhase.Finished);
  });

  it("東風戦: 東4局で親流れ → 終了", () => {
    const rule = createTonpuDefaults();
    const game = createGame(rule);
    startGame(game);

    for (let i = 0; i < 3; i++) {
      processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));
    }

    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 4 });

    processRoundResult(game, makeWinResult({ dealerKeeps: false, scoreChanges: [0, 0, 0, 0] }));

    expect(game.phase).toBe(GamePhase.Finished);
  });

  it("トビ: 持ち点が負→ゲーム終了（BelowZero）", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    // プレイヤー1が大量失点
    const result = makeWinResult({
      dealerKeeps: true,
      scoreChanges: [30000, -30000, 0, 0],
    });
    processRoundResult(game, result);

    // -5000 < 0 → トビ
    expect(game.scores[1]).toBe(-5000);
    expect(game.phase).toBe(GamePhase.Finished);
  });

  it("トビ無効の場合は負の持ち点でも続行", () => {
    const rule = { ...createDefaultRuleConfig(), tobi: TobiRule.Disabled };
    const game = createGame(rule);
    startGame(game);

    const result = makeWinResult({
      dealerKeeps: true,
      scoreChanges: [30000, -30000, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.scores[1]).toBe(-5000);
    expect(game.phase).toBe(GamePhase.InProgress);
  });

  it("荒牌流局で本場が増える", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    // 荒牌流局、親テンパイで連荘
    processRoundResult(game, makeDrawResult({ dealerKeeps: true }));
    expect(game.honba).toBe(1);
    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 1 });
  });

  it("荒牌流局、親ノーテンで親流れ+本場増加", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);

    processRoundResult(game, makeDrawResult({ dealerKeeps: false }));
    expect(game.honba).toBe(1);
    expect(game.currentRound).toEqual({ roundWind: TT.Ton, roundNumber: 2 });
    expect(game.dealerIndex).toBe(1);
  });

  it("和了で供託リーチ棒がリセットされる", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);
    game.riichiSticks = 3; // 3本供託

    const result = makeWinResult({
      dealerKeeps: false,
      scoreChanges: [8000, -8000, 0, 0],
    });
    processRoundResult(game, result);

    expect(game.riichiSticks).toBe(0);
  });

  it("流局で供託リーチ棒は残る", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    startGame(game);
    game.riichiSticks = 2;

    processRoundResult(game, makeDrawResult({ dealerKeeps: true, riichiSticksInRound: 2 }));

    expect(game.riichiSticks).toBe(2);
  });

  it("NotStarted フェーズではエラー", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);

    expect(() => {
      processRoundResult(game, makeDrawResult({ dealerKeeps: true }));
    }).toThrow("不正なフェーズです");
  });
});

// ===== calculateFinalResult =====

describe("calculateFinalResult", () => {
  it("全員25000点なら順位は席順通り", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    expect(result.rankings).toEqual([1, 2, 3, 4]);
  });

  it("得点が高い順に順位がつく", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    game.scores = [10000, 40000, 30000, 20000];
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    expect(result.rankings).toEqual([4, 1, 2, 3]);
  });

  it("供託リーチ棒が残っている場合トップに加算", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    game.scores = [30000, 25000, 25000, 20000];
    game.riichiSticks = 2;
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    // トップ(P0: 30000) + リーチ棒 2 × 1000 = 32000
    expect(result.finalScores[0]).toBe(32000);
  });

  it("ウマ10-30 / 返し30000 / 配給原点25000 のポイント計算", () => {
    // デフォルト: uma=10-30, return=30000, start=25000
    // oka = (30000-25000)*4/1000 = 20
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    game.scores = [40000, 30000, 20000, 10000];
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    // P0(1位): (40000-30000)/1000 + 30 + 20(oka) = 10+30+20 = 60
    // P1(2位): (30000-30000)/1000 + 10 = 10
    // P2(3位): (20000-30000)/1000 - 10 = -20
    // P3(4位): (10000-30000)/1000 - 30 = -50
    // 五捨六入で整数値
    expect(result.finalPoints[0]).toBe(60);
    expect(result.finalPoints[1]).toBe(10);
    expect(result.finalPoints[2]).toBe(-20);
    expect(result.finalPoints[3]).toBe(-50);
  });

  it("同点の場合は席順が前のプレイヤーが上位", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);
    game.scores = [25000, 25000, 30000, 20000];
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    // P2: 30000(1位), P0: 25000(2位), P1: 25000(3位), P3: 20000(4位)
    expect(result.rankings).toEqual([2, 3, 1, 4]);
  });
});

// ===== getCurrentRoundInfo =====

describe("getCurrentRoundInfo", () => {
  it("初期状態の局情報を取得できる", () => {
    const rule = createDefaultRuleConfig();
    const game = createGame(rule);

    const info = getCurrentRoundInfo(game);
    expect(info.roundWind).toBe(TT.Ton);
    expect(info.roundNumber).toBe(1);
    expect(info.honba).toBe(0);
    expect(info.dealerIndex).toBe(0);
  });
});
