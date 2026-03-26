import { TileType as TT } from "../tile/index.js";
import type { RuleConfig } from "../rule/index.js";
import { GameLength, TobiRule, UmaRule, RoundingRule } from "../rule/index.js";
import type { RoundResult } from "../round/index.js";
import type { GameState, GameResult, RoundHistoryEntry } from "./types.js";
import { GamePhase } from "./types.js";

// ===== 場風の順序 =====

const ROUND_WINDS = [TT.Ton, TT.Nan, TT.Sha, TT.Pei] as const;

/** 東風なら東のみ、半荘なら東南 */
function getMaxWindIndex(gameLength: GameLength): number {
  return gameLength === GameLength.Tonpu ? 0 : 1;
}

// ===== ゲームの作成 =====

/**
 * 新しい対局を作成する
 */
export function createGame(ruleConfig: RuleConfig, initialDealerIndex?: number): GameState {
  // 起家: 指定がなければランダムに決定（0〜3）
  const dealerIndex = initialDealerIndex ?? Math.floor(Math.random() * 4);
  return {
    phase: GamePhase.NotStarted,
    ruleConfig,
    scores: [
      ruleConfig.startingPoints,
      ruleConfig.startingPoints,
      ruleConfig.startingPoints,
      ruleConfig.startingPoints,
    ],
    currentRound: { roundWind: TT.Ton, roundNumber: 1 },
    dealerIndex,
    honba: 0,
    riichiSticks: 0,
    roundHistory: [],
  };
}

/**
 * 対局を開始状態にする
 */
export function startGame(state: GameState): GameState {
  state.phase = GamePhase.InProgress;
  return state;
}

// ===== 局の結果を対局に反映 =====

/**
 * 局の結果をゲーム状態に反映し、次の局へ進めるかどうかを判定する。
 */
export function processRoundResult(state: GameState, roundResult: RoundResult): GameState {
  if (state.phase !== GamePhase.InProgress) {
    throw new Error(`不正なフェーズです: ${state.phase}`);
  }

  // 得点変動を反映
  for (let i = 0; i < 4; i++) {
    state.scores[i] += roundResult.scoreChanges[i];
  }

  // 履歴に追加
  const entry: RoundHistoryEntry = {
    roundIndex: { ...state.currentRound },
    honba: state.honba,
    result: roundResult,
  };
  state.roundHistory.push(entry);

  // 供託リーチ棒の処理
  // 和了の場合: 全リーチ棒は和了者の totalWinnerGain に含まれているため 0 にリセット
  // 流局の場合: 今局の新規リーチ棒を含めた全リーチ棒を次局に引き継ぎ
  if (roundResult.wins.length > 0) {
    state.riichiSticks = 0;
  } else {
    state.riichiSticks = roundResult.riichiSticksInRound;
  }

  // トビ判定
  if (checkTobi(state)) {
    state.phase = GamePhase.Finished;
    return state;
  }

  // 次の局へ進めるか終了か判定
  if (shouldGameEnd(state, roundResult)) {
    state.phase = GamePhase.Finished;
    return state;
  }

  // 連荘 or 局を進める
  if (roundResult.dealerKeeps) {
    // 連荘: 本場を増やす
    if (roundResult.incrementHonba) {
      state.honba++;
    }
  } else {
    // 親流れ: 次の局へ
    if (roundResult.incrementHonba) {
      state.honba++;
    } else {
      state.honba = 0;
    }
    advanceRound(state);
  }

  return state;
}

// ===== 局を進める =====

function advanceRound(state: GameState): void {
  state.dealerIndex = (state.dealerIndex + 1) % 4;

  const current = state.currentRound;
  if (current.roundNumber < 4) {
    state.currentRound = {
      roundWind: current.roundWind,
      roundNumber: current.roundNumber + 1,
    };
  } else {
    // 次の場風
    const windIndex = (ROUND_WINDS as readonly TT[]).indexOf(current.roundWind);
    const nextWindIndex = windIndex + 1;
    if (nextWindIndex < ROUND_WINDS.length) {
      state.currentRound = {
        roundWind: ROUND_WINDS[nextWindIndex],
        roundNumber: 1,
      };
    }
    // else: これ以上は shouldGameEnd で対局終了になっているはず
  }
}

// ===== 対局終了判定 =====

function shouldGameEnd(state: GameState, roundResult: RoundResult): boolean {
  const maxWindIndex = getMaxWindIndex(state.ruleConfig.gameLength);
  const currentWindIndex = (ROUND_WINDS as readonly TT[]).indexOf(state.currentRound.roundWind);
  const isLastRound = currentWindIndex === maxWindIndex && state.currentRound.roundNumber === 4;

  // アガリ止め判定
  if (isLastRound && state.ruleConfig.agariyame) {
    if (roundResult.dealerKeeps && roundResult.wins.length > 0) {
      const dealerIndex = state.dealerIndex;
      // 親がトップなら終了
      if (isTopPlayer(state.scores, dealerIndex)) {
        return true;
      }
    }
  }

  // オーラスで親が流れた場合
  if (isLastRound && !roundResult.dealerKeeps) {
    return true;
  }

  // オーラスで親が連荘している場合はまだ続く
  if (isLastRound && roundResult.dealerKeeps) {
    return false;
  }

  // 場風が終了している（次に進めない）場合
  // 東風戦で東4局が終わって親流れ → 終了
  // 半荘戦で南4局が終わって親流れ → 終了
  if (currentWindIndex > maxWindIndex) {
    return true;
  }

  // 延長戦: 通常は上記で終了するが、サドンデス等は未実装
  // (西入等はルール設定にないため非対応)

  return false;
}

