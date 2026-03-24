import {
  type TileType,
  TileType as TT,
  getNumberTileInfo,
  isTerminalOrHonor,
} from "../tile/index.js";
import {
  type ParsedHand,
  type ParsedGroup,
  GroupType,
  type WinContext,
  isMenzen,
} from "../yaku/index.js";
import type { FuBreakdown, FuDetail } from "./types.js";

// ===== ヘルパー =====

/** ダミー Tile オブジェクト（TileType のみ使用） */
function dummyTile(type: TileType) {
  return { type, id: 0, isRedDora: false };
}

/** TileType が幺九牌かどうか */
function isTOH(type: TileType): boolean {
  return isTerminalOrHonor(dummyTile(type));
}

// ===== 待ちの種類判定 =====

/**
 * 待ちの種類
 */
export const WaitType = {
  /** 両面待ち (0符) */
  Ryanmen: "ryanmen",
  /** 双碰待ち (0符) */
  Shanpon: "shanpon",
  /** 嵌張待ち (2符) */
  Kanchan: "kanchan",
  /** 辺張待ち (2符) */
  Penchan: "penchan",
  /** 単騎待ち (2符) */
  Tanki: "tanki",
} as const;

export type WaitType = (typeof WaitType)[keyof typeof WaitType];

/**
 * 和了牌に基づく待ちの種類を判定する
 *
 * 複数の待ち形が解釈可能な場合は最も有利（低い符）のものを返す
 */
export function detectWaitType(hand: ParsedHand, ctx: WinContext): WaitType {
  const winType = ctx.winTile.type;

  // 和了牌が雀頭の一部の可能性 → 単騎待ち
  // ただし他のグループで和了牌を使える場合は別の解釈が可能
  const canBeTanki = winType === hand.pair;

  // 和了牌が刻子/槓子の一部の可能性 → 双碰待ち
  let canBeShanpon = false;

  // 和了牌が順子の一部の可能性
  let canBeRyanmen = false;
  let canBeKanchan = false;
  let canBePenchan = false;

  for (const g of hand.groups) {
    if (
      (g.type === GroupType.Koutsu || g.type === GroupType.Kantsu) &&
      g.tileType === winType &&
      !g.isOpen
    ) {
      canBeShanpon = true;
    }

    if (g.type === GroupType.Shuntsu) {
      const info = getNumberTileInfo(dummyTile(g.tileType));
      if (!info) continue;
      const n = info.number; // 順子の先頭数字
      const suit = info.suit;
      const prefix = suit === "manzu" ? "man" : suit === "souzu" ? "sou" : "pin";
      const t0 = `${prefix}${n}` as TileType;
      const t1 = `${prefix}${n + 1}` as TileType;
      const t2 = `${prefix}${n + 2}` as TileType;

      if (winType === t0) {
        // 左端で和了: N,N+1,N+2 の N
        // N+2 が 9 (= N が 7) → ペンチャン 7-8-9
        if (n === 7) {
          canBePenchan = true;
        } else {
          canBeRyanmen = true;
        }
      } else if (winType === t2) {
        // 右端で和了: N,N+1,N+2 の N+2
        // N が 1 → ペンチャン 1-2-3
        if (n === 1) {
          canBePenchan = true;
        } else {
          canBeRyanmen = true;
        }
      } else if (winType === t1) {
        // 中央で和了: 嵌張
        canBeKanchan = true;
      }
    }
  }

  // 最も有利な（符が低い）待ちを返す
  // 両面 (0符) > 双碰 (0符) > 嵌張 (2符) = 辺張 (2符) = 単騎 (2符)
  if (canBeRyanmen) return WaitType.Ryanmen;
  if (canBeShanpon) return WaitType.Shanpon;
  if (canBeKanchan) return WaitType.Kanchan;
  if (canBePenchan) return WaitType.Penchan;
  if (canBeTanki) return WaitType.Tanki;

  // フォールバック（通常到達しない）
  return WaitType.Ryanmen;
}

/** 待ちの符を返す */
function waitFu(waitType: WaitType): number {
  switch (waitType) {
    case WaitType.Ryanmen:
    case WaitType.Shanpon:
      return 0;
    case WaitType.Kanchan:
    case WaitType.Penchan:
    case WaitType.Tanki:
      return 2;
  }
}

// ===== 面子の符 =====

/** 1つの面子グループの符を計算する */
function groupFu(g: ParsedGroup): number {
  if (g.type === GroupType.Shuntsu) return 0;

  const base = g.type === GroupType.Kantsu ? 8 : 2;
  const tohMultiplier = isTOH(g.tileType) ? 2 : 1;
  const closedMultiplier = g.isOpen ? 1 : 2;

  return base * tohMultiplier * closedMultiplier;
}

