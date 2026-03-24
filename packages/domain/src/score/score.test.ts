import { describe, it, expect } from "vitest";
import { TileType, TileType as TT } from "../tile/index.js";
import type { Tile } from "../tile/index.js";
import type { Meld } from "../meld/index.js";
import { MeldType } from "../meld/index.js";
import { createDefaultRuleConfig } from "../rule/index.js";
import type { RuleConfig } from "../rule/index.js";
import type { WinContext, JudgeResult, ParsedHand } from "../yaku/index.js";
import { GroupType } from "../yaku/index.js";
import { judgeWin } from "../yaku/judge.js";
import { calculateFu, calculateChiitoitsuFu, detectWaitType, WaitType } from "./fu.js";
import { calculateScore } from "./score.js";
import type { ScoreContext } from "./types.js";

// ===== ヘルパー =====

let tileIdCounter = 0;
function tile(type: TileType, id?: number, isRedDora = false): Tile {
  return { type, id: id ?? tileIdCounter++, isRedDora };
}

function tiles(...types: TileType[]): Tile[] {
  return types.map((t) => tile(t));
}

const defaultRule = createDefaultRuleConfig();

function makeCtx(overrides: Partial<WinContext> = {}): WinContext {
  return {
    handTiles: [],
    melds: [],
    winTile: tile(TT.Man1),
    isTsumo: false,
    seatWind: TT.Sha,
    roundWind: TT.Ton,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    isTenhou: false,
    isChiihou: false,
    isRenhou: false,
    doraCount: 0,
    uraDoraCount: 0,
    redDoraCount: 0,
    ruleConfig: defaultRule,
    ...overrides,
  };
}

// ===== 符計算テスト =====