// ===== トビ判定 =====

function checkTobi(state: GameState): boolean {
  const rule = state.ruleConfig.tobi;
  if (rule === TobiRule.Disabled) return false;

  for (const score of state.scores) {
    if (rule === TobiRule.BelowZero && score < 0) return true;
    if (rule === TobiRule.ZeroOrBelow && score <= 0) return true;
  }
  return false;
}

// ===== 最終結果の計算 =====

/**
 * 対局終了後の最終結果（順位・ポイント）を計算する
 */
export function calculateFinalResult(state: GameState): GameResult {
  const finalScores = [...state.scores] as [number, number, number, number];

  // 供託リーチ棒が残っている場合はトップが取る
  if (state.riichiSticks > 0) {
    const topIndex = getTopPlayerIndex(finalScores);
    finalScores[topIndex] += state.riichiSticks * 1000;
  }

  // 順位計算
  const rankings = calculateRankings(finalScores);

  // ポイント計算（ウマ・オカ）
  const finalPoints = calculatePoints(finalScores, rankings, state.ruleConfig);

  return {
    finalScores,
    rankings,
    finalPoints,
  };
}

// ===== 順位計算 =====

function calculateRankings(
  scores: readonly [number, number, number, number],
): [number, number, number, number] {
  const indexed = scores.map((s, i) => ({ score: s, index: i }));
  // 得点が高い順、同点は席順が前のプレイヤーが上位
  indexed.sort((a, b) => b.score - a.score || a.index - b.index);

  const rankings: [number, number, number, number] = [0, 0, 0, 0];
  for (let rank = 0; rank < 4; rank++) {
    rankings[indexed[rank].index] = rank + 1;
  }
  return rankings;
}

// ===== ポイント計算（ウマ・オカ） =====

function calculatePoints(
  scores: readonly [number, number, number, number],
  rankings: readonly [number, number, number, number],
  ruleConfig: RuleConfig,
): [number, number, number, number] {
  const returnPoints = ruleConfig.returnPoints;

  // 素点（返し点からの差分、千点単位）
  const rawPoints = scores.map((s) => (s - returnPoints) / 1000) as [
    number,
    number,
    number,
    number,
  ];

  // オカ（返し点と配給原点の差 × 4 がトップに加算）
  const oka = ((returnPoints - ruleConfig.startingPoints) * 4) / 1000;

  // ウマ
  const uma = getUmaValues(ruleConfig.uma);

  const points: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const rank = rankings[i];
    let pt = rawPoints[i] + uma[rank - 1];
    if (rank === 1) {
      pt += oka;
    }

    // 端数計算
    pt = applyRounding(pt, ruleConfig.rounding);
    points[i] = pt;
  }

  return points;
}

function getUmaValues(uma: UmaRule): [number, number, number, number] {
  switch (uma) {
    case UmaRule.Uma5_10:
      return [10, 5, -5, -10];
    case UmaRule.Uma10_20:
      return [20, 10, -10, -20];
    case UmaRule.Uma10_30:
      return [30, 10, -10, -30];
    case UmaRule.Uma20_30:
      return [30, 20, -20, -30];
    default:
      return [30, 10, -10, -30];
  }
}

function applyRounding(value: number, rule: RoundingRule): number {
  if (rule === RoundingRule.OneDecimal) {
    return Math.round(value * 10) / 10;
  }
  // 五捨六入
  const intPart = Math.floor(value);
  const decimal = value - intPart;
  if (decimal >= 0.6) {
    return intPart + 1;
  } else if (decimal <= -0.6) {
    // 負の場合
    return intPart;
  }
  // 五捨六入: 0.5 以下は切り捨て
  if (value >= 0) {
    return decimal >= 0.6 ? intPart + 1 : intPart;
  } else {
    // 負の値の五捨六入
    const absVal = Math.abs(value);
    const absInt = Math.floor(absVal);
    const absDec = absVal - absInt;
    return absDec >= 0.6 ? -(absInt + 1) : -absInt;
  }
}

// ===== ヘルパー =====

function isTopPlayer(scores: readonly [number, number, number, number], index: number): boolean {
  return scores[index] >= Math.max(...scores);
}

function getTopPlayerIndex(scores: readonly [number, number, number, number]): number {
  let topIndex = 0;
  for (let i = 1; i < 4; i++) {
    if (scores[i] > scores[topIndex]) {
      topIndex = i;
    }
  }
  return topIndex;
}

/**
 * 現在の局情報からゲームが進行可能かを返す
 */
export function getCurrentRoundInfo(state: GameState): {
  roundWind: string;
  roundNumber: number;
  honba: number;
  dealerIndex: number;
} {
  return {
    roundWind: state.currentRound.roundWind,
    roundNumber: state.currentRound.roundNumber,
    honba: state.honba,
    dealerIndex: state.dealerIndex,
  };
}
