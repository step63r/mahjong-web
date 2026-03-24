import { describe, it, expect } from "vitest";
import { TileType, TileType as TT } from "../tile/index.js";
import type { Tile } from "../tile/index.js";
import type { Meld } from "../meld/index.js";
import { MeldType } from "../meld/index.js";
import { createDefaultRuleConfig } from "../rule/index.js";
import type { RuleConfig } from "../rule/index.js";
import type { WinContext } from "./types.js";
import { Yaku } from "./types.js";
import { parseMentsu, parseChiitoitsu, parseKokushi } from "./parser.js";
import { judgeWin } from "./judge.js";

// ===== ヘルパー =====

function tile(type: TileType, id: number = 0, isRedDora: boolean = false): Tile {
  return { type, id, isRedDora };
}

/** TileType の配列から Tile 配列を生成（id は自動連番） */
function tiles(...types: TileType[]): Tile[] {
  const idCounts = new Map<TileType, number>();
  return types.map((t) => {
    const id = idCounts.get(t) ?? 0;
    idCounts.set(t, id + 1);
    return tile(t, id);
  });
}

/** デフォルトのルール設定 */
const defaultRule = createDefaultRuleConfig();

/** 基本的な WinContext を構築するヘルパー */
function makeCtx(opts: {
  handTiles: Tile[];
  melds?: Meld[];
  winTile: Tile;
  isTsumo?: boolean;
  seatWind?: TileType;
  roundWind?: TileType;
  isRiichi?: boolean;
  isDoubleRiichi?: boolean;
  isIppatsu?: boolean;
  isHaitei?: boolean;
  isHoutei?: boolean;
  isRinshan?: boolean;
  isChankan?: boolean;
  isTenhou?: boolean;
  isChiihou?: boolean;
  isRenhou?: boolean;
  doraCount?: number;
  uraDoraCount?: number;
  redDoraCount?: number;
  ruleConfig?: RuleConfig;
}): WinContext {
  return {
    handTiles: opts.handTiles,
    melds: opts.melds ?? [],
    winTile: opts.winTile,
    isTsumo: opts.isTsumo ?? false,
    seatWind: opts.seatWind ?? TT.Ton,
    roundWind: opts.roundWind ?? TT.Ton,
    isRiichi: opts.isRiichi ?? false,
    isDoubleRiichi: opts.isDoubleRiichi ?? false,
    isIppatsu: opts.isIppatsu ?? false,
    isHaitei: opts.isHaitei ?? false,
    isHoutei: opts.isHoutei ?? false,
    isRinshan: opts.isRinshan ?? false,
    isChankan: opts.isChankan ?? false,
    isTenhou: opts.isTenhou ?? false,
    isChiihou: opts.isChiihou ?? false,
    isRenhou: opts.isRenhou ?? false,
    doraCount: opts.doraCount ?? 0,
    uraDoraCount: opts.uraDoraCount ?? 0,
    redDoraCount: opts.redDoraCount ?? 0,
    ruleConfig: opts.ruleConfig ?? defaultRule,
  };
}

// =====================================================
// parseMentsu テスト
// =====================================================

describe("parseMentsu", () => {
  it("4面子1雀頭に分解できる（基本形）", () => {
    // 萬子1,2,3 + 萬子4,5,6 + 萬子7,8,9 + 索子1,1,1 + 筒子5,5
    const types: TileType[] = [
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou1,
      TT.Sou1,
      TT.Pin5,
      TT.Pin5,
    ];
    const results = parseMentsu(types, []);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // すべての結果が4グループ + 1雀頭
    for (const r of results) {
      expect(r.groups).toHaveLength(4);
      expect(r.pair).toBeDefined();
    }
  });

  it("分解できない手牌は空配列", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man1,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou2,
      TT.Sou4,
      TT.Pin5,
      TT.Pin5,
    ];
    const results = parseMentsu(types, []);
    expect(results).toHaveLength(0);
  });

  it("副露がある場合、閉じた手牌のみを分解する", () => {
    // 手牌: man1,man2,man3 + sou5,sou5 (5枚)
    // 副露: man4-5-6 チー、sou1-sou1-sou1 ポン、pin2-3-4 チー
    const closed: TileType[] = [TT.Man1, TT.Man2, TT.Man3, TT.Sou5, TT.Sou5];
    const melds: Meld[] = [
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Man4), tile(TT.Man5), tile(TT.Man6)],
        calledTile: tile(TT.Man4),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Pon,
        tiles: [tile(TT.Sou1, 0), tile(TT.Sou1, 1), tile(TT.Sou1, 2)],
        calledTile: tile(TT.Sou1, 2),
        fromPlayerIndex: 2,
      },
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Pin2), tile(TT.Pin3), tile(TT.Pin4)],
        calledTile: tile(TT.Pin2),
        fromPlayerIndex: 3,
      },
    ];
    const results = parseMentsu(closed, melds);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.groups).toHaveLength(4); // 副露3 + 閉じた1
    }
  });
});