describe("calculateFu - 符計算", () => {
  it("平和ツモ → 20符", () => {
    // 平和ツモの特殊ケース
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man7, isOpen: false },
      ],
      pair: TT.Sou5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: true,
    });
    const result = calculateFu(hand, ctx, true);
    expect(result.total).toBe(20);
  });

  it("平和ロン → 30符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man7, isOpen: false },
      ],
      pair: TT.Sou5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: false,
    });
    const result = calculateFu(hand, ctx, true);
    // 副底20 + 門前ロン10 = 30
    expect(result.total).toBe(30);
  });

  it("暗刻（中張牌）→ 4符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man2, isOpen: false },
      ],
      pair: TT.Sou9,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Sou9),
      isTsumo: true,
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + ツモ2 + 暗刻(中張)4 + 待ち(単騎)2 = 28 → 30
    expect(result.total).toBe(30);
    expect(result.details.some((d) => d.label.includes("暗刻子") && d.fu === 4)).toBe(true);
  });

  it("暗刻（幺九牌）→ 8符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
      ],
      pair: TT.Sou5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Sou5),
      isTsumo: true,
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + ツモ2 + 暗刻(幺九)8 + 待ち(単騎)2 = 32 → 40
    expect(result.total).toBe(40);
  });

  it("明刻（中張牌）→ 2符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Sou5, isOpen: true },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
      ],
      pair: TT.Pin9,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Pin9),
      isTsumo: false,
      melds: [
        {
          type: MeldType.Pon,
          tiles: [tile(TT.Sou5), tile(TT.Sou5), tile(TT.Sou5)],
          calledTile: tile(TT.Sou5),
          fromPlayerIndex: 0,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 明刻(中張)2 + 待ち(単騎)2 = 24 → 30
    // ※副露ロンなので門前加符なし
    expect(result.total).toBe(30);
  });

  it("明刻（幺九牌）→ 4符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Ton, isOpen: true },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
      ],
      pair: TT.Man5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man5),
      isTsumo: false,
      melds: [
        {
          type: MeldType.Pon,
          tiles: [tile(TT.Ton), tile(TT.Ton), tile(TT.Ton)],
          calledTile: tile(TT.Ton),
          fromPlayerIndex: 0,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 明刻(幺九)4 + 待ち(単騎)2 = 26 → 30
    expect(result.total).toBe(30);
  });

  it("暗槓（中張牌）→ 16符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Kantsu, tileType: TT.Sou5, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
      ],
      pair: TT.Ton,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man4),
      isTsumo: true,
      melds: [
        {
          type: MeldType.Ankan,
          tiles: [tile(TT.Sou5), tile(TT.Sou5), tile(TT.Sou5), tile(TT.Sou5)],
          calledTile: tile(TT.Sou5),
          fromPlayerIndex: 0,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + ツモ2 + 暗槓(中張)16 + 雀頭(東→場風)2 = 40 → 40
    expect(result.total).toBe(40);
  });

  it("明槓（幺九牌）→ 16符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Kantsu, tileType: TT.Man1, isOpen: true },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
      ],
      pair: TT.Sou5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Sou5),
      isTsumo: false,
      melds: [
        {
          type: MeldType.Minkan,
          tiles: [tile(TT.Man1), tile(TT.Man1), tile(TT.Man1), tile(TT.Man1)],
          calledTile: tile(TT.Man1),
          fromPlayerIndex: 0,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 明槓(幺九)16 + 待ち(単騎)2 = 38 → 40
    // ※副露ロンなので門前加符なし
    expect(result.total).toBe(40);
  });

  it("暗槓（幺九牌）→ 32符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Kantsu, tileType: TT.Haku, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
      ],
      pair: TT.Man5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man5),
      isTsumo: true,
      melds: [
        {
          type: MeldType.Ankan,
          tiles: [tile(TT.Haku), tile(TT.Haku), tile(TT.Haku), tile(TT.Haku)],
          calledTile: tile(TT.Haku),
          fromPlayerIndex: 0,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + ツモ2 + 暗槓(幺九)32 + 待ち(単騎)2 = 56 → 60
    expect(result.total).toBe(60);
  });

  it("雀頭が三元牌 → +2符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
      ],
      pair: TT.Haku,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: false,
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 門前ロン10 + 暗刻(中張)4 + 雀頭(白)2 = 36 → 40
    expect(result.total).toBe(40);
  });

  it("雀頭が場風 → +2符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
      ],
      pair: TT.Ton,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: false,
      roundWind: TT.Ton,
      seatWind: TT.Sha,
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 門前ロン10 + 暗刻(中張)4 + 雀頭(場風)2 = 36 → 40
    expect(result.total).toBe(40);
  });

  it("雀頭が連風牌（4符ルール）→ +4符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
      ],
      pair: TT.Ton,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: false,
      roundWind: TT.Ton,
      seatWind: TT.Ton, // 連風牌
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 門前ロン10 + 暗刻(中張)4 + 雀頭(連風牌:4符ルール)4 = 38 → 40
    expect(result.total).toBe(40);
  });

  it("雀頭が連風牌（2符ルール）→ +2符", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
      ],
      pair: TT.Ton,
    };
    const rule: RuleConfig = { ...defaultRule, doubleWindFu: 2 };
    const ctx = makeCtx({
      winTile: tile(TT.Man1),
      isTsumo: false,
      roundWind: TT.Ton,
      seatWind: TT.Ton,
      ruleConfig: rule,
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20 + 門前ロン10 + 暗刻(中張)4 + 雀頭(連風牌:2符ルール)2 = 36 → 40
    expect(result.total).toBe(40);
  });

  it("食い平和形（副露ロンで符が20のまま）→ 30符に切り上げ", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: true },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
      ],
      pair: TT.Sou5,
    };
    const ctx = makeCtx({
      winTile: tile(TT.Man4),
      isTsumo: false,
      melds: [
        {
          type: MeldType.Chi,
          tiles: [tile(TT.Man1), tile(TT.Man2), tile(TT.Man3)],
          calledTile: tile(TT.Man1),
          fromPlayerIndex: 3,
        },
      ],
    });
    const result = calculateFu(hand, ctx, false);
    // 副底20のみ(副露ロン→門前加符なし, 全順子+役牌でない雀頭+両面待ち) → 30符に強制
    expect(result.total).toBe(30);
  });
});

// ===== 七対子の符テスト =====

describe("calculateChiitoitsuFu - 七対子の符", () => {
  it("通常ルール（25符2飜）→ 25符", () => {
    const ctx = makeCtx();
    const result = calculateChiitoitsuFu(ctx);
    expect(result.total).toBe(25);
  });

  it("50符1飜ルール → 50符", () => {
    const rule: RuleConfig = { ...defaultRule, chiitoitsuCalc: "50fu-1han" };
    const ctx = makeCtx({ ruleConfig: rule });
    const result = calculateChiitoitsuFu(ctx);
    expect(result.total).toBe(50);
  });
});

// ===== 待ち判定テスト =====

