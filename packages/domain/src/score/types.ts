import type { JudgeResult, WinContext } from "../yaku/index.js";

// ===== 符の内訳 =====

/**
 * 符の内訳の個別項目
 */
export interface FuDetail {
  /** 符の名称 */
  readonly label: string;
  /** 符の値 */
  readonly fu: number;
}

/**
 * 符の計算結果
 */
export interface FuBreakdown {
  /** 各項目の内訳 */
  readonly details: readonly FuDetail[];
  /** 合計符（切り上げ前） */
  readonly rawTotal: number;
  /** 合計符（10の位に切り上げ後） */
  readonly total: number;
}

// ===== 点数レベル =====

/**
 * 点数のレベル（満貫以上の段階）
 */
export const ScoreLevel = {
  /** 通常（符×飜で計算） */
  Normal: "normal",
  /** 満貫 */
  Mangan: "mangan",
  /** 跳満 */
  Haneman: "haneman",
  /** 倍満 */
  Baiman: "baiman",
  /** 三倍満 */
  Sanbaiman: "sanbaiman",
  /** 数え役満 */
  KazoeYakuman: "kazoe-yakuman",
  /** 役満 */
  Yakuman: "yakuman",
} as const;

export type ScoreLevel = (typeof ScoreLevel)[keyof typeof ScoreLevel];

// ===== 支払い情報 =====

/**
 * 支払い情報
 */
export interface PaymentResult {
  /** 和了者の獲得点数（本場・供託を含む総額） */
  readonly totalWinnerGain: number;
  /** 放銃者の支払い（ロン時のみ、ツモ時は 0） */
  readonly ronLoserPayment: number;
  /** ツモ時の親の支払い（和了者が子の場合の親の支払額、和了者が親の場合は 0） */
  readonly tsumoPaymentDealer: number;
  /** ツモ時の子の支払い（1人あたり） */
  readonly tsumoPaymentChild: number;
}

// ===== 最終結果 =====

/**
 * 点数計算の最終結果
 */
export interface ScoreResult {
  /** 役判定結果 */
  readonly judgeResult: JudgeResult;
  /** 符の内訳（役満・七対子の場合は undefined） */
  readonly fuBreakdown?: FuBreakdown;
  /** 合計飜数（役満の場合は 0） */
  readonly totalHan: number;
  /** 合計符（役満の場合は 0） */
  readonly totalFu: number;
  /** 基本点（符 × 2^(飜+2)、満貫以上で上限適用後） */
  readonly basePoints: number;
  /** 点数レベル */
  readonly level: ScoreLevel;
  /** 支払い情報 */
  readonly payment: PaymentResult;
}

// ===== 点数計算コンテキスト =====

/**
 * 点数計算に必要な追加情報
 */
export interface ScoreContext {
  /** 役判定結果 */
  readonly judgeResult: JudgeResult;
  /** 和了コンテキスト */
  readonly winContext: WinContext;
  /** 和了者が親かどうか */
  readonly isDealer: boolean;
  /** 積み棒の数 */
  readonly honba: number;
  /** 場に出ているリーチ棒の数 */
  readonly riichiSticks: number;
}