// =====================================================
// parseChiitoitsu テスト
// =====================================================

describe("parseChiitoitsu", () => {
  it("7対子が成立する手牌 → true", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man1,
      TT.Man3,
      TT.Man3,
      TT.Sou5,
      TT.Sou5,
      TT.Pin2,
      TT.Pin2,
      TT.Ton,
      TT.Ton,
      TT.Haku,
      TT.Haku,
      TT.Chun,
      TT.Chun,
    ];
    expect(parseChiitoitsu(types)).toBe(true);
  });

  it("4枚同種があると不成立 → false", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Sou5,
      TT.Sou5,
      TT.Pin2,
      TT.Pin2,
      TT.Ton,
      TT.Ton,
      TT.Haku,
      TT.Haku,
      TT.Chun,
      TT.Chun,
    ];
    expect(parseChiitoitsu(types)).toBe(false);
  });

  it("13枚では不成立", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man1,
      TT.Man3,
      TT.Man3,
      TT.Sou5,
      TT.Sou5,
      TT.Pin2,
      TT.Pin2,
      TT.Ton,
      TT.Ton,
      TT.Haku,
      TT.Haku,
      TT.Chun,
    ];
    expect(parseChiitoitsu(types)).toBe(false);
  });
});

// =====================================================
// parseKokushi テスト
// =====================================================

describe("parseKokushi", () => {
  it("通常の国士無双", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun, // Chun が雀頭
    ];
    expect(parseKokushi(types, TT.Man1)).toBe("kokushi");
  });

  it("十三面待ちの国士無双", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
    ];
    // 和了牌が Chun (雀頭を構成する牌) → 13面以外
    // 和了牌が Chun でない → 13面: 和了牌を除くと13種が1枚ずつ
    expect(parseKokushi(types, TT.Chun)).toBe("kokushi-13");
  });

  it("幺九牌以外が含まれると不成立", () => {
    const types: TileType[] = [
      TT.Man1,
      TT.Man2,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
    ];
    expect(parseKokushi(types, TT.Man2)).toBeNull();
  });
});

// =====================================================
// judgeWin - 通常役テスト
// =====================================================

