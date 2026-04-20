import { type TileType, TileSuit, isTerminalOrHonor, getTileSuit } from "../tile/index.js";
import type { WinContext, JudgeResult, YakuResult } from "./types.js";
import { Yaku } from "./types.js";
import { parseMentsu, parseChiitoitsu } from "./parser.js";
import { checkAllNormalYaku } from "./yaku-normal.js";
import { checkAllYakuman } from "./yaku-yakuman.js";

/** ダミー Tile オブジェクト（TileType のみ使用） */
function dummyTile(type: TileType) {
  return { type, id: 0, isRedDora: false };
}

// ===== 七対子の役判定 =====

/**
 * 七対子として判定した場合の YakuResult を返す
 */
function judgeChiitoitsu(ctx: WinContext): JudgeResult | null {
  const closedTypes = ctx.handTiles.map((t) => t.type);
  if (ctx.melds.length > 0) return null;
  if (!parseChiitoitsu(closedTypes)) return null;

  const yakuList: YakuResult[] = [];

  // 七対子本体（2飜）
  yakuList.push({ yaku: Yaku.Chiitoitsu, han: 2, yakumanTimes: 0 });

  // 状況役
  if (ctx.isRiichi && !ctx.isDoubleRiichi) {
    yakuList.push({ yaku: Yaku.Riichi, han: 1, yakumanTimes: 0 });
  }
  if (ctx.isDoubleRiichi) {
    yakuList.push({ yaku: Yaku.DoubleRiichi, han: 2, yakumanTimes: 0 });
  }
  if (ctx.isIppatsu && ctx.ruleConfig.ippatsu) {
    yakuList.push({ yaku: Yaku.Ippatsu, han: 1, yakumanTimes: 0 });
  }
  if (ctx.isTsumo) {
    yakuList.push({ yaku: Yaku.MenzenTsumo, han: 1, yakumanTimes: 0 });
  }
  if (ctx.isHaitei) {
    yakuList.push({ yaku: Yaku.Haitei, han: 1, yakumanTimes: 0 });
  }
  if (ctx.isHoutei) {
    yakuList.push({ yaku: Yaku.Houtei, han: 1, yakumanTimes: 0 });
  }

  // 断么九
  const allTypes = closedTypes;
  const hasTOH = allTypes.some((t) => isTerminalOrHonor(dummyTile(t)));
  if (!hasTOH) {
    yakuList.push({ yaku: Yaku.Tanyao, han: 1, yakumanTimes: 0 });
  }

  // 混一色 / 清一色
  const suits = new Set(allTypes.map((t) => getTileSuit(dummyTile(t))));
  const numberSuits = new Set(
    [...suits].filter((s) => s === TileSuit.Manzu || s === TileSuit.Souzu || s === TileSuit.Pinzu),
  );
  const hasHonor = suits.has(TileSuit.Kaze) || suits.has(TileSuit.Sangen);
  if (numberSuits.size === 1 && !hasHonor) {
    yakuList.push({ yaku: Yaku.Chinitsu, han: 6, yakumanTimes: 0 });
  } else if (numberSuits.size === 1 && hasHonor) {
    yakuList.push({ yaku: Yaku.Honitsu, han: 3, yakumanTimes: 0 });
  }

  // 混老頭（七対子との複合は全対子が幺九牌）
  if (allTypes.every((t) => isTerminalOrHonor(dummyTile(t)))) {
    yakuList.push({ yaku: Yaku.Honroutou, han: 2, yakumanTimes: 0 });
  }

  const totalHan = yakuList.reduce((sum, y) => sum + y.han, 0);
  return { yakuList, totalHan, totalYakumanTimes: 0 };
}

// ===== メイン判定 =====

/**
 * 和了コンテキストから最適な役の組み合わせを判定する
 *
 * 1. 全面子分解パターンを列挙
 * 2. 各パターンに対して通常役＋役満を判定
 * 3. 七対子・国士も判定
 * 4. 最も飜数（または役満倍数）が高い組み合わせを返す
 *
 * @returns 役が1つも成立しない場合は null
 */
export function judgeWin(ctx: WinContext): JudgeResult | null {
  const closedTypes = ctx.handTiles.map((t) => t.type);
  const candidates: JudgeResult[] = [];

  // --- 4面子1雀頭の分解 ---
  const parsedHands = parseMentsu(closedTypes, ctx.melds);

  for (const hand of parsedHands) {
    // 役満を先にチェック
    const yakumanList = checkAllYakuman(hand, ctx);
    if (yakumanList.length > 0) {
      // 人和が役満でない場合（倍満/跳満）は通常役として扱う
      const pureYakuman = yakumanList.filter((y) => y.yakumanTimes > 0);
      const nonYakuman = yakumanList.filter((y) => y.yakumanTimes === 0);

      if (pureYakuman.length > 0) {
        candidates.push({
          yakuList: pureYakuman,
          totalHan: 0,
          totalYakumanTimes: pureYakuman.reduce((sum, y) => sum + y.yakumanTimes, 0),
          parsedHand: hand,
        });
      }
      if (nonYakuman.length > 0) {
        // 人和が倍満/跳満の場合、人和の飜数のみで点数を確定（他の役は加算しない）
        const totalHan = nonYakuman.reduce((sum, y) => sum + y.han, 0);
        candidates.push({
          yakuList: nonYakuman,
          totalHan,
          totalYakumanTimes: 0,
          parsedHand: hand,
        });
      }
    }

    // 通常役
    const normalYaku = checkAllNormalYaku(hand, ctx);
    if (normalYaku.length > 0) {
      const totalHan = normalYaku.reduce((sum, y) => sum + y.han, 0);
      candidates.push({
        yakuList: normalYaku,
        totalHan,
        totalYakumanTimes: 0,
        parsedHand: hand,
      });
    }
  }

  // --- 七対子 ---
  const chiitoitsuResult = judgeChiitoitsu(ctx);
  if (chiitoitsuResult) {
    candidates.push(chiitoitsuResult);
  }

  // --- 国士無双（面子分解不要なのでここで独立判定） ---
  const kokushiYakuman = checkAllYakuman(undefined, ctx);
  if (kokushiYakuman.length > 0) {
    const pureYakuman = kokushiYakuman.filter((y) => y.yakumanTimes > 0);
    if (pureYakuman.length > 0) {
      candidates.push({
        yakuList: pureYakuman,
        totalHan: 0,
        totalYakumanTimes: pureYakuman.reduce((sum, y) => sum + y.yakumanTimes, 0),
      });
    }
  }

  if (candidates.length === 0) return null;

  // --- ドラを加算 ---
  // ドラは役ではないが飜数に加算する（候補選択後に加算）

  // --- 最良の結果を選択 ---
  // 役満 > 通常役。同じ場合は飜数が高い方を選ぶ
  candidates.sort((a, b) => {
    if (a.totalYakumanTimes !== b.totalYakumanTimes) {
      return b.totalYakumanTimes - a.totalYakumanTimes;
    }
    return b.totalHan - a.totalHan;
  });

  const best = candidates[0];

  // ドラ加算（役満でない場合のみ）
  if (best.totalYakumanTimes === 0) {
    const doraHan = ctx.doraCount + ctx.uraDoraCount + ctx.redDoraCount;
    if (doraHan > 0) {
      return {
        ...best,
        totalHan: best.totalHan + doraHan,
      };
    }
  }

  return best;
}
