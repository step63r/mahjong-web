import {
  type TileType,
  TileSuit,
  TileType as TT,
  getNumberTileInfo,
  getTileSuit,
  isHonorTile,
  isTerminal,
} from "../tile/index.js";
import {
  type ParsedGroup,
  type ParsedHand,
  GroupType,
  type WinContext,
  type YakuResult,
  Yaku,
  isMenzen,
} from "./types.js";
import { parseKokushi } from "./parser.js";

// ===== ヘルパー =====

function dummyTile(type: TileType) {
  return { type, id: 0, isRedDora: false };
}

function getGroupTileTypes(g: ParsedGroup): TileType[] {
  if (g.type === GroupType.Shuntsu) {
    const info = getNumberTileInfo(dummyTile(g.tileType));
    if (!info) return [g.tileType];
    const suit = info.suit;
    const prefix = suit === TileSuit.Manzu ? "man" : suit === TileSuit.Souzu ? "sou" : "pin";
    return [
      `${prefix}${info.number}` as TileType,
      `${prefix}${info.number + 1}` as TileType,
      `${prefix}${info.number + 2}` as TileType,
    ];
  }
  return [g.tileType];
}

function allTileTypes(hand: ParsedHand): TileType[] {
  const result: TileType[] = [];
  for (const g of hand.groups) {
    result.push(...getGroupTileTypes(g));
  }
  result.push(hand.pair, hand.pair);
  return result;
}

function allKoutsuOrKantsu(hand: ParsedHand): ParsedGroup[] {
  return hand.groups.filter((g) => g.type === GroupType.Koutsu || g.type === GroupType.Kantsu);
}

// ===== 役満 =====

/** 天和（親の配牌和了） */
export function checkTenhou(ctx: WinContext): YakuResult | null {
  if (!ctx.isTenhou) return null;
  return { yaku: Yaku.Tenhou, han: 0, yakumanTimes: 1 };
}

/** 地和（子の第一ツモ和了） */
export function checkChiihou(ctx: WinContext): YakuResult | null {
  if (!ctx.isChiihou) return null;
  return { yaku: Yaku.Chiihou, han: 0, yakumanTimes: 1 };
}

/** 人和（ルール設定に応じて役満/倍満/跳満/無し） */
export function checkRenhou(ctx: WinContext): YakuResult | null {
  if (!ctx.isRenhou) return null;
  const rule = ctx.ruleConfig.renhou;
  if (rule === "yakuman") return { yaku: Yaku.Renhou, han: 0, yakumanTimes: 1 };
  if (rule === "baiman") return { yaku: Yaku.Renhou, han: 8, yakumanTimes: 0 };
  if (rule === "haneman") return { yaku: Yaku.Renhou, han: 6, yakumanTimes: 0 };
  return null; // disabled
}

/** 国士無双（特殊形、十三面ならダブル役満） */
export function checkKokushi(ctx: WinContext): YakuResult | null {
  if (ctx.melds.length > 0) return null;
  const closedTypes = ctx.handTiles.map((t) => t.type);
  const result = parseKokushi(closedTypes, ctx.winTile.type);
  if (result === "kokushi-13") {
    return { yaku: Yaku.KokushiJuusanmen, han: 0, yakumanTimes: 2 };
  }
  if (result === "kokushi") {
    return { yaku: Yaku.Kokushi, han: 0, yakumanTimes: 1 };
  }
  return null;
}

/** 四暗刻（閉じた刻子4つ、単騎ならダブル役満） */
export function checkSuuankou(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  if (!isMenzen(ctx.melds)) return null;

  const closedKoutsuOrKantsu = hand.groups.filter(
    (g) => (g.type === GroupType.Koutsu || g.type === GroupType.Kantsu) && !g.isOpen,
  );
  if (closedKoutsuOrKantsu.length < 4) return null;

  // ツモなら必ず四暗刻
  if (ctx.isTsumo) {
    // 単騎待ちかどうか: 和了牌が雀頭を構成する場合は単騎
    if (ctx.winTile.type === hand.pair) {
      return { yaku: Yaku.SuuankouTanki, han: 0, yakumanTimes: 2 };
    }
    return { yaku: Yaku.Suuankou, han: 0, yakumanTimes: 1 };
  }

  // ロンの場合: 和了牌が雀頭を構成する場合でないと四暗刻にならない
  // （和了牌が刻子の一部だと明刻扱いになるため3暗刻+1明刻になる）
  if (ctx.winTile.type === hand.pair) {
    return { yaku: Yaku.SuuankouTanki, han: 0, yakumanTimes: 2 };
  }
  return null;
}