describe("judgeWin - 通常役", () => {
  it("リーチ + 門前清自摸和", () => {
    // 1,2,3m + 4,5,6m + 7,8,9m + 1,1,1s + 5,5p
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou1,
      TT.Sou1,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      isRiichi: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Riichi);
    expect(yakuNames).toContain(Yaku.MenzenTsumo);
  });

  it("断么九（タンヤオ）", () => {
    // 2,3,4m + 5,6,7m + 3,4,5s + 2,2,2p + 8,8s
    const handTiles = tiles(
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Sou3,
      TT.Sou4,
      TT.Sou5,
      TT.Pin2,
      TT.Pin2,
      TT.Pin2,
      TT.Sou8,
      TT.Sou8,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Sou8),
      isTsumo: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Tanyao);
  });

  it("平和（ピンフ）", () => {
    // 1,2,3m + 4,5,6m + 7,8,9s + 2,3,4p + 5,5m (雀頭は非役牌)
    // 両面待ち: 2,3p で 4p 和了（右端、左端の数字>1）
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Pin2,
      TT.Pin3,
      TT.Pin4,
      TT.Man5,
      TT.Man5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin4),
      isTsumo: true,
      seatWind: TT.Sha, // 西家（Man5 は役牌にならない）
      roundWind: TT.Ton,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Pinfu);
  });

  it("平和にならない（嵌張待ち）", () => {
    // 1,2,3m + 4,5,6m + 7,8,9s + 2,4p + 5,5,m → 3pで嵌張和了
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Pin2,
      TT.Pin3,
      TT.Pin4,
      TT.Man5,
      TT.Man5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin3), // 嵌張 (2-3-4の中央)
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Ton,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).not.toContain(Yaku.Pinfu);
  });

  it("役牌（白）", () => {
    // 1,2,3m + 4,5,6m + 7,8,9s + 白,白,白 + 5,5p
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.YakuhaiHaku);
  });

  it("対々和 + 三暗刻（ツモ）", () => {
    // 1,1,1m + 5,5,5s + 9,9,9p (暗刻×3) + ポン東 + 白,白
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Sou5,
      TT.Sou5,
      TT.Sou5,
      TT.Pin9,
      TT.Pin9,
      TT.Pin9,
      TT.Haku,
      TT.Haku,
    );
    const ponTon: Meld = {
      type: MeldType.Pon,
      tiles: [tile(TT.Ton), tile(TT.Ton), tile(TT.Ton)],
      calledTile: tile(TT.Ton),
      fromPlayerIndex: 0,
    };
    const ctx = makeCtx({
      handTiles,
      melds: [ponTon],
      winTile: tile(TT.Haku),
      isTsumo: true,
      roundWind: TT.Nan, // 南場
      seatWind: TT.Sha, // 西家
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Toitoi);
    expect(yakuNames).toContain(Yaku.Sanankou);
  });

  it("三色同順（門前2飜）", () => {
    // 1,2,3m + 1,2,3s + 1,2,3p + 5,5,5m + 9,9s
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Sou1,
      TT.Sou2,
      TT.Sou3,
      TT.Pin1,
      TT.Pin2,
      TT.Pin3,
      TT.Man5,
      TT.Man5,
      TT.Man5,
      TT.Sou9,
      TT.Sou9,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Sou9),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.SanshokuDoujun);
  });

  it("一気通貫（門前2飜）", () => {
    // 1,2,3m + 4,5,6m + 7,8,9m + 1,1,1s + 5,5p
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou1,
      TT.Sou1,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Ikkitsuukan);
  });

  it("混一色（門前3飜）", () => {
    // 1,2,3m + 4,5,6m + 7,8,9m + 東,東,東 + 1,1m
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Ton,
      TT.Ton,
      TT.Ton,
      TT.Man1,
      TT.Man1,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Man1, 2),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Honitsu);
  });

  it("清一色（門前6飜）", () => {
    // 1,1,1m + 2,3,4m + 5,6,7m + 8,8,8m + 9,9m
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man8,
      TT.Man8,
      TT.Man9,
      TT.Man9,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Man9, 1),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Chinitsu);
  });

  it("七対子", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man3,
      TT.Man3,
      TT.Sou5,
      TT.Sou5,
      TT.Pin2,
      TT.Pin2,
      TT.Ton,
      TT.Ton,
      TT.Haku,
      TT.Haku,
      TT.Chun,
      TT.Chun,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Chun, 1),
      isTsumo: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Chiitoitsu);
  });

  it("一盃口", () => {
    // 1,2,3m + 1,2,3m + 4,5,6s + 7,7,7p + 9,9s
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Sou4,
      TT.Sou5,
      TT.Sou6,
      TT.Pin7,
      TT.Pin7,
      TT.Pin7,
      TT.Sou9,
      TT.Sou9,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Sou9),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Iipeiko);
  });

  it("小三元", () => {
    // 白,白,白 + 發,發,發 + 中,中 + 1,2,3m + 5,5,5s
    const handTiles = tiles(
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Hatsu,
      TT.Hatsu,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Sou5,
      TT.Sou5,
      TT.Sou5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Sou5, 2),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Shousangen);
    expect(yakuNames).toContain(Yaku.YakuhaiHaku);
    expect(yakuNames).toContain(Yaku.YakuhaiHatsu);
  });

  it("ドラが飜数に加算される", () => {
    // 1,2,3m + 4,5,6m + 7,8,9s + 白,白,白 + 5,5p
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      doraCount: 2,
      redDoraCount: 1,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    // ドラ3枚分が加算される
    expect(result!.totalHan).toBeGreaterThanOrEqual(4); // 白1 + ツモ1 + ドラ3 = 5 以上
  });

  it("喰いタン有効時、鳴いてもタンヤオが成立する", () => {
    // 手牌: 5,6,7m + 8,8s (5枚)
    // 副露: 2,3,4p チー + 3,4,5s チー + 6,6,6p ポン
    const handTiles = tiles(TT.Man5, TT.Man6, TT.Man7, TT.Sou8, TT.Sou8);
    const melds: Meld[] = [
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Pin2), tile(TT.Pin3), tile(TT.Pin4)],
        calledTile: tile(TT.Pin2),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Sou3), tile(TT.Sou4), tile(TT.Sou5)],
        calledTile: tile(TT.Sou3),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Pon,
        tiles: [tile(TT.Pin6, 0), tile(TT.Pin6, 1), tile(TT.Pin6, 2)],
        calledTile: tile(TT.Pin6, 2),
        fromPlayerIndex: 1,
      },
    ];
    const ctx = makeCtx({
      handTiles,
      melds,
      winTile: tile(TT.Sou8),
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Tanyao);
  });

  it("喰いタン無効時、鳴くとタンヤオが成立しない", () => {
    const handTiles = tiles(TT.Man5, TT.Man6, TT.Man7, TT.Sou8, TT.Sou8);
    const melds: Meld[] = [
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Pin2), tile(TT.Pin3), tile(TT.Pin4)],
        calledTile: tile(TT.Pin2),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Sou3), tile(TT.Sou4), tile(TT.Sou5)],
        calledTile: tile(TT.Sou3),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Pon,
        tiles: [tile(TT.Pin6, 0), tile(TT.Pin6, 1), tile(TT.Pin6, 2)],
        calledTile: tile(TT.Pin6, 2),
        fromPlayerIndex: 1,
      },
    ];
    const rule = { ...defaultRule, kuitan: false };
    const ctx = makeCtx({
      handTiles,
      melds,
      winTile: tile(TT.Sou8),
      ruleConfig: rule,
    });
    const result = judgeWin(ctx);
    // タンヤオ以外の役もないので null
    expect(result).toBeNull();
  });

  it("海底摸月", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      isHaitei: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.yakuList.map((y) => y.yaku)).toContain(Yaku.Haitei);
  });
});

