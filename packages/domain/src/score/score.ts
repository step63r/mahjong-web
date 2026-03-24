import { Yaku } from "../yaku/index.js";
import type { ScoreContext, ScoreResult, ScoreLevel, PaymentResult } from "./types.js";
import { calculateFu, calculateChiitoitsuFu } from "./fu.js";

// ===== 基本点の計算 =====

/**
 * 飜数と符から基本点を計算する
 *
 * 基本点 = 符 × 2^(飜+2)
 * ただし、満貫以上は固定値
 */
function calcBasePoints(
  han: number,
  fu: number,
  kiriage: boolean,
): { basePoints: number; level: ScoreLevel } {
  // 役満（数え役満は 13 飜以上）
  if (han >= 13) {
    return { basePoints: 8000, level: "kazoe-yakuman" };
  }

  // 三倍満（11-12飜）
  if (han >= 11) {
    return { basePoints: 6000, level: "sanbaiman" };
  }

  // 倍満（8-10飜）
  if (han >= 8) {
    return { basePoints: 4000, level: "baiman" };
  }

  // 跳満（6-7飜）
  if (han >= 6) {
    return { basePoints: 3000, level: "haneman" };
  }

  // 満貫（5飜）
  if (han >= 5) {
    return { basePoints: 2000, level: "mangan" };
  }

  // 通常計算
  const raw = fu * Math.pow(2, han + 2);

  // 2000 以上は満貫
  if (raw >= 2000) {
    return { basePoints: 2000, level: "mangan" };
  }

  // 切り上げ満貫: 4飜30符 (1920) や 3飜60符 (1920) を満貫にする
  if (kiriage && raw >= 1920) {
    return { basePoints: 2000, level: "mangan" };
  }

  return { basePoints: raw, level: "normal" };
}

/**
 * 役満の基本点を計算する
 */
function calcYakumanBasePoints(yakumanTimes: number): { basePoints: number; level: ScoreLevel } {
  return { basePoints: 8000 * yakumanTimes, level: "yakuman" };
}

// ===== 支払い計算 =====

/** 100 点単位に切り上げ */
function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/**
 * ツモ和了時の支払い計算
 */
function calcTsumoPayment(
  basePoints: number,
  isDealer: boolean,
  honba: number,
  riichiSticks: number,
): PaymentResult {
  const honbaPerPlayer = honba * 100;
  const riichiTotal = riichiSticks * 1000;

  if (isDealer) {
    // 親ツモ: 各子が basePoints × 2 を支払い
    const childPayment = roundUp100(basePoints * 2) + honbaPerPlayer;
    const totalWinnerGain = childPayment * 3 + riichiTotal;
    return {
      totalWinnerGain,
      ronLoserPayment: 0,
      tsumoPaymentDealer: 0,
      tsumoPaymentChild: childPayment,
    };
  } else {
    // 子ツモ: 親が basePoints × 2、他の子が basePoints × 1 を支払い
    const dealerPayment = roundUp100(basePoints * 2) + honbaPerPlayer;
    const childPayment = roundUp100(basePoints * 1) + honbaPerPlayer;
    const totalWinnerGain = dealerPayment + childPayment * 2 + riichiTotal;
    return {
      totalWinnerGain,
      ronLoserPayment: 0,
      tsumoPaymentDealer: dealerPayment,
      tsumoPaymentChild: childPayment,
    };
  }
}

/**
 * ロン和了時の支払い計算
 */
function calcRonPayment(
  basePoints: number,
  isDealer: boolean,
  honba: number,
  riichiSticks: number,
): PaymentResult {
  const honbaTotal = honba * 300;
  const riichiTotal = riichiSticks * 1000;

  if (isDealer) {
    // 親ロン: basePoints × 6
    const payment = roundUp100(basePoints * 6) + honbaTotal;
    return {
      totalWinnerGain: payment + riichiTotal,
      ronLoserPayment: payment,
      tsumoPaymentDealer: 0,
      tsumoPaymentChild: 0,
    };
  } else {
    // 子ロン: basePoints × 4
    const payment = roundUp100(basePoints * 4) + honbaTotal;
    return {
      totalWinnerGain: payment + riichiTotal,
      ronLoserPayment: payment,
      tsumoPaymentDealer: 0,
      tsumoPaymentChild: 0,
    };
  }
}

// ===== メイン: 点数計算 =====

/**
 * 点数を計算する
 *
 * judgeWin の結果と追加のコンテキストから最終的な点数と支払い情報を算出する
 */
export function calculateScore(scoreCtx: ScoreContext): ScoreResult {
  const { judgeResult, winContext, isDealer, honba, riichiSticks } = scoreCtx;
  const isTsumo = winContext.isTsumo;
  const kiriage = winContext.ruleConfig.kiriage;

  // --- 役満の場合 ---
  if (judgeResult.totalYakumanTimes > 0) {
    const { basePoints, level } = calcYakumanBasePoints(judgeResult.totalYakumanTimes);
    const payment = isTsumo
      ? calcTsumoPayment(basePoints, isDealer, honba, riichiSticks)
      : calcRonPayment(basePoints, isDealer, honba, riichiSticks);

    return {
      judgeResult,
      fuBreakdown: undefined,
      totalHan: 0,
      totalFu: 0,
      basePoints,
      level,
      payment,
    };
  }

  // --- 七対子の判定 ---
  const isChiitoitsu = judgeResult.yakuList.some((y) => y.yaku === Yaku.Chiitoitsu);

  let totalFu: number;
  let fuBreakdown;
  let totalHan = judgeResult.totalHan;

  if (isChiitoitsu) {
    // 七対子: 固定符
    fuBreakdown = calculateChiitoitsuFu(winContext);
    totalFu = fuBreakdown.total;

    // 50符1飜ルールの場合は飜数を調整
    if (winContext.ruleConfig.chiitoitsuCalc === "50fu-1han") {
      // 七対子の基本飜を 2 → 1 に変更
      // judgeResult.totalHan には既に 2 飜が加算されているので 1 引く
      totalHan = totalHan - 1;
    }
  } else {
    // 通常の符計算
    if (!judgeResult.parsedHand) {
      // 国士無双など面子分解がない場合（役満として処理されるはずだが念のため）
      totalFu = 30;
      fuBreakdown = undefined;
    } else {
      // 平和判定
      const isPinfu = judgeResult.yakuList.some((y) => y.yaku === Yaku.Pinfu);
      fuBreakdown = calculateFu(judgeResult.parsedHand, winContext, isPinfu);
      totalFu = fuBreakdown.total;
    }
  }

  // --- 基本点計算 ---
  const { basePoints, level } = calcBasePoints(totalHan, totalFu, kiriage);

  // --- 支払い計算 ---
  const payment = isTsumo
    ? calcTsumoPayment(basePoints, isDealer, honba, riichiSticks)
    : calcRonPayment(basePoints, isDealer, honba, riichiSticks);

  return {
    judgeResult,
    fuBreakdown,
    totalHan,
    totalFu,
    basePoints,
    level,
    payment,
  };
}