/** 大三元（三元牌の刻子/槓子3つ） */
export function checkDaisangen(hand: ParsedHand): YakuResult | null {
  const sangenTypes: TileType[] = [TT.Haku, TT.Hatsu, TT.Chun];
  const koutsu = allKoutsuOrKantsu(hand);
  const count = koutsu.filter((g) => sangenTypes.includes(g.tileType)).length;
  if (count === 3) return { yaku: Yaku.Daisangen, han: 0, yakumanTimes: 1 };
  return null;
}

/** 字一色（全牌が字牌） */
export function checkTsuuiisou(hand: ParsedHand): YakuResult | null {
  const types = allTileTypes(hand);
  if (types.every((t) => isHonorTile(dummyTile(t)))) {
    return { yaku: Yaku.Tsuuiisou, han: 0, yakumanTimes: 1 };
  }
  return null;
}

/** 緑一色（緑色の牌のみ: 索子2,3,4,6,8 + 發） */
export function checkRyuuiisou(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const greenTypes: Set<TileType> = new Set([
    TT.Sou2,
    TT.Sou3,
    TT.Sou4,
    TT.Sou6,
    TT.Sou8,
    ...(ctx.ruleConfig.ryuuiisouWithoutHatsu ? [] : []),
    TT.Hatsu,
  ]);
  // 發なし緑一色を許容する場合は Hatsu を含めても含めなくてもOK
  // 許容しない場合は Hatsu 必須 → 下で別途チェック
  const types = allTileTypes(hand);
  if (!types.every((t) => greenTypes.has(t))) return null;

  // 發なし緑一色の設定
  if (!ctx.ruleConfig.ryuuiisouWithoutHatsu) {
    if (!types.includes(TT.Hatsu)) return null;
  }

  return { yaku: Yaku.Ryuuiisou, han: 0, yakumanTimes: 1 };
}

/** 小四喜（風牌の刻子3 + 雀頭1） */
export function checkShousuushii(hand: ParsedHand): YakuResult | null {
  const windTypes: TileType[] = [TT.Ton, TT.Nan, TT.Sha, TT.Pei];
  const koutsu = allKoutsuOrKantsu(hand);
  const windKoutsu = koutsu.filter((g) => windTypes.includes(g.tileType)).length;
  if (windKoutsu === 3 && windTypes.includes(hand.pair)) {
    return { yaku: Yaku.Shousuushii, han: 0, yakumanTimes: 1 };
  }
  return null;
}

/** 大四喜（風牌の刻子/槓子4つ、ダブル役満） */
export function checkDaisuushii(hand: ParsedHand): YakuResult | null {
  const windTypes: TileType[] = [TT.Ton, TT.Nan, TT.Sha, TT.Pei];
  const koutsu = allKoutsuOrKantsu(hand);
  const windKoutsu = koutsu.filter((g) => windTypes.includes(g.tileType)).length;
  if (windKoutsu === 4) {
    return { yaku: Yaku.Daisuushii, han: 0, yakumanTimes: 2 };
  }
  return null;
}

/** 清老頭（数牌の1,9のみ） */
export function checkChinroutou(hand: ParsedHand): YakuResult | null {
  const types = allTileTypes(hand);
  if (types.every((t) => isTerminal(dummyTile(t)))) {
    return { yaku: Yaku.Chinroutou, han: 0, yakumanTimes: 1 };
  }
  return null;
}