// =====================================================
// judgeWin - 役満テスト
// =====================================================

describe("judgeWin - 役満", () => {
  it("国士無双", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Man1),
      isTsumo: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Kokushi);
  });

  it("国士無双十三面待ち（ダブル役満）", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Chun, 1), // 雀頭を構成する牌で和了 → 13面
      isTsumo: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBe(2);
  });

  it("四暗刻", () => {
    // 1,1,1m + 5,5,5s + 9,9,9p + 東,東,東 + 白,白 → 白で和了（単騎）
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Sou5,
      TT.Sou5,
      TT.Sou5,
      TT.Pin9,
      TT.Pin9,
      TT.Pin9,
      TT.Ton,
      TT.Ton,
      TT.Ton,
      TT.Haku,
      TT.Haku,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Haku),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    // 和了牌が雀頭 → 単騎 → ダブル役満
    expect(result!.totalYakumanTimes).toBe(2);
  });

  it("大三元", () => {
    // 白,白,白 + 發,發,發 + 中,中,中 + 1,2,3m + 5,5s
    const handTiles = tiles(
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Hatsu,
      TT.Hatsu,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
      TT.Chun,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Sou5,
      TT.Sou5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Sou5),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Daisangen);
  });

  it("字一色", () => {
    // 東,東,東 + 南,南,南 + 西,西,西 + 白,白,白 + 中,中
    const handTiles = tiles(
      TT.Ton,
      TT.Ton,
      TT.Ton,
      TT.Nan,
      TT.Nan,
      TT.Nan,
      TT.Sha,
      TT.Sha,
      TT.Sha,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Chun,
      TT.Chun,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Chun),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Tsuuiisou);
  });

  it("緑一色（發あり）", () => {
    // 2,3,4s + 2,3,4s + 6,6,6s + 8,8,8s + 發,發
    const handTiles = tiles(
      TT.Sou2,
      TT.Sou3,
      TT.Sou4,
      TT.Sou2,
      TT.Sou3,
      TT.Sou4,
      TT.Sou6,
      TT.Sou6,
      TT.Sou6,
      TT.Sou8,
      TT.Sou8,
      TT.Sou8,
      TT.Hatsu,
      TT.Hatsu,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Hatsu),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Ryuuiisou);
  });

  it("清老頭", () => {
    // 1,1,1m + 9,9,9m + 1,1,1s + 9,9,9s + 1,1p
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man9,
      TT.Man9,
      TT.Man9,
      TT.Sou1,
      TT.Sou1,
      TT.Sou1,
      TT.Sou9,
      TT.Sou9,
      TT.Sou9,
      TT.Pin1,
      TT.Pin1,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin1),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Chinroutou);
  });

  it("九蓮宝燈", () => {
    // 1,1,1,2,3,4,5,6,7,8,9,9,9,5m (5mで和了)
    const handTiles = tiles(
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Man9,
      TT.Man9,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Man5, 1),
      isTsumo: true,
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames.some((y) => y === Yaku.ChuurenPoutou || y === Yaku.JunseiChuuren)).toBe(true);
  });

  it("天和", () => {
    // 任意の和了形 + isTenhou フラグ
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      isTenhou: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Tenhou);
  });

  it("地和", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Sou7,
      TT.Sou8,
      TT.Sou9,
      TT.Haku,
      TT.Haku,
      TT.Haku,
      TT.Pin5,
      TT.Pin5,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Pin5),
      isTsumo: true,
      isChiihou: true,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const yakuNames = result!.yakuList.map((y) => y.yaku);
    expect(yakuNames).toContain(Yaku.Chiihou);
  });

  it("役満の場合、ドラは加算されない", () => {
    const handTiles = tiles(
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Chun,
    );
    const ctx = makeCtx({
      handTiles,
      winTile: tile(TT.Man1),
      isTsumo: true,
      doraCount: 5,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    expect(result!.totalHan).toBe(0); // 役満はドラ加算なし
  });
});

