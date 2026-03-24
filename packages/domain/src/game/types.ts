import type { TileType } from "../tile/index.js";
import type { RuleConfig } from "../rule/index.js";
import type { RoundResult } from "../round/index.js";

// ===== 対局のフェーズ =====

export const GamePhase = {
  /** 対局開始前 */
  NotStarted: "not-started",
  /** 対局中（局が進行中） */
  InProgress: "in-progress",
  /** 対局終了 */
  Finished: "finished",
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

// ===== 局番号の表現 =====

/**
 * 局を表す構造
 * 例: 東1局 = { roundWind: "ton", roundNumber: 1 }
 */
export interface RoundIndex {
  /** 場風 */
  readonly roundWind: TileType;
  /** 局番号（1-4） */
  readonly roundNumber: number;
}

// ===== ゲーム全体の状態 =====

export interface GameState {
  /** 現在のフェーズ */
  phase: GamePhase;
  /** ルール設定 */
  readonly ruleConfig: RuleConfig;
  /** 各プレイヤーの得点 */
  scores: [number, number, number, number];
  /** 現在の局（場風 + 局番号） */
  currentRound: RoundIndex;
  /** 現在の親のインデックス（0-3） */
  dealerIndex: number;
  /** 本場数 */
  honba: number;
  /** 供託リーチ棒の数 */
  riichiSticks: number;
  /** 各局の結果履歴 */
  roundHistory: RoundHistoryEntry[];
}

export interface RoundHistoryEntry {
  /** 局番号 */
  readonly roundIndex: RoundIndex;
  /** 本場数 */
  readonly honba: number;
  /** 局の結果 */
  readonly result: RoundResult;
}

// ===== 最終結果 =====

export interface GameResult {
  /** 各プレイヤーの最終得点 */
  readonly finalScores: readonly [number, number, number, number];
  /** 各プレイヤーの順位（1-4） */
  readonly rankings: readonly [number, number, number, number];
  /** 各プレイヤーのポイント（ウマ/オカ適用済み） */
  readonly finalPoints: readonly [number, number, number, number];
}