/** 九蓮宝燈（1スートで 1112345678999 + 任意1枚、門前限定） */
export function checkChuurenPoutou(ctx: WinContext): YakuResult | null {
  if (!isMenzen(ctx.melds)) return null;
  // 暗槓があると九蓮宝燈にならない
  if (ctx.melds.length > 0) return null;

  const types = ctx.handTiles.map((t) => t.type);
  if (types.length !== 14) return null;

  // 1スートであること
  const suits = new Set(types.map((t) => getTileSuit(dummyTile(t))));
  if (suits.size !== 1) return null;
  const suit = [...suits][0];

  // 数牌のスートであること
  if (suit !== TileSuit.Manzu && suit !== TileSuit.Souzu && suit !== TileSuit.Pinzu) return null;

  // 萬子のみの設定チェック
  if (ctx.ruleConfig.chuurenManzuOnly && suit !== TileSuit.Manzu) return null;

  // 枚数カウント
  const counts = new Map<number, number>();
  for (const t of types) {
    const info = getNumberTileInfo(dummyTile(t));
    if (!info) return null;
    counts.set(info.number, (counts.get(info.number) ?? 0) + 1);
  }

  // 1112345678999 の形: 1が3枚以上, 9が3枚以上, 2-8が各1枚以上
  if ((counts.get(1) ?? 0) < 3) return null;
  if ((counts.get(9) ?? 0) < 3) return null;
  for (let n = 2; n <= 8; n++) {
    if ((counts.get(n) ?? 0) < 1) return null;
  }

  // 純正九蓮宝燈: 和了牌を1枚抜くと 1,1,1,2,3,4,5,6,7,8,9,9,9 になるか
  const winInfo = getNumberTileInfo(ctx.winTile);
  if (!winInfo) return null;
  const basePattern = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9];
  const handWithoutWin = new Map(counts);
  handWithoutWin.set(winInfo.number, (handWithoutWin.get(winInfo.number) ?? 0) - 1);

  let isJunsei = true;
  const baseCounts = new Map<number, number>();
  for (const n of basePattern) {
    baseCounts.set(n, (baseCounts.get(n) ?? 0) + 1);
  }
  for (let n = 1; n <= 9; n++) {
    if ((handWithoutWin.get(n) ?? 0) !== (baseCounts.get(n) ?? 0)) {
      isJunsei = false;
      break;
    }
  }

  if (isJunsei) {
    return { yaku: Yaku.JunseiChuuren, han: 0, yakumanTimes: 2 };
  }
  return { yaku: Yaku.ChuurenPoutou, han: 0, yakumanTimes: 1 };
}

/** 四槓子（槓子4つ） */
export function checkSuukantsu(hand: ParsedHand): YakuResult | null {
  const kantsuCount = hand.groups.filter((g) => g.type === GroupType.Kantsu).length;
  if (kantsuCount === 4) return { yaku: Yaku.Suukantsu, han: 0, yakumanTimes: 1 };
  return null;
}

// ===== 全役満チェッカー =====

/**
 * 全役満を判定する（面子分解が必要なものと不要なものの両方）
 *
 * @param hand 面子分解結果（国士/九蓮等では不要なので undefined 可）
 * @param ctx 和了コンテキスト
 * @returns 成立した役満の配列
 */
export function checkAllYakuman(hand: ParsedHand | undefined, ctx: WinContext): YakuResult[] {
  const results: YakuResult[] = [];
  const push = (r: YakuResult | null) => {
    if (r) results.push(r);
  };

  // 状況役満
  push(checkTenhou(ctx));
  push(checkChiihou(ctx));
  push(checkRenhou(ctx));

  // 特殊形役満（面子分解不要）
  push(checkKokushi(ctx));
  push(checkChuurenPoutou(ctx));

  // 面子分解が必要な役満
  if (hand) {
    // 大四喜と小四喜は排他（大四喜が優先）
    const daisuushii = checkDaisuushii(hand);
    if (daisuushii) {
      push(daisuushii);
    } else {
      push(checkShousuushii(hand));
    }

    push(checkSuuankou(hand, ctx));
    push(checkDaisangen(hand));
    push(checkTsuuiisou(hand));
    push(checkRyuuiisou(hand, ctx));
    push(checkChinroutou(hand));
    push(checkSuukantsu(hand));
  }

  return results;
}