// =====================================================
// judgeWin - 役なしテスト
// =====================================================

describe("judgeWin - 役なし", () => {
  it("有効な役がない場合 null を返す", () => {
    // 1,2,3m + 4,5,6s + 7,8,9p + 東,東,東 + 南,南
    // 但し鳴いている → 門前でないのでリーチ/ツモ不可、かつ他に役が立たない形
    const handTiles = tiles(TT.Man1, TT.Man2, TT.Man3, TT.Nan, TT.Nan);
    const melds: Meld[] = [
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Sou4), tile(TT.Sou5), tile(TT.Sou6)],
        calledTile: tile(TT.Sou4),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Pin7), tile(TT.Pin8), tile(TT.Pin9)],
        calledTile: tile(TT.Pin7),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Pon,
        tiles: [tile(TT.Ton, 0), tile(TT.Ton, 1), tile(TT.Ton, 2)],
        calledTile: tile(TT.Ton, 2),
        fromPlayerIndex: 1,
      },
    ];
    const _ctx = makeCtx({
      handTiles,
      melds,
      winTile: tile(TT.Nan),
      seatWind: TT.Sha,
      roundWind: TT.Nan,
    });
    // 南が場風で役牌 → 実は役がある。別の例に変更
    const _ctx2 = makeCtx({
      handTiles,
      melds,
      winTile: tile(TT.Nan),
      seatWind: TT.Pei, // 北家
      roundWind: TT.Ton, // 東場
    });
    // 東のポンは場風でも自風でもない（自風=北、場風=東→東ポンは場風で役）
    // うーん、東は場風（ton=roundWind）なので 役牌 場風がつく
    // 別の例: ポンが 5s にする
    const handTiles3 = tiles(TT.Man1, TT.Man2, TT.Man3, TT.Nan, TT.Nan);
    const melds3: Meld[] = [
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Sou4), tile(TT.Sou5), tile(TT.Sou6)],
        calledTile: tile(TT.Sou4),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Chi,
        tiles: [tile(TT.Pin7), tile(TT.Pin8), tile(TT.Pin9)],
        calledTile: tile(TT.Pin7),
        fromPlayerIndex: 3,
      },
      {
        type: MeldType.Pon,
        tiles: [tile(TT.Sou5, 0), tile(TT.Sou5, 1), tile(TT.Sou5, 2)],
        calledTile: tile(TT.Sou5, 2),
        fromPlayerIndex: 1,
      },
    ];
    const ctx3 = makeCtx({
      handTiles: handTiles3,
      melds: melds3,
      winTile: tile(TT.Nan),
      seatWind: TT.Pei,
      roundWind: TT.Sha,
    });
    const result = judgeWin(ctx3);
    expect(result).toBeNull();
  });
});