// ===== 雀頭の符 =====

/** 雀頭の符を計算する */
function pairFu(pair: TileType, ctx: WinContext): number {
  let fu = 0;

  // 三元牌
  if (pair === TT.Haku || pair === TT.Hatsu || pair === TT.Chun) {
    fu = 2;
  }

  // 場風
  if (pair === ctx.roundWind) {
    fu += 2;
  }

  // 自風
  if (pair === ctx.seatWind) {
    // 連風牌（場風と自風が同じ場合）はルール設定に依存
    if (pair === ctx.roundWind) {
      // 上で場風分の 2 を既に加算済み → 連風牌のルールに応じて調整
      // doubleWindFu が 4 なら合計 4 にする (既に 2 加算済みなので +2)
      // doubleWindFu が 2 なら合計 2 のまま (追加なし)
      if (ctx.ruleConfig.doubleWindFu === 4) {
        fu += 2; // 合計 4
      }
      // doubleWindFu === 2 の場合は追加なし（場風分の 2 のまま）
    } else {
      fu += 2;
    }
  }

  return fu;
}

// ===== メイン: 符計算 =====

/**
 * 符を計算する
 *
 * @param hand ParsedHand（4面子1雀頭の分解結果）
 * @param ctx WinContext
 * @param isPinfu 平和が成立しているか
 * @returns FuBreakdown
 */
export function calculateFu(hand: ParsedHand, ctx: WinContext, isPinfu: boolean): FuBreakdown {
  const details: FuDetail[] = [];

  // --- 平和ツモの特殊ケース: 一律 20 符 ---
  if (isPinfu && ctx.isTsumo) {
    details.push({ label: "平和ツモ", fu: 20 });
    return { details, rawTotal: 20, total: 20 };
  }

  // --- 副底（基本符） ---
  details.push({ label: "副底", fu: 20 });
  let total = 20;

  // --- 門前ロン加符 ---
  if (!ctx.isTsumo && isMenzen(ctx.melds)) {
    details.push({ label: "門前ロン", fu: 10 });
    total += 10;
  }

  // --- ツモ符 ---
  if (ctx.isTsumo && !isPinfu) {
    details.push({ label: "ツモ", fu: 2 });
    total += 2;
  }

  // --- 面子符 ---
  for (const g of hand.groups) {
    const fu = groupFu(g);
    if (fu > 0) {
      const label = formatGroupLabel(g);
      details.push({ label, fu });
      total += fu;
    }
  }

  // --- 雀頭符 ---
  const pFu = pairFu(hand.pair, ctx);
  if (pFu > 0) {
    details.push({ label: `雀頭(${hand.pair})`, fu: pFu });
    total += pFu;
  }

  // --- 待ち符 ---
  const wait = detectWaitType(hand, ctx);
  const wFu = waitFu(wait);
  if (wFu > 0) {
    details.push({ label: `待ち(${wait})`, fu: wFu });
    total += wFu;
  }

  // --- 鳴きピンフ形の特殊ケース ---
  // 副露している手で符が 20 のままの場合（全順子 + 役牌でない雀頭 + 両面待ち）
  // → 30 符に繰り上げ（通称「食い平和 30 符」）
  // ただし: 副底 20 + ツモ 2 = 22 → 切り上げ 30 は通常ルートで処理される
  // ロンの場合: 副底 20 のみ → 切り上げで 20 になるが、麻雀では最低 30 符
  if (!isMenzen(ctx.melds) && !ctx.isTsumo && total === 20) {
    total = 30;
  }

  // --- 10 の位に切り上げ ---
  const rounded = Math.ceil(total / 10) * 10;

  return { details, rawTotal: total, total: rounded };
}

/**
 * 七対子の符を返す（ルール設定に依存）
 */
export function calculateChiitoitsuFu(ctx: WinContext): FuBreakdown {
  const isAlt = ctx.ruleConfig.chiitoitsuCalc === "50fu-1han";
  const fu = isAlt ? 50 : 25;
  const details: FuDetail[] = [{ label: "七対子", fu }];
  return { details, rawTotal: fu, total: fu };
}

// ===== フォーマット用ヘルパー =====

function formatGroupLabel(g: ParsedGroup): string {
  const typeLabel =
    g.type === GroupType.Koutsu ? "刻子" : g.type === GroupType.Kantsu ? "槓子" : "順子";
  const openLabel = g.isOpen ? "明" : "暗";
  return `${openLabel}${typeLabel}(${g.tileType})`;
}
