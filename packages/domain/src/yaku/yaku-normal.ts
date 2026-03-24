import {
  type TileType,
  TileSuit,
  TileType as TT,
  getNumberTileInfo,
  getTileSuit,
  isTerminalOrHonor,
  isTerminal,
  isHonorTile,
  isNumberTile,
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

// ===== ヘルパー =====

/** Tile をダミーとして作るヘルパー（TileType のみ使用） */
function dummyTile(type: TileType) {
  return { type, id: 0, isRedDora: false };
}

/** 面子グループ内のすべての TileType を取得 */
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

/** グループが幺九牌を含むか */
function groupContainsTerminalOrHonor(g: ParsedGroup): boolean {
  return getGroupTileTypes(g).some((t) => isTerminalOrHonor(dummyTile(t)));
}

/** グループが老頭牌（1,9 の数牌）を含むか */
function groupContainsTerminal(g: ParsedGroup): boolean {
  return getGroupTileTypes(g).some((t) => isTerminal(dummyTile(t)));
}

/** グループのすべての牌が幺九牌か */
function groupAllTerminalOrHonor(g: ParsedGroup): boolean {
  return getGroupTileTypes(g).every((t) => isTerminalOrHonor(dummyTile(t)));
}

/** ParsedHand 内の全 TileType (groups + pair) を取得 */
function allTileTypes(hand: ParsedHand): TileType[] {
  const result: TileType[] = [];
  for (const g of hand.groups) {
    result.push(...getGroupTileTypes(g));
  }
  result.push(hand.pair);
  result.push(hand.pair); // 雀頭は2枚
  return result;
}

/** 全 TileType が幺九牌か */
function allTerminalOrHonor(types: TileType[]): boolean {
  return types.every((t) => isTerminalOrHonor(dummyTile(t)));
}

/** 門前の順子のみを抽出 */
function closedShuntsu(hand: ParsedHand): ParsedGroup[] {
  return hand.groups.filter((g) => g.type === GroupType.Shuntsu && !g.isOpen);
}

/** 順子のみ（門前/副露問わず） */
function allShuntsu(hand: ParsedHand): ParsedGroup[] {
  return hand.groups.filter((g) => g.type === GroupType.Shuntsu);
}

/** 刻子/槓子のみ（門前/副露問わず） */
function allKoutsuOrKantsu(hand: ParsedHand): ParsedGroup[] {
  return hand.groups.filter((g) => g.type === GroupType.Koutsu || g.type === GroupType.Kantsu);
}

/** 使用している suit のセット */
function usedSuits(hand: ParsedHand): Set<TileSuit> {
  const suits = new Set<TileSuit>();
  for (const t of allTileTypes(hand)) {
    suits.add(getTileSuit(dummyTile(t)));
  }
  return suits;
}

// ===== 通常役（1飜） =====

/** リーチ（門前限定） */
export function checkRiichi(ctx: WinContext): YakuResult | null {
  if (!ctx.isRiichi || ctx.isDoubleRiichi) return null;
  return { yaku: Yaku.Riichi, han: 1, yakumanTimes: 0 };
}

/** 一発（門前限定・リーチ後） */
export function checkIppatsu(ctx: WinContext): YakuResult | null {
  if (!ctx.isIppatsu || !ctx.ruleConfig.ippatsu) return null;
  return { yaku: Yaku.Ippatsu, han: 1, yakumanTimes: 0 };
}

/** 門前清自摸和（門前限定） */
export function checkMenzenTsumo(ctx: WinContext): YakuResult | null {
  if (!ctx.isTsumo || !isMenzen(ctx.melds)) return null;
  return { yaku: Yaku.MenzenTsumo, han: 1, yakumanTimes: 0 };
}

/** 断么九（中張牌のみ） */
export function checkTanyao(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  // 喰いタンのルール設定
  if (!isMenzen(ctx.melds) && !ctx.ruleConfig.kuitan) return null;
  const types = allTileTypes(hand);
  if (types.some((t) => isTerminalOrHonor(dummyTile(t)))) return null;
  return { yaku: Yaku.Tanyao, han: 1, yakumanTimes: 0 };
}

/** 平和（門前限定） */
export function checkPinfu(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  if (!isMenzen(ctx.melds)) return null;
  // 全グループが順子（暗槓含む場合は不可）
  if (hand.groups.some((g) => g.type !== GroupType.Shuntsu)) return null;

  // 雀頭が役牌でない
  const pair = hand.pair;
  if (pair === ctx.roundWind || pair === ctx.seatWind) return null;
  if (pair === TT.Haku || pair === TT.Hatsu || pair === TT.Chun) return null;

  // 両面待ちであること
  // 和了牌を含む順子が、その順子の両端のどちらかで和了したか
  const winType = ctx.winTile.type;
  let isRyanmen = false;
  for (const g of hand.groups) {
    if (g.type !== GroupType.Shuntsu) continue;
    const types = getGroupTileTypes(g);
    if (winType === types[0]) {
      // 順子の左端で和了 → 右に延びる余地があるか = types[2] の数字が 9 でない
      // 例: 7-8-9 で 7 和了は辺張ではない → 5-6-7 の右端和了。
      // 順子 x-(x+1)-(x+2) において winType=x → これは「x, x+1, x+2」の左端和了
      // 辺張は x+2 = 3（つまり 1-2-3 で 3 の左隣を待つ）…
      // 実はwinType=types[0]のとき、この順子は「types[0]を待っていた」=左端待ち
      // 両面: types[0] が 1 でないなら左にも延びるので両面
      // 実際ペンチャンの定義を考えると:
      //   8-9 で 7 を待つ: 順子 7-8-9 で winType=7=types[0], 7は1ではない → 両面
      //   1-2 で 3 を待つ: 順子 1-2-3 で winType=3=types[2], 3は9ではない → ...
      //
      // やり直し。平和の待ち判定:
      // 和了牌がある順子の「端」にいて、反対側に延びる余地があること
      // winType === types[0] → 左端和了 → これが両面であるためには types[2]の数字が9でないこと？
      // いいえ。左端和了 = 例えば 5-6-7 の 5 で和了。待ちは 5 と 8。これは両面。
      // 左端和了 = 4-5-6 の 4 で和了。待ちは 4 と 7。これは両面。
      // 左端和了 = 7-8-9 の 7 で和了。待ちは 7 のみ (10は無い)。→ ペンチャン: 7
      // いや、7-8-9 で 7 を待つのはペンチャンではなく、7 は 8-9 の後ろから取る → ペンチャン
      // 正しくは: 順子 N, N+1, N+2 に対して
      //   winType=N: 待ちは N と N+3。N+3が存在する(<=9)なら両面。なければペンチャン。
      //   winType=N+2: 待ちは N-1 と N+2。N-1が存在する(>=1)なら両面。なければペンチャン。
      //   winType=N+1: 嵌張
      const numInfo = getNumberTileInfo(dummyTile(types[2]));
      if (numInfo && numInfo.number < 9) {
        // types[2] + 1 が存在する → 両面
        isRyanmen = true;
        break;
      }
    } else if (winType === types[2]) {
      const numInfo = getNumberTileInfo(dummyTile(types[0]));
      if (numInfo && numInfo.number > 1) {
        // types[0] - 1 が存在する → 両面
        isRyanmen = true;
        break;
      }
    }
  }

  if (!isRyanmen) return null;
  return { yaku: Yaku.Pinfu, han: 1, yakumanTimes: 0 };
}

/** 一盃口（門前限定・同一順子2組） */
export function checkIipeiko(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  if (!isMenzen(ctx.melds)) return null;
  const shuntsuTypes = closedShuntsu(hand).map((g) => g.tileType);
  const counts = new Map<TileType, number>();
  for (const t of shuntsuTypes) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const pairCount = [...counts.values()].filter((c) => c >= 2).length;
  // 二盃口でないことを確認（二盃口は別途判定）
  if (pairCount === 1) return { yaku: Yaku.Iipeiko, han: 1, yakumanTimes: 0 };
  return null;
}

/** 役牌 場風 */
export function checkYakuhaiRoundWind(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const found = allKoutsuOrKantsu(hand).some((g) => g.tileType === ctx.roundWind);
  return found ? { yaku: Yaku.YakuhaiRoundWind, han: 1, yakumanTimes: 0 } : null;
}

/** 役牌 自風 */
export function checkYakuhaiSeatWind(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const found = allKoutsuOrKantsu(hand).some((g) => g.tileType === ctx.seatWind);
  return found ? { yaku: Yaku.YakuhaiSeatWind, han: 1, yakumanTimes: 0 } : null;
}

/** 役牌 白 */
export function checkYakuhaiHaku(hand: ParsedHand): YakuResult | null {
  const found = allKoutsuOrKantsu(hand).some((g) => g.tileType === TT.Haku);
  return found ? { yaku: Yaku.YakuhaiHaku, han: 1, yakumanTimes: 0 } : null;
}

/** 役牌 發 */
export function checkYakuhaiHatsu(hand: ParsedHand): YakuResult | null {
  const found = allKoutsuOrKantsu(hand).some((g) => g.tileType === TT.Hatsu);
  return found ? { yaku: Yaku.YakuhaiHatsu, han: 1, yakumanTimes: 0 } : null;
}

/** 役牌 中 */
export function checkYakuhaiChun(hand: ParsedHand): YakuResult | null {
  const found = allKoutsuOrKantsu(hand).some((g) => g.tileType === TT.Chun);
  return found ? { yaku: Yaku.YakuhaiChun, han: 1, yakumanTimes: 0 } : null;
}

/** 海底摸月 */
export function checkHaitei(ctx: WinContext): YakuResult | null {
  if (!ctx.isHaitei) return null;
  return { yaku: Yaku.Haitei, han: 1, yakumanTimes: 0 };
}

/** 河底撈魚 */
export function checkHoutei(ctx: WinContext): YakuResult | null {
  if (!ctx.isHoutei) return null;
  return { yaku: Yaku.Houtei, han: 1, yakumanTimes: 0 };
}

/** 嶺上開花 */
export function checkRinshan(ctx: WinContext): YakuResult | null {
  if (!ctx.isRinshan) return null;
  return { yaku: Yaku.Rinshan, han: 1, yakumanTimes: 0 };
}

/** 搶槓 */
export function checkChankan(ctx: WinContext): YakuResult | null {
  if (!ctx.isChankan) return null;
  return { yaku: Yaku.Chankan, han: 1, yakumanTimes: 0 };
}

// ===== 通常役（2飜） =====

/** ダブルリーチ（門前限定） */
export function checkDoubleRiichi(ctx: WinContext): YakuResult | null {
  if (!ctx.isDoubleRiichi) return null;
  return { yaku: Yaku.DoubleRiichi, han: 2, yakumanTimes: 0 };
}

/** 対々和（全面子が刻子/槓子） */
export function checkToitoi(hand: ParsedHand): YakuResult | null {
  if (hand.groups.every((g) => g.type === GroupType.Koutsu || g.type === GroupType.Kantsu)) {
    return { yaku: Yaku.Toitoi, han: 2, yakumanTimes: 0 };
  }
  return null;
}

/** 三暗刻（門前刻子/暗槓が3つ以上） */
export function checkSanankou(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  let closedKoutsuCount = hand.groups.filter(
    (g) => (g.type === GroupType.Koutsu || g.type === GroupType.Kantsu) && !g.isOpen,
  ).length;

  // ロン和了の場合、和了牌で刻子を構成した1組は暗刻ではなく明刻扱い
  if (!ctx.isTsumo && closedKoutsuCount > 0) {
    const winType = ctx.winTile.type;
    const matchingClosed = hand.groups.filter(
      (g) =>
        (g.type === GroupType.Koutsu || g.type === GroupType.Kantsu) &&
        !g.isOpen &&
        g.tileType === winType,
    );
    if (matchingClosed.length > 0) {
      closedKoutsuCount -= 1;
    }
  }

  if (closedKoutsuCount >= 3) {
    return { yaku: Yaku.Sanankou, han: 2, yakumanTimes: 0 };
  }
  return null;
}

/** 三色同刻（3スートで同じ数の刻子/槓子） */
export function checkSanshokuDoukou(hand: ParsedHand): YakuResult | null {
  const koutsuKantsu = allKoutsuOrKantsu(hand);
  const numMap = new Map<number, Set<string>>();
  for (const g of koutsuKantsu) {
    const info = getNumberTileInfo(dummyTile(g.tileType));
    if (!info) continue;
    let suitSet = numMap.get(info.number);
    if (!suitSet) {
      suitSet = new Set();
      numMap.set(info.number, suitSet);
    }
    suitSet.add(info.suit);
  }
  for (const suitSet of numMap.values()) {
    if (suitSet.size >= 3) {
      return { yaku: Yaku.SanshokuDoukou, han: 2, yakumanTimes: 0 };
    }
  }
  return null;
}

/** 三色同順（3スートで同じ数の順子、鳴くと1飜） */
export function checkSanshokuDoujun(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const shuntsu = allShuntsu(hand);
  const numMap = new Map<number, Set<string>>();
  for (const g of shuntsu) {
    const info = getNumberTileInfo(dummyTile(g.tileType));
    if (!info) continue;
    let suitSet = numMap.get(info.number);
    if (!suitSet) {
      suitSet = new Set();
      numMap.set(info.number, suitSet);
    }
    suitSet.add(info.suit);
  }
  for (const suitSet of numMap.values()) {
    if (suitSet.size >= 3) {
      const han = isMenzen(ctx.melds) ? 2 : 1;
      return { yaku: Yaku.SanshokuDoujun, han, yakumanTimes: 0 };
    }
  }
  return null;
}

/** 一気通貫（同スートの1-2-3, 4-5-6, 7-8-9 の順子、鳴くと1飜） */
export function checkIkkitsuukan(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const shuntsu = allShuntsu(hand);
  // スートごとに順子の先頭数字を集める
  const suitMap = new Map<string, Set<number>>();
  for (const g of shuntsu) {
    const info = getNumberTileInfo(dummyTile(g.tileType));
    if (!info) continue;
    let numSet = suitMap.get(info.suit);
    if (!numSet) {
      numSet = new Set();
      suitMap.set(info.suit, numSet);
    }
    numSet.add(info.number);
  }
  for (const numSet of suitMap.values()) {
    if (numSet.has(1) && numSet.has(4) && numSet.has(7)) {
      const han = isMenzen(ctx.melds) ? 2 : 1;
      return { yaku: Yaku.Ikkitsuukan, han, yakumanTimes: 0 };
    }
  }
  return null;
}

/** 混全帯么九（全グループ＋雀頭に幺九牌を含む、字牌あり、鳴くと1飜） */
export function checkChanta(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  // 各グループが幺九牌を含み、かつ字牌を含むグループまたは雀頭がある
  if (!hand.groups.every((g) => groupContainsTerminalOrHonor(g))) return null;
  if (!isTerminalOrHonor(dummyTile(hand.pair))) return null;
  // 字牌が含まれるか（純チャンとの区別）
  const types = allTileTypes(hand);
  if (!types.some((t) => isHonorTile(dummyTile(t)))) return null;
  // 全グループが幺九牌のみの場合→混老頭であってチャンタではない
  if (hand.groups.every((g) => groupAllTerminalOrHonor(g))) return null;
  const han = isMenzen(ctx.melds) ? 2 : 1;
  return { yaku: Yaku.Chanta, han, yakumanTimes: 0 };
}

/** 三槓子（槓子が3つ） */
export function checkSankantsu(hand: ParsedHand): YakuResult | null {
  const kantsuCount = hand.groups.filter((g) => g.type === GroupType.Kantsu).length;
  if (kantsuCount >= 3) return { yaku: Yaku.Sankantsu, han: 2, yakumanTimes: 0 };
  return null;
}

/** 小三元（三元牌の刻子2 + 雀頭1） */
export function checkShousangen(hand: ParsedHand): YakuResult | null {
  const sangenTypes: TileType[] = [TT.Haku, TT.Hatsu, TT.Chun];
  const koutsu = allKoutsuOrKantsu(hand);
  const sangenKoutsu = koutsu.filter((g) => sangenTypes.includes(g.tileType));
  if (sangenKoutsu.length === 2 && sangenTypes.includes(hand.pair)) {
    return { yaku: Yaku.Shousangen, han: 2, yakumanTimes: 0 };
  }
  return null;
}

/** 混老頭（全牌が幺九牌のみ=数牌の1,9 + 字牌） */
export function checkHonroutou(hand: ParsedHand): YakuResult | null {
  const types = allTileTypes(hand);
  if (!allTerminalOrHonor(types)) return null;
  // 字牌が含まれるか（清老頭との区別）
  if (!types.some((t) => isHonorTile(dummyTile(t)))) return null;
  // 数牌も含まれるか（字一色との区別）
  if (!types.some((t) => isNumberTile(dummyTile(t)))) return null;
  return { yaku: Yaku.Honroutou, han: 2, yakumanTimes: 0 };
}

// ===== 通常役（3飜） =====

/** 二盃口（門前限定・同一順子2組が2セット） */
export function checkRyanpeiko(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  if (!isMenzen(ctx.melds)) return null;
  const shuntsuTypes = closedShuntsu(hand).map((g) => g.tileType);
  const counts = new Map<TileType, number>();
  for (const t of shuntsuTypes) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const pairCount = [...counts.values()].filter((c) => c >= 2).length;
  if (pairCount >= 2) return { yaku: Yaku.Ryanpeiko, han: 3, yakumanTimes: 0 };
  return null;
}

/** 純全帯么九（全グループ＋雀頭に数牌の1or9を含む、字牌なし、鳴くと2飜） */
export function checkJunchan(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  if (!hand.groups.every((g) => groupContainsTerminal(g))) return null;
  if (!isTerminal(dummyTile(hand.pair))) return null;
  // 字牌がないこと
  const types = allTileTypes(hand);
  if (types.some((t) => isHonorTile(dummyTile(t)))) return null;
  // 順子がないと清老頭
  if (!hand.groups.some((g) => g.type === GroupType.Shuntsu)) return null;
  const han = isMenzen(ctx.melds) ? 3 : 2;
  return { yaku: Yaku.Junchan, han, yakumanTimes: 0 };
}

/** 混一色（1スート＋字牌のみ、鳴くと2飜） */
export function checkHonitsu(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const suits = usedSuits(hand);
  // 字牌を除いた数牌のスートが1種類
  const numberSuits = new Set(
    [...suits].filter((s) => s === TileSuit.Manzu || s === TileSuit.Souzu || s === TileSuit.Pinzu),
  );
  if (numberSuits.size !== 1) return null;
  // 字牌が含まれるか（清一色との区別）
  if (!suits.has(TileSuit.Kaze) && !suits.has(TileSuit.Sangen)) return null;
  const han = isMenzen(ctx.melds) ? 3 : 2;
  return { yaku: Yaku.Honitsu, han, yakumanTimes: 0 };
}

// ===== 通常役（6飜） =====

/** 清一色（1スートのみ、字牌なし、鳴くと5飜） */
export function checkChinitsu(hand: ParsedHand, ctx: WinContext): YakuResult | null {
  const suits = usedSuits(hand);
  if (suits.size !== 1) return null;
  const onlySuit = [...suits][0];
  if (onlySuit === TileSuit.Kaze || onlySuit === TileSuit.Sangen) return null;
  const han = isMenzen(ctx.melds) ? 6 : 5;
  return { yaku: Yaku.Chinitsu, han, yakumanTimes: 0 };
}

// ===== 全通常役チェッカー =====

/**
 * ParsedHand に対して全通常役を判定し、成立した役の配列を返す
 */
export function checkAllNormalYaku(hand: ParsedHand, ctx: WinContext): YakuResult[] {
  const results: YakuResult[] = [];

  const push = (r: YakuResult | null) => {
    if (r) results.push(r);
  };

  // 状況役（手牌の形に依存しない）
  push(checkRiichi(ctx));
  push(checkDoubleRiichi(ctx));
  push(checkIppatsu(ctx));
  push(checkMenzenTsumo(ctx));
  push(checkHaitei(ctx));
  push(checkHoutei(ctx));
  push(checkRinshan(ctx));
  push(checkChankan(ctx));

  // 手牌の形に依存する役
  push(checkTanyao(hand, ctx));
  push(checkPinfu(hand, ctx));

  // 一盃口と二盃口は排他（二盃口が優先）
  const ryanpeiko = checkRyanpeiko(hand, ctx);
  if (ryanpeiko) {
    push(ryanpeiko);
  } else {
    push(checkIipeiko(hand, ctx));
  }

  push(checkYakuhaiRoundWind(hand, ctx));
  push(checkYakuhaiSeatWind(hand, ctx));
  push(checkYakuhaiHaku(hand));
  push(checkYakuhaiHatsu(hand));
  push(checkYakuhaiChun(hand));

  push(checkToitoi(hand));
  push(checkSanankou(hand, ctx));
  push(checkSanshokuDoukou(hand));
  push(checkSanshokuDoujun(hand, ctx));
  push(checkIkkitsuukan(hand, ctx));

  // チャンタ/純チャン は排他（純チャンが優先）
  const junchan = checkJunchan(hand, ctx);
  if (junchan) {
    push(junchan);
  } else {
    push(checkChanta(hand, ctx));
  }

  push(checkSankantsu(hand));
  push(checkShousangen(hand));
  push(checkHonroutou(hand));

  // 混一色/清一色 は排他（清一色が優先）
  const chinitsu = checkChinitsu(hand, ctx);
  if (chinitsu) {
    push(chinitsu);
  } else {
    push(checkHonitsu(hand, ctx));
  }

  return results;
}