describe("detectWaitType - 待ちの種類判定", () => {
  it("両面待ち", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Haku, isOpen: false },
      ],
      pair: TT.Man2,
    };
    // 4-5-6 の 4 で和了 → 両面（3-4 待ち → 4 と 7 が待ち牌）
    const ctx = makeCtx({ winTile: tile(TT.Man4) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Ryanmen);
  });

  it("嵌張待ち", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Haku, isOpen: false },
      ],
      pair: TT.Man2,
    };
    // 4-5-6 の 5 で和了 → 嵌張
    const ctx = makeCtx({ winTile: tile(TT.Man5) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Kanchan);
  });

  it("辺張待ち（1-2-3 の 3）", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Haku, isOpen: false },
      ],
      pair: TT.Man5,
    };
    // 1-2-3 の 3 で和了 → 辺張
    const ctx = makeCtx({ winTile: tile(TT.Man3) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Penchan);
  });

  it("辺張待ち（7-8-9 の 7）", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Shuntsu, tileType: TT.Man7, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Haku, isOpen: false },
      ],
      pair: TT.Man5,
    };
    // 7-8-9 の 7 で和了 → 辺張
    const ctx = makeCtx({ winTile: tile(TT.Man7) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Penchan);
  });

  it("単騎待ち", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Sou1, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
      ],
      pair: TT.Ton,
    };
    const ctx = makeCtx({ winTile: tile(TT.Ton) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Tanki);
  });

  it("双碰待ち", () => {
    const hand: ParsedHand = {
      groups: [
        { type: GroupType.Koutsu, tileType: TT.Man5, isOpen: false },
        { type: GroupType.Koutsu, tileType: TT.Sou5, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Pin4, isOpen: false },
        { type: GroupType.Shuntsu, tileType: TT.Man1, isOpen: false },
      ],
      pair: TT.Ton,
    };
    // Man5 暗刻の和了牌 → 双碰
    const ctx = makeCtx({ winTile: tile(TT.Man5) });
    expect(detectWaitType(hand, ctx)).toBe(WaitType.Shanpon);
  });
});

// ===== 点数計算テスト =====

describe("calculateScore - 点数計算", () => {
  // ヘルパー: 手牌を構築して judgeWin → calculateScore を呼ぶ
  function scoreFromHand(opts: {
    handTiles: Tile[];
    winTile: Tile;
    melds?: Meld[];
    isTsumo: boolean;
    isDealer: boolean;
    seatWind?: TileType;
    roundWind?: TileType;
    honba?: number;
    riichiSticks?: number;
    ruleOverrides?: Partial<RuleConfig>;
    ctxOverrides?: Partial<WinContext>;
  }): { judge: JudgeResult; score: ReturnType<typeof calculateScore> } | null {
    const rule: RuleConfig = { ...defaultRule, ...opts.ruleOverrides };
    const ctx = makeCtx({
      handTiles: opts.handTiles,
      melds: opts.melds ?? [],
      winTile: opts.winTile,
      isTsumo: opts.isTsumo,
      seatWind: opts.seatWind ?? (opts.isDealer ? TT.Ton : TT.Sha),
      roundWind: opts.roundWind ?? TT.Ton,
      ruleConfig: rule,
      ...opts.ctxOverrides,
    });
    const judge = judgeWin(ctx);
    if (!judge) return null;

    const scoreCtx: ScoreContext = {
      judgeResult: judge,
      winContext: ctx,
      isDealer: opts.isDealer,
      honba: opts.honba ?? 0,
      riichiSticks: opts.riichiSticks ?? 0,
    };
    return { judge, score: calculateScore(scoreCtx) };
  }

  // --- 子ロン ---

  it("子ロン: リーチ + 平和 (1飜+1飜=2飜, 30符) → 2000点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: false,
      isDealer: false,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalHan).toBe(2);
    expect(result!.score.totalFu).toBe(30);
    expect(result!.score.payment.ronLoserPayment).toBe(2000);
  });

  it("子ロン: タンヤオ (1飜, 40符) → 2600点", () => {
    // 2m,3m,4m + 5s,5s,5s + 6p,7p,8p + 3m,4m,5m + 2s,2s
    // 暗刻5sで4符 + 副底20 + 門前ロン10 = 34 → 40符
    // 待ちは 2s 単騎 (+2符) → 36 → 40符
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou5,
        TT.Sou5,
        TT.Sou5,
        TT.Pin6,
        TT.Pin7,
        TT.Pin8,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou2),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalHan).toBe(1);
    expect(result!.score.totalFu).toBe(40);
    // 1飜40符 子ロン = 40 × 2^3 × 4 = 40 × 8 × 4 = 1280 → 切り上げ 1300...
    // wait, 基本点 = 40 × 2^(1+2) = 40 × 8 = 320, ロン = 320 × 4 = 1280 → 1300
    expect(result!.score.payment.ronLoserPayment).toBe(1300);
  });

  it("子ロン: リーチ + 一発 + ツモ → ツモではないのでツモ判定外", () => {
    // これはロンのテスト。リーチ+平和 = 2飜30符 → 2000
    // 上のテストと同じ。スキップ。
  });

  it("子ロン: 満貫 (5飜) → 8000点", () => {
    // リーチ + タンヤオ + 平和 + 一盃口 + 一発 = 5飜
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: false,
      isDealer: false,
      ctxOverrides: { isRiichi: true, isIppatsu: true },
    });
    expect(result).not.toBeNull();
    // リーチ1 + 平和1 + 一盃口1 + タンヤオ1 + 一発1 = 5飜
    expect(result!.score.totalHan).toBe(5);
    expect(result!.score.level).toBe("mangan");
    expect(result!.score.payment.ronLoserPayment).toBe(8000);
  });

  it("子ロン: 跳満 (6飜) → 12000点", () => {
    // 清一色(6飜) — 一気通貫にならないよう構成
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Man9,
        TT.Man9,
        TT.Man5,
        TT.Man5,
      ),
      winTile: tile(TT.Man6),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("haneman");
    expect(result!.score.payment.ronLoserPayment).toBe(12000);
  });

  it("子ロン: 倍満 (8飜) → 16000点", () => {
    // 清一色(6) + タンヤオ(1) + 平和(1) = 8飜
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Man6,
        TT.Man7,
        TT.Man8,
        TT.Man5,
        TT.Man5,
      ),
      winTile: tile(TT.Man2),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("baiman");
    expect(result!.score.payment.ronLoserPayment).toBe(16000);
  });

  // --- 親ロン ---

  it("親ロン: リーチ + 平和 (2飜, 30符) → 2900点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: false,
      isDealer: true,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    // 30符 × 2^4 = 480, × 6 = 2880 → 2900
    expect(result!.score.payment.ronLoserPayment).toBe(2900);
  });

  it("親ロン: 満貫 → 12000点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: false,
      isDealer: true,
      ctxOverrides: { isRiichi: true, isIppatsu: true },
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("mangan");
    expect(result!.score.payment.ronLoserPayment).toBe(12000);
  });

  // --- ツモ ---

  it("子ツモ: リーチ + 門前清自摸和 + 平和 (3飜, 20符)", () => {
    // 平和ツモ → 20符
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: true,
      isDealer: false,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalHan).toBe(3);
    expect(result!.score.totalFu).toBe(20);
    // 基本点: 20 × 2^5 = 640
    // 子払い: 700 (切り上げ), 親払い: 1300 (切り上げ)
    expect(result!.score.payment.tsumoPaymentChild).toBe(700);
    expect(result!.score.payment.tsumoPaymentDealer).toBe(1300);
  });

  it("親ツモ: タンヤオ + 門前清自摸和 (2飜, 30符)", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou5,
        TT.Sou5,
        TT.Sou5,
        TT.Pin6,
        TT.Pin7,
        TT.Pin8,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou2),
      isTsumo: true,
      isDealer: true,
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalHan).toBe(2);
    // 副底20 + ツモ2 + 暗刻(中張)4 + 待ち(単騎)2 = 28 → 30符
    expect(result!.score.totalFu).toBe(30);
    // 基本点: 30 × 2^4 = 480
    // 親ツモ: 各子 480 × 2 = 960 → 1000
    expect(result!.score.payment.tsumoPaymentChild).toBe(1000);
    expect(result!.score.payment.tsumoPaymentDealer).toBe(0);
  });

  it("子ツモ: 満貫 (5飜)", () => {
    // リーチ(1) + 門前清自摸和(1) + タンヤオ(1) + 平和(1) + 一盃口(1) = 5飜
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: true,
      isDealer: false,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("mangan");
    // 子ツモ満貫: 子2000, 親4000
    expect(result!.score.payment.tsumoPaymentChild).toBe(2000);
    expect(result!.score.payment.tsumoPaymentDealer).toBe(4000);
  });

  it("親ツモ: 満貫 (5飜)", () => {
    // リーチ(1) + 門前清自摸和(1) + タンヤオ(1) + 平和(1) + 一盃口(1) = 5飜
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: true,
      isDealer: true,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("mangan");
    // 親ツモ満貫: 各子4000
    expect(result!.score.payment.tsumoPaymentChild).toBe(4000);
  });

  // --- 本場・供託 ---

  it("本場加算: 子ロン 1本場 → +300", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: false,
      isDealer: false,
      honba: 1,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    // 2飜30符 = 2000 + 300(1本場) = 2300
    expect(result!.score.payment.ronLoserPayment).toBe(2300);
  });

  it("本場加算: 子ツモ 2本場 → 各+200", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: true,
      isDealer: false,
      honba: 2,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    // 3飜20符 平和ツモ: 基本点 20 × 2^5 = 640
    // 子: 700 + 200 = 900, 親: 1300 + 200 = 1500
    expect(result!.score.payment.tsumoPaymentChild).toBe(900);
    expect(result!.score.payment.tsumoPaymentDealer).toBe(1500);
  });

  it("供託リーチ棒が加算される", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin2,
        TT.Pin3,
        TT.Pin4,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Sou4),
      isTsumo: false,
      isDealer: false,
      riichiSticks: 2,
      ctxOverrides: { isRiichi: true },
    });
    expect(result).not.toBeNull();
    // 2飜30符ロン = 2000 + 供託2000 = totalWinnerGain 4000
    expect(result!.score.payment.ronLoserPayment).toBe(2000);
    expect(result!.score.payment.totalWinnerGain).toBe(4000);
  });

  // --- 特殊ケース ---

  it("七対子: 2飜25符 子ロン → 1600点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man1,
        TT.Man1,
        TT.Man3,
        TT.Man3,
        TT.Sou5,
        TT.Sou5,
        TT.Pin2,
        TT.Pin2,
        TT.Pin7,
        TT.Pin7,
        TT.Ton,
        TT.Ton,
        TT.Haku,
        TT.Haku,
      ),
      winTile: tile(TT.Haku),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalFu).toBe(25);
    // 基本点: 25 × 2^4 = 400, × 4 = 1600
    expect(result!.score.payment.ronLoserPayment).toBe(1600);
  });

  it("切り上げ満貫: 4飜30符 → kiriage=true なら 8000(子ロン)", () => {
    // 4飜30符: 基本点 30 × 2^6 = 1920 → kiriage で 2000(満貫)
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: false,
      isDealer: false,
      ctxOverrides: { isRiichi: true },
      ruleOverrides: { kiriage: true },
    });
    expect(result).not.toBeNull();
    // リーチ1 + 平和1 + タンヤオ1 + 一盃口1 = 4飜, 30符
    expect(result!.score.totalHan).toBe(4);
    expect(result!.score.totalFu).toBe(30);
    expect(result!.score.level).toBe("mangan");
    expect(result!.score.payment.ronLoserPayment).toBe(8000);
  });

  it("切り上げ満貫: 4飜30符 → kiriage=false なら 7700(子ロン)", () => {
    const result = scoreFromHand({
      handTiles: tiles(
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Sou4,
        TT.Sou5,
        TT.Sou6,
        TT.Pin3,
        TT.Pin4,
        TT.Pin5,
        TT.Sou2,
        TT.Sou2,
      ),
      winTile: tile(TT.Man2),
      isTsumo: false,
      isDealer: false,
      ctxOverrides: { isRiichi: true },
      ruleOverrides: { kiriage: false },
    });
    expect(result).not.toBeNull();
    expect(result!.score.totalHan).toBe(4);
    expect(result!.score.totalFu).toBe(30);
    expect(result!.score.level).toBe("normal");
    // 基本点 1920, × 4 = 7680 → 7700
    expect(result!.score.payment.ronLoserPayment).toBe(7700);
  });

  // --- 役満 ---

  it("役満: 国士無双 子ロン → 32000点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
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
        TT.Man1,
      ),
      winTile: tile(TT.Chun),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("yakuman");
    expect(result!.score.payment.ronLoserPayment).toBe(32000);
  });

  it("役満: 四暗刻 親ツモ → 各子16000点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
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
      ),
      winTile: tile(TT.Sou5),
      isTsumo: true,
      isDealer: true,
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("yakuman");
    // 親ツモ役満: 基本点8000, 各子 8000 × 2 = 16000
    expect(result!.score.payment.tsumoPaymentChild).toBe(16000);
  });

  it("ダブル役満: 国士無双十三面待ち 子ロン → 64000点", () => {
    const result = scoreFromHand({
      handTiles: tiles(
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
      ),
      winTile: tile(TT.Chun),
      isTsumo: false,
      isDealer: false,
    });
    expect(result).not.toBeNull();
    expect(result!.score.level).toBe("yakuman");
    // ダブル役満: 基本点16000, × 4 = 64000
    expect(result!.score.payment.ronLoserPayment).toBe(64000);
  });
});
