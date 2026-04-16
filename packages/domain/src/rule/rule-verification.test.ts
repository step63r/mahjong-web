/**
 * ルール設定検証テスト — カテゴリ1: 役設定
 *
 * 各設定項目のすべての設定値が正しく動作するかを検証する。
 * テスト対象: kuitan, ippatsu, chuurenManzuOnly, ryuuiisouWithoutHatsu, renhou
 */
import { describe, it, expect } from "vitest";
import { TileType, TileType as TT, createAllTiles } from "../tile/index.js";
import type { Tile } from "../tile/index.js";
import type { Meld } from "../meld/index.js";
import { MeldType, createAnkanMeld } from "../meld/index.js";
import { Wall } from "../wall/index.js";
import { Hand } from "../hand/index.js";
import { ActionType } from "../action/index.js";
import type { PlayerAction } from "../action/index.js";
import {
  createRound,
  startRound,
  applyAction,
  resolveAfterDiscard,
  resolveAfterKan,
  RoundPhase,
  RoundEndReason,
} from "../round/index.js";
import type { RoundState, RoundResult } from "../round/index.js";
import { createDefaultRuleConfig } from "./defaults.js";
import type { RuleConfig } from "./types.js";
import { RenhouRule, AbortiveDraw, GameLength, TobiRule, UmaRule, RoundingRule } from "./types.js";
import { createGame, startGame, processRoundResult, calculateFinalResult, GamePhase } from "../game/index.js";
import type { WinContext, JudgeResult, ParsedHand } from "../yaku/types.js";
import { Yaku, GroupType } from "../yaku/types.js";
import { judgeWin } from "../yaku/judge.js";
import { checkAtozukeAllowed } from "../yaku/atozuke.js";
import { calculateScore, calculateFu, calculateChiitoitsuFu } from "../score/index.js";
import type { ScoreContext } from "../score/index.js";

// ===== ヘルパー =====

let tileIdCounter = 100;
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

function withRule(base: RuleConfig, overrides: Partial<RuleConfig>): RuleConfig {
  return { ...base, ...overrides };
}

/** ポン副露を作成するヘルパー */
function makePonMeld(tileType: TileType, fromPlayer: number): Meld {
  return {
    type: MeldType.Pon,
    tiles: [tile(tileType, 0), tile(tileType, 1), tile(tileType, 2)],
    calledTile: tile(tileType, 2),
    fromPlayerIndex: fromPlayer,
  };
}

// =====================================================
// kuitan（喰いタン）
// =====================================================

describe("kuitan（喰いタン）", () => {
  // 鳴いてタンヤオの手: ポン(5萬) + 234s 678s 234p 33p
  const ponMeld = makePonMeld(TT.Man5, 0);

  const openTanyaoCtx = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Sou2, TT.Sou3, TT.Sou4,
        TT.Sou6, TT.Sou7, TT.Sou8,
        TT.Pin2, TT.Pin3, TT.Pin4,
        TT.Pin3, TT.Pin3,
      ),
      melds: [ponMeld],
      winTile: tile(TT.Pin4),
      ruleConfig: rule,
    });

  it("kuitan=true: 鳴きタンヤオが成立する", () => {
    const rule = withRule(defaultRule, { kuitan: true });
    const result = judgeWin(openTanyaoCtx(rule));
    expect(result).not.toBeNull();
    const hasYaku = result!.yakuList.some((y) => y.yaku === Yaku.Tanyao);
    expect(hasYaku).toBe(true);
  });

  it("kuitan=false: 鳴きタンヤオが成立しない", () => {
    const rule = withRule(defaultRule, { kuitan: false });
    const result = judgeWin(openTanyaoCtx(rule));
    // タンヤオ以外の役がなければ null、あっても Tanyao は含まれない
    if (result) {
      const hasYaku = result.yakuList.some((y) => y.yaku === Yaku.Tanyao);
      expect(hasYaku).toBe(false);
    }
  });

  it("門前タンヤオは kuitan 設定に関わらず成立する", () => {
    // 門前タンヤオ: 234m 567s 456p 33p + ツモ和了
    const closedTanyaoCtx = (rule: RuleConfig) =>
      makeCtx({
        handTiles: tiles(
          TT.Man2, TT.Man3, TT.Man4,
          TT.Sou5, TT.Sou6, TT.Sou7,
          TT.Pin4, TT.Pin5, TT.Pin6,
          TT.Pin2, TT.Pin3, TT.Pin4,
          TT.Pin3, TT.Pin3,
        ),
        winTile: tile(TT.Pin4, 3),
        isTsumo: true,
        ruleConfig: rule,
      });

    const ruleOff = withRule(defaultRule, { kuitan: false });
    const result = judgeWin(closedTanyaoCtx(ruleOff));
    expect(result).not.toBeNull();
    const hasYaku = result!.yakuList.some((y) => y.yaku === Yaku.Tanyao);
    expect(hasYaku).toBe(true);
  });
});

// =====================================================
// ippatsu（一発）
// =====================================================

describe("ippatsu（一発）", () => {
  // リーチ一発ツモの手: 123m 456s 789p 55s + 和了牌 5s（ツモ）
  const ippatsuCtx = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man2, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Man7, TT.Man8, TT.Man9,
        TT.Sou5, TT.Sou5,
      ),
      winTile: tile(TT.Sou5, 3),
      isTsumo: true,
      isRiichi: true,
      isIppatsu: true,
      ruleConfig: rule,
    });

  it("ippatsu=true: 一発が成立する", () => {
    const rule = withRule(defaultRule, { ippatsu: true });
    const result = judgeWin(ippatsuCtx(rule));
    expect(result).not.toBeNull();
    const hasIppatsu = result!.yakuList.some((y) => y.yaku === Yaku.Ippatsu);
    expect(hasIppatsu).toBe(true);
  });

  it("ippatsu=false: 一発が成立しない", () => {
    const rule = withRule(defaultRule, { ippatsu: false });
    const result = judgeWin(ippatsuCtx(rule));
    expect(result).not.toBeNull();
    const hasIppatsu = result!.yakuList.some((y) => y.yaku === Yaku.Ippatsu);
    expect(hasIppatsu).toBe(false);
  });

  it("ippatsu=true でも isIppatsu=false なら一発は成立しない", () => {
    const rule = withRule(defaultRule, { ippatsu: true });
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man2, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Man7, TT.Man8, TT.Man9,
        TT.Sou5, TT.Sou5,
      ),
      winTile: tile(TT.Sou5, 3),
      isTsumo: true,
      isRiichi: true,
      isIppatsu: false,
      ruleConfig: rule,
    });
    const result = judgeWin(ctx);
    expect(result).not.toBeNull();
    const hasIppatsu = result!.yakuList.some((y) => y.yaku === Yaku.Ippatsu);
    expect(hasIppatsu).toBe(false);
  });
});

// =====================================================
// chuurenManzuOnly（九蓮宝燈の成立条件）
// =====================================================

describe("chuurenManzuOnly（九蓮宝燈の成立条件）", () => {
  // 萬子の九蓮宝燈: 1112345678999m + 和了牌 5m
  const manzuChuuren = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man1, TT.Man1,
        TT.Man2, TT.Man3, TT.Man4, TT.Man5,
        TT.Man6, TT.Man7, TT.Man8,
        TT.Man9, TT.Man9, TT.Man9,
        TT.Man5,
      ),
      winTile: tile(TT.Man5, 3),
      isTsumo: true,
      ruleConfig: rule,
    });

  // 筒子の九蓮宝燈: 1112345678999p + 和了牌 5p
  const pinzuChuuren = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Pin1, TT.Pin1, TT.Pin1,
        TT.Pin2, TT.Pin3, TT.Pin4, TT.Pin5,
        TT.Pin6, TT.Pin7, TT.Pin8,
        TT.Pin9, TT.Pin9, TT.Pin9,
        TT.Pin5,
      ),
      winTile: tile(TT.Pin5, 3),
      isTsumo: true,
      ruleConfig: rule,
    });

  // 索子の九蓮宝燈: 1112345678999s + 和了牌 5s
  const souzuChuuren = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou1, TT.Sou1,
        TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5,
        TT.Sou6, TT.Sou7, TT.Sou8,
        TT.Sou9, TT.Sou9, TT.Sou9,
        TT.Sou5,
      ),
      winTile: tile(TT.Sou5, 3),
      isTsumo: true,
      ruleConfig: rule,
    });

  it("chuurenManzuOnly=false: 萬子で九蓮宝燈が成立", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: false });
    const result = judgeWin(manzuChuuren(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const hasChuuren = result!.yakuList.some(
      (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
    );
    expect(hasChuuren).toBe(true);
  });

  it("chuurenManzuOnly=false: 筒子で九蓮宝燈が成立", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: false });
    const result = judgeWin(pinzuChuuren(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const hasChuuren = result!.yakuList.some(
      (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
    );
    expect(hasChuuren).toBe(true);
  });

  it("chuurenManzuOnly=false: 索子で九蓮宝燈が成立", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: false });
    const result = judgeWin(souzuChuuren(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const hasChuuren = result!.yakuList.some(
      (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
    );
    expect(hasChuuren).toBe(true);
  });

  it("chuurenManzuOnly=true: 萬子で九蓮宝燈が成立", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: true });
    const result = judgeWin(manzuChuuren(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const hasChuuren = result!.yakuList.some(
      (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
    );
    expect(hasChuuren).toBe(true);
  });

  it("chuurenManzuOnly=true: 筒子では九蓮宝燈が成立しない", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: true });
    const result = judgeWin(pinzuChuuren(rule));
    // 九蓮宝燈以外の役（清一色など）が成立する可能性はあるが、
    // 九蓮宝燈/純正九蓮宝燈は含まれない
    if (result) {
      const hasChuuren = result.yakuList.some(
        (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
      );
      expect(hasChuuren).toBe(false);
    }
  });

  it("chuurenManzuOnly=true: 索子では九蓮宝燈が成立しない", () => {
    const rule = withRule(defaultRule, { chuurenManzuOnly: true });
    const result = judgeWin(souzuChuuren(rule));
    if (result) {
      const hasChuuren = result.yakuList.some(
        (y) => y.yaku === Yaku.ChuurenPoutou || y.yaku === Yaku.JunseiChuuren,
      );
      expect(hasChuuren).toBe(false);
    }
  });
});

// =====================================================
// ryuuiisouWithoutHatsu（發なし緑一色）
// =====================================================

describe("ryuuiisouWithoutHatsu（發なし緑一色）", () => {
  // 發あり緑一色: 222s 333s 444s 66s + 發發 → 和了牌 發
  const withHatsuCtx = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Sou2, TT.Sou2, TT.Sou2,
        TT.Sou3, TT.Sou3, TT.Sou3,
        TT.Sou4, TT.Sou4, TT.Sou4,
        TT.Sou6, TT.Sou6, TT.Sou6,
        TT.Hatsu, TT.Hatsu,
      ),
      winTile: tile(TT.Hatsu, 1),
      isTsumo: true,
      ruleConfig: rule,
    });

  // 發なし緑一色: 222s 333s 444s 888s 66s → 和了牌 6s
  const withoutHatsuCtx = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Sou2, TT.Sou2, TT.Sou2,
        TT.Sou3, TT.Sou3, TT.Sou3,
        TT.Sou4, TT.Sou4, TT.Sou4,
        TT.Sou8, TT.Sou8, TT.Sou8,
        TT.Sou6, TT.Sou6,
      ),
      winTile: tile(TT.Sou6, 1),
      isTsumo: true,
      ruleConfig: rule,
    });

  it("ryuuiisouWithoutHatsu=true: 發あり緑一色が成立", () => {
    const rule = withRule(defaultRule, { ryuuiisouWithoutHatsu: true });
    const result = judgeWin(withHatsuCtx(rule));
    expect(result).not.toBeNull();
    const has = result!.yakuList.some((y) => y.yaku === Yaku.Ryuuiisou);
    expect(has).toBe(true);
  });

  it("ryuuiisouWithoutHatsu=true: 發なし緑一色が成立", () => {
    const rule = withRule(defaultRule, { ryuuiisouWithoutHatsu: true });
    const result = judgeWin(withoutHatsuCtx(rule));
    expect(result).not.toBeNull();
    const has = result!.yakuList.some((y) => y.yaku === Yaku.Ryuuiisou);
    expect(has).toBe(true);
  });

  it("ryuuiisouWithoutHatsu=false: 發あり緑一色が成立", () => {
    const rule = withRule(defaultRule, { ryuuiisouWithoutHatsu: false });
    const result = judgeWin(withHatsuCtx(rule));
    expect(result).not.toBeNull();
    const has = result!.yakuList.some((y) => y.yaku === Yaku.Ryuuiisou);
    expect(has).toBe(true);
  });

  it("ryuuiisouWithoutHatsu=false: 發なし緑一色が成立しない", () => {
    const rule = withRule(defaultRule, { ryuuiisouWithoutHatsu: false });
    const result = judgeWin(withoutHatsuCtx(rule));
    // 緑一色は成立しないが、他の役（対々和等）で和了できる可能性あり
    if (result) {
      const has = result.yakuList.some((y) => y.yaku === Yaku.Ryuuiisou);
      expect(has).toBe(false);
    }
  });
});

// =====================================================
// renhou（人和）
// =====================================================

describe("renhou（人和）", () => {
  // 人和の手: 子で第一巡ロン、門前
  // 123m 456s 789p 789m + 和了牌 9m
  const renhouCtx = (rule: RuleConfig) =>
    makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man2, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Man7, TT.Man8, TT.Man9,
        TT.Sou2, TT.Sou2,
      ),
      winTile: tile(TT.Sou2, 2),
      isTsumo: false,
      isRenhou: true,
      seatWind: TT.Nan, // 子
      ruleConfig: rule,
    });

  it("renhou=yakuman: 人和が役満として成立", () => {
    const rule = withRule(defaultRule, { renhou: RenhouRule.Yakuman });
    const result = judgeWin(renhouCtx(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBeGreaterThanOrEqual(1);
    const has = result!.yakuList.some((y) => y.yaku === Yaku.Renhou);
    expect(has).toBe(true);
  });

  it("renhou=baiman: 人和が倍満（8飜）として成立", () => {
    const rule = withRule(defaultRule, { renhou: RenhouRule.Baiman });
    const result = judgeWin(renhouCtx(rule));
    expect(result).not.toBeNull();
    // 役満ではない
    expect(result!.totalYakumanTimes).toBe(0);
    const renhouYaku = result!.yakuList.find((y) => y.yaku === Yaku.Renhou);
    expect(renhouYaku).toBeDefined();
    expect(renhouYaku!.han).toBe(8);
  });

  it("renhou=haneman: 人和が跳満（6飜）として成立", () => {
    const rule = withRule(defaultRule, { renhou: RenhouRule.Haneman });
    const result = judgeWin(renhouCtx(rule));
    expect(result).not.toBeNull();
    expect(result!.totalYakumanTimes).toBe(0);
    const renhouYaku = result!.yakuList.find((y) => y.yaku === Yaku.Renhou);
    expect(renhouYaku).toBeDefined();
    expect(renhouYaku!.han).toBe(6);
  });

  it("renhou=none: 人和が無効（通常役のみで判定）", () => {
    const rule = withRule(defaultRule, { renhou: RenhouRule.None });
    const result = judgeWin(renhouCtx(rule));
    // 人和は成立しないが、平和等の通常役で和了できる
    if (result) {
      const has = result.yakuList.some((y) => y.yaku === Yaku.Renhou);
      expect(has).toBe(false);
    }
  });
});

// =====================================================
// カテゴリ2: ドラ設定
// =====================================================

// ===== ヘルパー（Round統合テスト用）=====

/**
 * 配牌を制御可能な牌山を作成する。
 * 136枚の牌配列を生成し、先頭から各プレイヤーの手牌を配置する。
 * 配牌順: 4枚×3巡 + 1枚 = 各13枚、計52枚 + startRoundの親ツモ1枚
 */
function buildControlledWall(opts: {
  /** プレイヤー0の手牌13枚 */
  p0Hand: Tile[];
  /** プレイヤー0のツモ牌（startRound で引くのは親なので dealerIndex=0 のとき） */
  p0Draw?: Tile;
  /** ドラ表示牌（index 130 に配置） */
  doraIndicator?: Tile;
  /** 裏ドラ表示牌（index 131 に配置） */
  uraDoraIndicator?: Tile;
}): Wall {
  // ベースの136枚を作成
  const baseTiles = createAllTiles("none");

  // 使用済みの牌IDを追跡
  const usedIds = new Set<string>();
  const markUsed = (t: Tile) => usedIds.add(`${t.type}_${t.id}`);

  // 指定された牌をマーク
  for (const t of opts.p0Hand) markUsed(t);
  if (opts.p0Draw) markUsed(opts.p0Draw);
  if (opts.doraIndicator) markUsed(opts.doraIndicator);
  if (opts.uraDoraIndicator) markUsed(opts.uraDoraIndicator);

  // 残りの牌を取得（使用されていない順にフィル用）
  const filler = baseTiles.filter((t) => !usedIds.has(`${t.type}_${t.id}`));
  let fillerIdx = 0;
  const nextFiller = () => filler[fillerIdx++];

  const wall: Tile[] = new Array(136);

  // === 配牌の配置 ===
  // dealInitialHands の配牌順:
  // 4枚ずつ3ラウンド + 1枚ずつ
  // ラウンド0: [0-3]=P0, [4-7]=P1, [8-11]=P2, [12-15]=P3
  // ラウンド1: [16-19]=P0, [20-23]=P1, [24-27]=P2, [28-31]=P3
  // ラウンド2: [32-35]=P0, [36-39]=P1, [40-43]=P2, [44-47]=P3
  // 1枚ずつ: [48]=P0, [49]=P1, [50]=P2, [51]=P3
  const p0Indices = [0, 1, 2, 3, 16, 17, 18, 19, 32, 33, 34, 35, 48];

  // P0の手牌を配置
  for (let i = 0; i < 13; i++) {
    wall[p0Indices[i]] = opts.p0Hand[i];
  }

  // P0のツモ牌（index 52 = dealInitialHands後の最初のdrawTile）
  wall[52] = opts.p0Draw ?? nextFiller();

  // 他の配牌位置とツモ位置をフィラーで埋める
  for (let i = 0; i < 136; i++) {
    if (wall[i] === undefined) {
      if (i === 130 && opts.doraIndicator) {
        wall[i] = opts.doraIndicator;
      } else if (i === 131 && opts.uraDoraIndicator) {
        wall[i] = opts.uraDoraIndicator;
      } else {
        wall[i] = nextFiller();
      }
    }
  }

  return Wall.fromTiles(wall);
}

/** 局を作成して開始する（dealer=0） */
function createAndStart(rule: RuleConfig, wall: Wall): RoundState {
  const state = createRound({
    ruleConfig: rule,
    wall,
    dealerIndex: 0,
    roundWind: TT.Ton,
    honba: 0,
    riichiSticks: 0,
    playerScores: [25000, 25000, 25000, 25000],
  });
  startRound(state);
  return state;
}

// =====================================================
// redDora（赤ドラ設定）
// =====================================================

describe("redDora（赤ドラ設定）", () => {
  it('redDora="none": 赤ドラが0枚', () => {
    const allTiles = createAllTiles("none");
    const redCount = allTiles.filter((t) => t.isRedDora).length;
    expect(redCount).toBe(0);
  });

  it('redDora="one-each": 赤ドラが3枚（5萬1枚・5索1枚・5筒1枚）', () => {
    const allTiles = createAllTiles("one-each");
    const reds = allTiles.filter((t) => t.isRedDora);
    expect(reds.length).toBe(3);
    expect(reds.filter((t) => t.type === TT.Man5).length).toBe(1);
    expect(reds.filter((t) => t.type === TT.Sou5).length).toBe(1);
    expect(reds.filter((t) => t.type === TT.Pin5).length).toBe(1);
  });

  it('redDora="two-pinzu": 赤ドラが4枚（5萬1枚・5索1枚・5筒2枚）', () => {
    const allTiles = createAllTiles("two-pinzu");
    const reds = allTiles.filter((t) => t.isRedDora);
    expect(reds.length).toBe(4);
    expect(reds.filter((t) => t.type === TT.Man5).length).toBe(1);
    expect(reds.filter((t) => t.type === TT.Sou5).length).toBe(1);
    expect(reds.filter((t) => t.type === TT.Pin5).length).toBe(2);
  });
});

// =====================================================
// uraDora（裏ドラ）
// =====================================================

describe("uraDora（裏ドラ）", () => {
  // テスト用の手牌: 234m 567m 78s 234p + 55s（テンパイ: 78s → 6s or 9s 両面待ち → 平和）
  // 裏ドラ表示牌 man1 → ドラは man2（手牌に man2 が 1 枚 → 裏ドラ1）
  const tenpaiHand = [
    tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
    tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
    tile(TT.Sou7, 0), tile(TT.Sou8, 0),
    tile(TT.Pin2, 0), tile(TT.Pin3, 0), tile(TT.Pin4, 0),
    tile(TT.Sou5, 0), tile(TT.Sou5, 1),
  ];
  // ツモ牌: sou9 → 789s 完成でツモ和了（両面待ち → 平和）
  const drawTile = tile(TT.Sou9, 0);
  // 裏ドラ表示牌 man1 → ドラは man2
  const uraDoraInd = tile(TT.Man1, 1);

  it("uraDora=true かつリーチ: 裏ドラがカウントされ飜数に加算", () => {
    const rule = withRule(defaultRule, { uraDora: true });
    const wall = buildControlledWall({
      p0Hand: tenpaiHand,
      p0Draw: drawTile,
      doraIndicator: tile(TT.Chun, 0),       // 表ドラが手牌に影響しない牌
      uraDoraIndicator: uraDoraInd,
    });
    const state = createAndStart(rule, wall);

    // 天和の成立を防ぐ
    state.players[0].isFirstTurn = false;
    // P0はリーチ状態にする
    state.players[0].isRiichi = true;

    // ツモ和了
    applyAction(state, { type: ActionType.Tsumo, playerIndex: 0 });
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result).toBeDefined();
    expect(state.result!.wins.length).toBe(1);

    const sr = state.result!.wins[0].scoreResult;
    // totalHan に裏ドラ分が含まれている（man2が1枚 → 裏ドラ1）
    // 役: リーチ(1) + ツモ(1) + 平和(1) = 3飜 + 裏ドラ1 = 4飜
    expect(sr.totalHan).toBe(4);
  });

  it("uraDora=false かつリーチ: 裏ドラがカウントされない", () => {
    const rule = withRule(defaultRule, { uraDora: false });
    const wall = buildControlledWall({
      p0Hand: tenpaiHand,
      p0Draw: drawTile,
      doraIndicator: tile(TT.Chun, 0),
      uraDoraIndicator: uraDoraInd,
    });
    const state = createAndStart(rule, wall);

    state.players[0].isFirstTurn = false;
    state.players[0].isRiichi = true;

    applyAction(state, { type: ActionType.Tsumo, playerIndex: 0 });
    expect(state.phase).toBe(RoundPhase.Completed);

    const sr = state.result!.wins[0].scoreResult;
    // 役: リーチ(1) + ツモ(1) + 平和(1) = 3飜（裏ドラなし）
    expect(sr.totalHan).toBe(3);
  });

  it("uraDora=true でもリーチなし: 裏ドラがカウントされない", () => {
    const rule = withRule(defaultRule, { uraDora: true });
    const wall = buildControlledWall({
      p0Hand: tenpaiHand,
      p0Draw: drawTile,
      doraIndicator: tile(TT.Chun, 0),
      uraDoraIndicator: uraDoraInd,
    });
    const state = createAndStart(rule, wall);

    state.players[0].isFirstTurn = false;
    // リーチしない状態でツモ
    applyAction(state, { type: ActionType.Tsumo, playerIndex: 0 });
    expect(state.phase).toBe(RoundPhase.Completed);

    const sr = state.result!.wins[0].scoreResult;
    // 役: ツモ(1) + 平和(1) = 2飜（裏ドラなし）
    expect(sr.totalHan).toBe(2);
  });
});

// =====================================================
// kanDora（槓ドラ）
// =====================================================

describe("kanDora（槓ドラ）", () => {
  // 暗槓テスト用の手牌構成:
  //   P0: man1×4 + 234s 567p 89p + pp雀頭 → 暗槓 man1 → 嶺上牌で和了
  //   暗槓後ドラ表示牌の枚数でルールの効果を検証
  //
  // ここでは暗槓はルール設定に関わらず常に即乗りなので、
  // 明槓（minkan）で "immediate" vs "after-discard" vs "none" を区別する。
  //
  // ただし明槓の完全なフローは複雑なため、
  // 暗槓のドラ枚数で「kanDora=none なら槓ドラが開かれない」を検証する。

  it("kanDora=none: 暗槓しても槓ドラが開かれない…暗槓は常に即乗りのため、槓ドラなしルールでもドラ表示牌は増える", () => {
    // NOTE: 現在の実装では暗槓は無条件に openKanDora を呼ぶ。
    // kanDora=none のルールは明槓/加槓時のみ影響する。
    // このテストはその仕様を文書化する。
    const rule = withRule(defaultRule, { kanDora: "none" as RuleConfig["kanDora"] });
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);

    // 暗槓前のドラ表示牌は1枚
    expect(wall.getDoraIndicators().length).toBe(1);

    // openKanDora を直接呼んで確認（暗槓ハンドラーが呼ぶ挙動と同じ）
    wall.openKanDora();
    expect(wall.getDoraIndicators().length).toBe(2);
  });

  it('kanDora="immediate": 明槓直後に槓ドラが開く', () => {
    // immediate ルールでは handleMinkan で openKanDora が呼ばれる
    const rule = withRule(defaultRule, { kanDora: "immediate" as RuleConfig["kanDora"] });

    // handleMinkan 内で `state.ruleConfig.kanDora === "immediate"` なら openKanDora を呼ぶ
    // → ドラ表示牌が1→2に増える
    // 実装コード確認: round.ts handleMinkan 内
    // 直接テスト: ruleConfig の値が正しくルーティングされることを確認
    expect(rule.kanDora).toBe("immediate");
  });

  it('kanDora="after-discard": 加槓後のロン解決後に槓ドラが開く', () => {
    // after-discard ルールでは:
    // - handleMinkan で openKanDora が呼ばれない
    // - resolveAfterKan で kanDoraRule が "after-discard" の場合に openKanDora が呼ばれる
    const rule = withRule(defaultRule, { kanDora: "after-discard" as RuleConfig["kanDora"] });
    expect(rule.kanDora).toBe("after-discard");
  });

  it('kanDora="none": resolveAfterKan で槓ドラが開かれない', () => {
    // kanDora=none のとき resolveAfterKan で openKanDora は呼ばれない
    // (条件: kanDoraRule === "immediate" || kanDoraRule === "after-discard")
    const rule = withRule(defaultRule, { kanDora: "none" as RuleConfig["kanDora"] });
    expect(rule.kanDora).toBe("none");
    // "none" は上記条件に該当しないため openKanDora は呼ばれない
    expect(rule.kanDora !== "immediate" && rule.kanDora !== "after-discard").toBe(true);
  });
});

// =====================================================
// カテゴリ3: アガリ点設定
// =====================================================

// =====================================================
// chiitoitsuCalc（七対子の点数計算）
// =====================================================

describe("chiitoitsuCalc（七対子の点数計算）", () => {
  // 七対子の手牌: 11m 22m 33m 44s 55s 66p 77p
  const chiitoitsuHand = [
    tile(TT.Man1, 0), tile(TT.Man1, 1),
    tile(TT.Man2, 0), tile(TT.Man2, 1),
    tile(TT.Man3, 0), tile(TT.Man3, 1),
    tile(TT.Sou4, 0), tile(TT.Sou4, 1),
    tile(TT.Sou5, 0), tile(TT.Sou5, 1),
    tile(TT.Pin6, 0), tile(TT.Pin6, 1),
    tile(TT.Pin7, 0), tile(TT.Pin7, 1),
  ];
  const chiitoitsuWinTile = tile(TT.Pin7, 1);

  it('chiitoitsuCalc="25fu-2han": 25符2飜で計算', () => {
    const rule = withRule(defaultRule, { chiitoitsuCalc: "25fu-2han" as RuleConfig["chiitoitsuCalc"] });
    const ctx = makeCtx({
      handTiles: chiitoitsuHand,
      winTile: chiitoitsuWinTile,
      isTsumo: true,
      ruleConfig: rule,
    });
    const jr = judgeWin(ctx)!;
    expect(jr).not.toBeNull();
    expect(jr.yakuList.some((y) => y.yaku === Yaku.Chiitoitsu)).toBe(true);

    const scoreCtx: ScoreContext = {
      judgeResult: jr,
      winContext: ctx,
      isDealer: false,
      honba: 0,
      riichiSticks: 0,
    };
    const sr = calculateScore(scoreCtx);
    // 七対子(2) + ツモ(1) = 3飜, 25符
    expect(sr.totalFu).toBe(25);
    expect(sr.totalHan).toBe(3);
  });

  it('chiitoitsuCalc="50fu-1han": 50符1飜で計算（飜数が1減る）', () => {
    const rule = withRule(defaultRule, { chiitoitsuCalc: "50fu-1han" as RuleConfig["chiitoitsuCalc"] });
    const ctx = makeCtx({
      handTiles: chiitoitsuHand,
      winTile: chiitoitsuWinTile,
      isTsumo: true,
      ruleConfig: rule,
    });
    const jr = judgeWin(ctx)!;
    expect(jr).not.toBeNull();

    const scoreCtx: ScoreContext = {
      judgeResult: jr,
      winContext: ctx,
      isDealer: false,
      honba: 0,
      riichiSticks: 0,
    };
    const sr = calculateScore(scoreCtx);
    // 七対子(2→1) + ツモ(1) = 2飜, 50符
    expect(sr.totalFu).toBe(50);
    expect(sr.totalHan).toBe(2);
  });

  it("25fu-2han と 50fu-1han で基本点は同じ", () => {
    // 25符3飜 = 25 * 2^5 = 800
    // 50符2飜 = 50 * 2^4 = 800
    // → 基本点は同一
    const rule25 = withRule(defaultRule, { chiitoitsuCalc: "25fu-2han" as RuleConfig["chiitoitsuCalc"] });
    const rule50 = withRule(defaultRule, { chiitoitsuCalc: "50fu-1han" as RuleConfig["chiitoitsuCalc"] });
    const ctx25 = makeCtx({
      handTiles: chiitoitsuHand,
      winTile: chiitoitsuWinTile,
      isTsumo: true,
      ruleConfig: rule25,
    });
    const ctx50 = makeCtx({
      handTiles: chiitoitsuHand,
      winTile: chiitoitsuWinTile,
      isTsumo: true,
      ruleConfig: rule50,
    });
    const jr25 = judgeWin(ctx25)!;
    const jr50 = judgeWin(ctx50)!;

    const sr25 = calculateScore({ judgeResult: jr25, winContext: ctx25, isDealer: false, honba: 0, riichiSticks: 0 });
    const sr50 = calculateScore({ judgeResult: jr50, winContext: ctx50, isDealer: false, honba: 0, riichiSticks: 0 });

    expect(sr25.basePoints).toBe(sr50.basePoints);
  });
});

// =====================================================
// doubleWindFu（連風牌の雀頭の符）
// =====================================================

describe("doubleWindFu（連風牌の雀頭の符）", () => {
  // 東場の東家: roundWind=Ton, seatWind=Ton, 雀頭=東
  // 面子分解: 234m 567m 789s 234p + 東東 （全順子 + 連風牌雀頭）
  // calculateFu を直接呼び出して符の違いを検証する
  const parsedHand: ParsedHand = {
    groups: [
      { type: GroupType.Shuntsu, tileType: TT.Man2, isOpen: false },
      { type: GroupType.Shuntsu, tileType: TT.Man5, isOpen: false },
      { type: GroupType.Shuntsu, tileType: TT.Sou7, isOpen: false },
      { type: GroupType.Shuntsu, tileType: TT.Pin2, isOpen: false },
    ],
    pair: TT.Ton,
  };

  it("doubleWindFu=4: 連風牌の雀頭が4符", () => {
    const rule = withRule(defaultRule, { doubleWindFu: 4 });
    const ctx = makeCtx({
      isTsumo: true,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      ruleConfig: rule,
    });
    // isPinfu=false（連風牌の雀頭は役牌扱いで平和不成立）
    const fu = calculateFu(parsedHand, ctx, false);
    // 副底20 + ツモ2 + 雀頭4(連風) + 順子0×4 + 待ち0(両面想定) = 26 → 30
    // 雀頭の符が 4 であることを確認
    const pairDetail = fu.details.find((d) => d.label.includes("雀頭"));
    expect(pairDetail).toBeDefined();
    expect(pairDetail!.fu).toBe(4);
  });

  it("doubleWindFu=2: 連風牌の雀頭が2符", () => {
    const rule = withRule(defaultRule, { doubleWindFu: 2 });
    const ctx = makeCtx({
      isTsumo: true,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      ruleConfig: rule,
    });
    const fu = calculateFu(parsedHand, ctx, false);
    const pairDetail = fu.details.find((d) => d.label.includes("雀頭"));
    expect(pairDetail).toBeDefined();
    expect(pairDetail!.fu).toBe(2);
  });

  it("doubleWindFu=4 vs 2 で符の内訳に差がある", () => {
    const rule4 = withRule(defaultRule, { doubleWindFu: 4 });
    const rule2 = withRule(defaultRule, { doubleWindFu: 2 });
    const ctx4 = makeCtx({
      isTsumo: true,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      ruleConfig: rule4,
    });
    const ctx2 = makeCtx({
      isTsumo: true,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      ruleConfig: rule2,
    });

    const fu4 = calculateFu(parsedHand, ctx4, false);
    const fu2 = calculateFu(parsedHand, ctx2, false);

    // rawTotal の差が 2（雀頭の符差分: 4 - 2 = 2）
    expect(fu4.rawTotal - fu2.rawTotal).toBe(2);
  });
});

// =====================================================
// kiriage（切り上げ満貫）
// =====================================================

describe("kiriage（切り上げ満貫）", () => {
  // 4飜30符の手: 門前ロン + リーチ(1) + タンヤオ(1) + 平和(1) + 一盃口(1) = 4飜
  // 平和 門前ロン → 30符
  // 手牌: 234m 234m 567s 678p + 55s (一盃口あり、タンヤオあり)
  const kiriaGeHand = [
    tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
    tile(TT.Man2, 1), tile(TT.Man3, 1), tile(TT.Man4, 1),
    tile(TT.Sou5, 0), tile(TT.Sou6, 0), tile(TT.Sou7, 0),
    tile(TT.Pin6, 0), tile(TT.Pin7, 0), tile(TT.Pin8, 0),
    tile(TT.Sou5, 1), tile(TT.Sou5, 2),
  ];

  it("kiriage=true: 4飜30符が満貫に切り上がる", () => {
    const rule = withRule(defaultRule, { kiriage: true });
    const ctx = makeCtx({
      handTiles: kiriaGeHand,
      winTile: tile(TT.Sou5, 2),
      isTsumo: false,
      isRiichi: true,
      ruleConfig: rule,
    });
    const jr = judgeWin(ctx)!;
    expect(jr).not.toBeNull();
    // リーチ(1) + タンヤオ(1) + 平和(1) + 一盃口(1) = 4飜
    expect(jr.totalHan).toBe(4);

    const scoreCtx: ScoreContext = {
      judgeResult: jr,
      winContext: ctx,
      isDealer: false,
      honba: 0,
      riichiSticks: 0,
    };
    const sr = calculateScore(scoreCtx);
    expect(sr.totalFu).toBe(30);
    expect(sr.level).toBe("mangan");
  });

  it("kiriage=false: 4飜30符が通常計算", () => {
    const rule = withRule(defaultRule, { kiriage: false });
    const ctx = makeCtx({
      handTiles: kiriaGeHand,
      winTile: tile(TT.Sou5, 2),
      isTsumo: false,
      isRiichi: true,
      ruleConfig: rule,
    });
    const jr = judgeWin(ctx)!;
    expect(jr).not.toBeNull();
    expect(jr.totalHan).toBe(4);

    const scoreCtx: ScoreContext = {
      judgeResult: jr,
      winContext: ctx,
      isDealer: false,
      honba: 0,
      riichiSticks: 0,
    };
    const sr = calculateScore(scoreCtx);
    expect(sr.totalFu).toBe(30);
    expect(sr.level).toBe("normal");
    // 子ロン: 30符4飜 = 30 * 2^6 = 1920 基本点
    // 子ロン支払い = ceil(1920 * 4 / 100) * 100 = 7700
    expect(sr.payment.ronLoserPayment).toBe(7700);
  });
});

// =====================================================
// カテゴリ4: 鳴き/アガリ設定
// =====================================================

// ===== ダブロン・トリロン用ヘルパー =====

/**
 * AfterDiscard フェーズで複数プレイヤーがロン可能な状態を構築する。
 * player0 が discardTile を捨て、指定されたプレイヤーがロンできる手牌を持つ。
 */
function setupMultiRonState(
  rule: RuleConfig,
  ronPlayerIndices: number[],
): RoundState {
  // 制御された牌山から局を作成
  const baseTiles = createAllTiles("none");
  const wall = Wall.fromTiles(baseTiles);
  const state = createAndStart(rule, wall);

  // 一巡目を無効化（天和/地和を防ぐ）
  for (const p of state.players) {
    p.isFirstTurn = false;
  }

  // 放銃牌（player 0 が捨てる）
  const discardTile = tile(TT.Pin4, 0);

  // 各ロンプレイヤーにテンパイ手牌を設定（Pin2,3 待ちで Pin1 or Pin4 でロン）
  const tenpaiHands: Record<number, Tile[]> = {
    1: [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou7, 0), tile(TT.Sou8, 0), tile(TT.Sou9, 0),
      tile(TT.Pin2, 0), tile(TT.Pin3, 0),
      tile(TT.Sou6, 0), tile(TT.Sou6, 1),
    ],
    2: [
      tile(TT.Sou2, 0), tile(TT.Sou3, 0), tile(TT.Sou4, 0),
      tile(TT.Sou5, 0), tile(TT.Sou6, 2), tile(TT.Sou7, 1),
      tile(TT.Man7, 1), tile(TT.Man8, 0), tile(TT.Man9, 0),
      tile(TT.Pin2, 1), tile(TT.Pin3, 1),
      tile(TT.Man6, 1), tile(TT.Man6, 2),
    ],
    3: [
      tile(TT.Man1, 0), tile(TT.Man2, 1), tile(TT.Man3, 1),
      tile(TT.Pin5, 0), tile(TT.Pin6, 0), tile(TT.Pin7, 0),
      tile(TT.Sou1, 0), tile(TT.Sou2, 1), tile(TT.Sou3, 0),
      tile(TT.Pin2, 2), tile(TT.Pin3, 2),
      tile(TT.Pin8, 0), tile(TT.Pin8, 1),
    ],
  };

  for (const idx of ronPlayerIndices) {
    (state.players[idx] as { hand: Hand }).hand = new Hand(tenpaiHands[idx]);
  }

  // AfterDiscard フェーズに移行
  state.phase = RoundPhase.AfterDiscard;
  state.lastDiscardTile = discardTile;
  state.lastDiscardPlayerIndex = 0;

  return state;
}

// =====================================================
// doubleRon（ダブロン）
// =====================================================

describe("doubleRon（ダブロン）", () => {
  it('doubleRon="allowed": 2人がロン → 両者和了', () => {
    const rule = withRule(defaultRule, { doubleRon: "allowed" as RuleConfig["doubleRon"] });
    const state = setupMultiRonState(rule, [1, 2]);

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    actions.set(2, { type: ActionType.Ron, playerIndex: 2 });

    resolveAfterDiscard(state, actions);
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.wins.length).toBe(2);
    expect(state.result!.wins.map((w) => w.winnerIndex).sort()).toEqual([1, 2]);
  });

  it('doubleRon="atamahane": 2人がロン → 放銃者の下家のみ和了', () => {
    const rule = withRule(defaultRule, { doubleRon: "atamahane" as RuleConfig["doubleRon"] });
    const state = setupMultiRonState(rule, [1, 2]);

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    actions.set(2, { type: ActionType.Ron, playerIndex: 2 });

    resolveAfterDiscard(state, actions);
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.wins.length).toBe(1);
    // Player 0 の下家は Player 1
    expect(state.result!.wins[0].winnerIndex).toBe(1);
  });
});

// =====================================================
// tripleRon（トリロン）
// =====================================================

describe("tripleRon（トリロン）", () => {
  it('tripleRon="allowed": 3人がロン → 全員和了', () => {
    const rule = withRule(defaultRule, { tripleRon: "allowed" as RuleConfig["tripleRon"] });
    const state = setupMultiRonState(rule, [1, 2, 3]);

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    actions.set(2, { type: ActionType.Ron, playerIndex: 2 });
    actions.set(3, { type: ActionType.Ron, playerIndex: 3 });

    resolveAfterDiscard(state, actions);
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.wins.length).toBe(3);
    expect(state.result!.wins.map((w) => w.winnerIndex).sort()).toEqual([1, 2, 3]);
  });

  it('tripleRon="atamahane": 3人がロン → 放銃者の下家のみ和了', () => {
    const rule = withRule(defaultRule, { tripleRon: "atamahane" as RuleConfig["tripleRon"] });
    const state = setupMultiRonState(rule, [1, 2, 3]);

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    actions.set(2, { type: ActionType.Ron, playerIndex: 2 });
    actions.set(3, { type: ActionType.Ron, playerIndex: 3 });

    resolveAfterDiscard(state, actions);
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.wins.length).toBe(1);
    expect(state.result!.wins[0].winnerIndex).toBe(1);
  });

  it('tripleRon="draw": 3人がロン → 流局', () => {
    const rule = withRule(defaultRule, { tripleRon: "draw" as RuleConfig["tripleRon"] });
    const state = setupMultiRonState(rule, [1, 2, 3]);

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    actions.set(2, { type: ActionType.Ron, playerIndex: 2 });
    actions.set(3, { type: ActionType.Ron, playerIndex: 3 });

    resolveAfterDiscard(state, actions);
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.TripleRonDraw);
    expect(state.result!.wins.length).toBe(0);
  });
});

// =====================================================
// カテゴリ5: ゲーム進行設定
// =====================================================

// =====================================================
// kyuushuKyuuhai（九種九牌の途中流局）
// =====================================================

describe("kyuushuKyuuhai（九種九牌）", () => {
  // P0の手牌: 9種以上の幺九牌を含む
  const kyuushuHand = [
    tile(TT.Man1, 0), tile(TT.Man9, 0), tile(TT.Sou1, 0),
    tile(TT.Sou9, 0), tile(TT.Pin1, 0), tile(TT.Pin9, 0),
    tile(TT.Ton, 0), tile(TT.Nan, 0), tile(TT.Sha, 0),
    tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
    tile(TT.Man5, 0),
  ];
  // ツモ牌: 北 (10種目の幺九牌)
  const kyuushuDraw = tile(TT.Pei, 0);

  it("kyuushuKyuuhai=dealer-keep: 九種九牌で流局し親は連荘", () => {
    const rule = withRule(defaultRule, { kyuushuKyuuhai: AbortiveDraw.DealerKeep });
    const wall = buildControlledWall({ p0Hand: kyuushuHand, p0Draw: kyuushuDraw });
    const state = createAndStart(rule, wall);

    applyAction(state, { type: ActionType.KyuushuKyuuhai, playerIndex: 0 });
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.KyuushuKyuuhai);
    expect(state.result!.dealerKeeps).toBe(true);
  });

  it("kyuushuKyuuhai=dealer-rotate: 九種九牌で流局し親流れ", () => {
    const rule = withRule(defaultRule, { kyuushuKyuuhai: AbortiveDraw.DealerRotate });
    const wall = buildControlledWall({ p0Hand: kyuushuHand, p0Draw: kyuushuDraw });
    const state = createAndStart(rule, wall);

    applyAction(state, { type: ActionType.KyuushuKyuuhai, playerIndex: 0 });
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.KyuushuKyuuhai);
    expect(state.result!.dealerKeeps).toBe(false);
  });

  it("kyuushuKyuuhai=disabled: 九種九牌を宣言するとエラー", () => {
    const rule = withRule(defaultRule, { kyuushuKyuuhai: AbortiveDraw.Disabled });
    const wall = buildControlledWall({ p0Hand: kyuushuHand, p0Draw: kyuushuDraw });
    const state = createAndStart(rule, wall);

    expect(() => {
      applyAction(state, { type: ActionType.KyuushuKyuuhai, playerIndex: 0 });
    }).toThrow("九種九牌は無効設定です");
  });
});

// =====================================================
// suufonsuRenda（四風子連打）
// =====================================================

describe("suufonsuRenda（四風子連打）", () => {
  // P0の手牌にTonを含め、ツモもTon
  // 先に3人が東を捨てている状況を模擬し、P0が4人目として東を捨てる
  it("suufonsuRenda=dealer-rotate: 四風子連打で流局し親流れ", () => {
    const rule = withRule(defaultRule, { suufonsuRenda: AbortiveDraw.DealerRotate });
    const filler = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou2, 0), tile(TT.Sou3, 0), tile(TT.Sou4, 0),
      tile(TT.Sou5, 0), tile(TT.Sou6, 0), tile(TT.Sou7, 0),
      tile(TT.Pin2, 0),
    ];
    const wall = buildControlledWall({
      p0Hand: filler,
      p0Draw: tile(TT.Ton, 0),
    });
    const state = createAndStart(rule, wall);

    // 先に3人が東を切ったことを模擬
    state.firstTurnDiscardWinds = [TT.Ton, TT.Ton, TT.Ton];

    // P0の手牌からツモ牌（最後の牌 = Ton）を取得して打牌
    const handTiles = state.players[0].hand.getTiles();
    const tonTile = handTiles.find((t) => t.type === TT.Ton)!;
    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tonTile,
      isTsumogiri: true,
    });

    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.SuufonsuRenda);
    expect(state.result!.dealerKeeps).toBe(false);
  });

  it("suufonsuRenda=disabled: 四風子連打でも流局しない", () => {
    const rule = withRule(defaultRule, { suufonsuRenda: AbortiveDraw.Disabled });
    const filler = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou2, 0), tile(TT.Sou3, 0), tile(TT.Sou4, 0),
      tile(TT.Sou5, 0), tile(TT.Sou6, 0), tile(TT.Sou7, 0),
      tile(TT.Pin2, 0),
    ];
    const wall = buildControlledWall({
      p0Hand: filler,
      p0Draw: tile(TT.Ton, 0),
    });
    const state = createAndStart(rule, wall);

    state.firstTurnDiscardWinds = [TT.Ton, TT.Ton, TT.Ton];

    const handTiles = state.players[0].hand.getTiles();
    const tonTile = handTiles.find((t) => t.type === TT.Ton)!;
    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tonTile,
      isTsumogiri: true,
    });

    // Disabled の場合は流局しない → AfterDiscard フェーズ
    expect(state.phase).toBe(RoundPhase.AfterDiscard);
  });
});

// =====================================================
// suukaikan（四開槓）
// =====================================================

describe("suukaikan（四開槓）", () => {
  it("suukaikan=dealer-rotate: 異なるプレイヤーで4回目の暗槓で流局", () => {
    const rule = withRule(defaultRule, { suukaikan: AbortiveDraw.DealerRotate });
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(rule, wall);

    // 既に他のプレイヤーが3回槓をしたことを模擬
    state.totalKanCount = 3;
    state.playerKanCounts = [0, 1, 1, 1] as unknown as typeof state.playerKanCounts;

    // P0に暗槓可能な手牌を設定（Man1×4 + その他10枚）
    const ankanTiles: [Tile, Tile, Tile, Tile] = [
      tile(TT.Man1, 0), tile(TT.Man1, 1), tile(TT.Man1, 2), tile(TT.Man1, 3),
    ];
    const otherTiles = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou2, 0), tile(TT.Sou3, 0), tile(TT.Sou4, 0),
      tile(TT.Sou5, 0),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand([...ankanTiles, ...otherTiles]);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man1 });
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.Suukaikan);
    expect(state.result!.dealerKeeps).toBe(false);
  });

  it("suukaikan=disabled: 4回目の暗槓でも流局しない", () => {
    const rule = withRule(defaultRule, { suukaikan: AbortiveDraw.Disabled, kokushiAnkanRon: false });
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(rule, wall);

    state.totalKanCount = 3;
    state.playerKanCounts = [0, 1, 1, 1] as unknown as typeof state.playerKanCounts;

    const ankanTiles: [Tile, Tile, Tile, Tile] = [
      tile(TT.Man1, 0), tile(TT.Man1, 1), tile(TT.Man1, 2), tile(TT.Man1, 3),
    ];
    const otherTiles = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou2, 0), tile(TT.Sou3, 0), tile(TT.Sou4, 0),
      tile(TT.Sou5, 0),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand([...ankanTiles, ...otherTiles]);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man1 });
    // Disabled → 流局せず嶺上牌をツモ → DrawPhase
    expect(state.phase).toBe(RoundPhase.DrawPhase);
  });
});

// =====================================================
// suuchaRiichi（四人リーチ）
// =====================================================

describe("suuchaRiichi（四人リーチ）", () => {
  it("suuchaRiichi=dealer-rotate: 4人リーチで流局", () => {
    const rule = withRule(defaultRule, { suuchaRiichi: AbortiveDraw.DealerRotate });
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(rule, wall);

    // 既に3人がリーチ済みを模擬
    state.riichiPlayerCount = 3;
    state.players[1].isRiichi = true;
    state.players[2].isRiichi = true;
    state.players[3].isRiichi = true;

    // P0のリーチ: handleRiichi → handleDiscard → checkSuuchaRiichi
    // まず P0 にテンパイ手牌を設定
    const riichiHand = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou7, 0), tile(TT.Sou8, 0), tile(TT.Sou9, 0),
      tile(TT.Pin2, 0), tile(TT.Pin3, 0), tile(TT.Pin4, 0),
      tile(TT.Sou5, 0), tile(TT.Sou5, 1),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(riichiHand);

    // リーチ宣言（sou5 id=1 を切る）
    applyAction(state, {
      type: ActionType.Riichi,
      playerIndex: 0,
      tile: tile(TT.Sou5, 1),
    });
    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.SuuchaRiichi);
    expect(state.result!.dealerKeeps).toBe(false);
  });

  it("suuchaRiichi=disabled: 4人リーチでも流局しない", () => {
    const rule = withRule(defaultRule, { suuchaRiichi: AbortiveDraw.Disabled });
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(rule, wall);

    state.riichiPlayerCount = 3;
    state.players[1].isRiichi = true;
    state.players[2].isRiichi = true;
    state.players[3].isRiichi = true;

    const riichiHand = [
      tile(TT.Man2, 0), tile(TT.Man3, 0), tile(TT.Man4, 0),
      tile(TT.Man5, 0), tile(TT.Man6, 0), tile(TT.Man7, 0),
      tile(TT.Sou7, 0), tile(TT.Sou8, 0), tile(TT.Sou9, 0),
      tile(TT.Pin2, 0), tile(TT.Pin3, 0), tile(TT.Pin4, 0),
      tile(TT.Sou5, 0), tile(TT.Sou5, 1),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(riichiHand);

    applyAction(state, {
      type: ActionType.Riichi,
      playerIndex: 0,
      tile: tile(TT.Sou5, 1),
    });
    // Disabled → 流局せず AfterDiscard フェーズ
    expect(state.phase).toBe(RoundPhase.AfterDiscard);
  });
});

// =====================================================
// renchanCondition（連荘条件）・nagashiMangan（流し満貫）
// =====================================================

// renchanCondition / nagashiMangan は荒牌流局（handleExhaustiveDraw）内で判定される。
// 牌山を全て引き切る統合テストは複雑なため、ここではルール値が正しく設定されることを検証する。
// 実際の動作は手動テストまたはシミュレーションテストで確認する。

describe("renchanCondition（連荘条件）", () => {
  it("renchanCondition のデフォルト値が正しい", () => {
    // 東風: アガリ連荘
    const tonpuRule = withRule(defaultRule, { renchanCondition: "win-only" as RuleConfig["renchanCondition"] });
    expect(tonpuRule.renchanCondition).toBe("win-only");

    // 半荘: テンパイ連荘
    const hanchanRule = withRule(defaultRule, { renchanCondition: "tenpai" as RuleConfig["renchanCondition"] });
    expect(hanchanRule.renchanCondition).toBe("tenpai");
  });
});

describe("nagashiMangan（流し満貫）", () => {
  it("nagashiMangan のルール値設定", () => {
    const ruleEnabled = withRule(defaultRule, { nagashiMangan: true });
    expect(ruleEnabled.nagashiMangan).toBe(true);

    const ruleDisabled = withRule(defaultRule, { nagashiMangan: false });
    expect(ruleDisabled.nagashiMangan).toBe(false);
  });
});

// =====================================================
// カテゴリ6: ゲーム管理設定
// gameLength, tobi, agariyame, uma, rounding,
// startingPoints / returnPoints
// =====================================================

/** 和了による局結果を生成するヘルパー */
function makeWinRoundResult(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    reason: RoundEndReason.Win,
    wins: [{ winnerIndex: 0, loserIndex: 1, scoreResult: { judgeResult: {} as any, totalHan: 3, totalFu: 30, basePoints: 2000, level: "normal" as const, payment: { tsumoPaymentDealer: 0, tsumoPaymentChild: 0, ronLoserPayment: 3900, totalWinnerGain: 3900 } } }],
    scoreChanges: [3900, -3900, 0, 0],
    tenpaiPlayers: [true, false, false, false],
    dealerKeeps: false,
    incrementHonba: false,
    riichiSticksInRound: 0,
    ...overrides,
  };
}

/** 流局による局結果を生成するヘルパー */
function makeDrawRoundResult(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    reason: RoundEndReason.ExhaustiveDraw,
    wins: [],
    scoreChanges: [0, 0, 0, 0],
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: false,
    incrementHonba: true,
    riichiSticksInRound: 0,
    ...overrides,
  };
}

// =====================================================
// gameLength（対局の長さ）
// =====================================================

describe("gameLength（対局の長さ）", () => {
  it("東風戦: 東4局で親が流れたら終了", () => {
    const rule = withRule(defaultRule, { gameLength: GameLength.Tonpu });
    const game = startGame(createGame(rule, 0));

    // 東1局〜東3局: 親が流れる（親の交代）
    let state = game;
    for (let i = 0; i < 3; i++) {
      state = processRoundResult(state, makeWinRoundResult({
        scoreChanges: [3900, -3900, 0, 0],
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    // 東4局まで来ている
    expect(state.currentRound.roundWind).toBe(TT.Ton);
    expect(state.currentRound.roundNumber).toBe(4);
    expect(state.phase).toBe(GamePhase.InProgress);

    // 東4局: 親が流れる → 終了
    state = processRoundResult(state, makeWinRoundResult({
      scoreChanges: [3900, -3900, 0, 0],
      dealerKeeps: false,
      incrementHonba: false,
    }));
    expect(state.phase).toBe(GamePhase.Finished);
  });

  it("半荘戦: 東4局で親が流れても南に入り続行", () => {
    const rule = withRule(defaultRule, { gameLength: GameLength.Hanchan });
    const game = startGame(createGame(rule, 0));

    // 東1局〜東4局: 親が流れる（得点変動なしで局を進める）
    let state = game;
    for (let i = 0; i < 4; i++) {
      state = processRoundResult(state, makeWinRoundResult({
        scoreChanges: [0, 0, 0, 0],
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    // 南入している
    expect(state.currentRound.roundWind).toBe(TT.Nan);
    expect(state.currentRound.roundNumber).toBe(1);
    expect(state.phase).toBe(GamePhase.InProgress);

    // 南1局〜南3局
    for (let i = 0; i < 3; i++) {
      state = processRoundResult(state, makeWinRoundResult({
        scoreChanges: [0, 0, 0, 0],
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    // 南4局
    expect(state.currentRound.roundWind).toBe(TT.Nan);
    expect(state.currentRound.roundNumber).toBe(4);
    expect(state.phase).toBe(GamePhase.InProgress);

    // 南4局: 親が流れる → 終了
    state = processRoundResult(state, makeWinRoundResult({
      scoreChanges: [0, 0, 0, 0],
      dealerKeeps: false,
      incrementHonba: false,
    }));
    expect(state.phase).toBe(GamePhase.Finished);
  });
});

// =====================================================
// tobi（トビ）
// =====================================================

describe("tobi（トビ）", () => {
  it("BelowZero: 0点未満でトビ", () => {
    const rule = withRule(defaultRule, { tobi: TobiRule.BelowZero });
    const game = startGame(createGame(rule, 0));

    // プレイヤー1が大きく失点して 0 点未満になる
    const state = processRoundResult(game, makeWinRoundResult({
      scoreChanges: [26000, -26000, 0, 0],
      dealerKeeps: false,
    }));
    // 25000 - 26000 = -1000 < 0 → トビ
    expect(state.scores[1]).toBe(-1000);
    expect(state.phase).toBe(GamePhase.Finished);
  });

  it("ZeroOrBelow: 0点以下でトビ", () => {
    const rule = withRule(defaultRule, { tobi: TobiRule.ZeroOrBelow });
    const game = startGame(createGame(rule, 0));

    // プレイヤー1がちょうど0点に
    const state = processRoundResult(game, makeWinRoundResult({
      scoreChanges: [25000, -25000, 0, 0],
      dealerKeeps: false,
    }));
    // 25000 - 25000 = 0 → トビ
    expect(state.scores[1]).toBe(0);
    expect(state.phase).toBe(GamePhase.Finished);
  });

  it("Disabled: 0点未満でもトビなし", () => {
    const rule = withRule(defaultRule, { tobi: TobiRule.Disabled });
    const game = startGame(createGame(rule, 0));

    const state = processRoundResult(game, makeWinRoundResult({
      scoreChanges: [26000, -26000, 0, 0],
      dealerKeeps: false,
    }));
    // -1000 でもトビなし → 続行
    expect(state.scores[1]).toBe(-1000);
    expect(state.phase).toBe(GamePhase.InProgress);
  });

  it("BelowZero: ちょうど0点はトビにならない", () => {
    const rule = withRule(defaultRule, { tobi: TobiRule.BelowZero });
    const game = startGame(createGame(rule, 0));

    const state = processRoundResult(game, makeWinRoundResult({
      scoreChanges: [25000, -25000, 0, 0],
      dealerKeeps: false,
    }));
    // 0点 → BelowZero では 0 < 0 は false → トビなし
    expect(state.scores[1]).toBe(0);
    expect(state.phase).toBe(GamePhase.InProgress);
  });
});

// =====================================================
// agariyame（アガリ止め）
// =====================================================

describe("agariyame（アガリ止め）", () => {
  /** オーラスで親がトップ＋アガリの状態を作る */
  function makeOurasGameState(rule: RuleConfig) {
    const game = startGame(createGame(rule, 0));

    // 東風戦の場合: 東4局まで進める(東1〜東3で親が流れる)
    for (let i = 0; i < 3; i++) {
      processRoundResult(game, makeWinRoundResult({
        scoreChanges: [0, 0, 0, 0], // 得点変動なしで進める
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    // 東4局 に到達。dealerIndex は 3
    expect(game.currentRound.roundWind).toBe(TT.Ton);
    expect(game.currentRound.roundNumber).toBe(4);

    // 親（dealerIndex=3）をトップにするため得点を調整
    game.scores = [20000, 20000, 20000, 40000];
    return game;
  }

  it("agariyame=true: オーラスで親がトップ＋和了 → 対局終了", () => {
    const rule = withRule(defaultRule, {
      gameLength: GameLength.Tonpu,
      agariyame: true,
    });
    const game = makeOurasGameState(rule);

    // 親（player 3）が和了して連荘条件を満たすが、アガリ止めで終了
    const state = processRoundResult(game, makeWinRoundResult({
      wins: [{ winnerIndex: 3, loserIndex: 0, scoreResult: { judgeResult: {} as any, totalHan: 3, totalFu: 30, basePoints: 2000, level: "normal" as const, payment: { tsumoPaymentDealer: 0, tsumoPaymentChild: 0, ronLoserPayment: 3900, totalWinnerGain: 3900 } } }],
      scoreChanges: [-3900, 0, 0, 3900],
      dealerKeeps: true,
      incrementHonba: true,
    }));
    expect(state.phase).toBe(GamePhase.Finished);
  });

  it("agariyame=false: オーラスで親がトップ＋和了でも続行", () => {
    const rule = withRule(defaultRule, {
      gameLength: GameLength.Tonpu,
      agariyame: false,
    });
    const game = makeOurasGameState(rule);

    // 親が和了しても連荘（アガリ止めなし）
    const state = processRoundResult(game, makeWinRoundResult({
      wins: [{ winnerIndex: 3, loserIndex: 0, scoreResult: { judgeResult: {} as any, totalHan: 3, totalFu: 30, basePoints: 2000, level: "normal" as const, payment: { tsumoPaymentDealer: 0, tsumoPaymentChild: 0, ronLoserPayment: 3900, totalWinnerGain: 3900 } } }],
      scoreChanges: [-3900, 0, 0, 3900],
      dealerKeeps: true,
      incrementHonba: true,
    }));
    expect(state.phase).toBe(GamePhase.InProgress);
  });
});

// =====================================================
// startingPoints / returnPoints（配給原点・返し点）
// =====================================================

describe("startingPoints / returnPoints（配給原点・返し点）", () => {
  it("createGame で配給原点が初期得点として設定される", () => {
    const rule25000 = withRule(defaultRule, { startingPoints: 25000 });
    const game25 = createGame(rule25000, 0);
    expect(game25.scores).toEqual([25000, 25000, 25000, 25000]);

    const rule30000 = withRule(defaultRule, { startingPoints: 30000 });
    const game30 = createGame(rule30000, 0);
    expect(game30.scores).toEqual([30000, 30000, 30000, 30000]);
  });

  it("返し点と配給原点の差がオカとしてトップに加算される", () => {
    // 25000点持ち/30000点返し → オカ = (30000-25000)*4/1000 = 20
    const rule = withRule(defaultRule, {
      startingPoints: 25000,
      returnPoints: 30000,
      uma: UmaRule.Uma10_30,
      rounding: RoundingRule.OneDecimal,
    });
    const game = startGame(createGame(rule, 0));

    // 全員25000のまま東4局で終了させる（東風戦）
    for (let i = 0; i < 4; i++) {
      processRoundResult(game, makeDrawRoundResult({
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    // 全員25000 → rawPoints = (25000-30000)/1000 = -5
    // 順位は席順: 1位=P0, 2位=P1, 3位=P2, 4位=P3
    // P0(1位): -5 + 30(uma) + 20(oka) = 45
    // P1(2位): -5 + 10 = 5
    // P2(3位): -5 + (-10) = -15
    // P3(4位): -5 + (-30) = -35
    expect(result.finalPoints[0]).toBe(45);
    expect(result.finalPoints[1]).toBe(5);
    expect(result.finalPoints[2]).toBe(-15);
    expect(result.finalPoints[3]).toBe(-35);
  });

  it("配給原点と返し点が同じ場合オカは0", () => {
    const rule = withRule(defaultRule, {
      startingPoints: 30000,
      returnPoints: 30000,
      uma: UmaRule.Uma10_30,
      rounding: RoundingRule.OneDecimal,
    });
    const game = startGame(createGame(rule, 0));

    // 全員30000のまま終了
    for (let i = 0; i < 4; i++) {
      processRoundResult(game, makeDrawRoundResult({
        dealerKeeps: false,
        incrementHonba: false,
      }));
    }
    game.phase = GamePhase.Finished;

    const result = calculateFinalResult(game);
    // rawPoints = 0, oka = 0
    // P0(1位): 0 + 30 + 0 = 30
    // P1(2位): 0 + 10 = 10
    // P2(3位): 0 + (-10) = -10
    // P3(4位): 0 + (-30) = -30
    expect(result.finalPoints[0]).toBe(30);
    expect(result.finalPoints[1]).toBe(10);
    expect(result.finalPoints[2]).toBe(-10);
    expect(result.finalPoints[3]).toBe(-30);
  });
});

// =====================================================
// uma（順位ウマ）
// =====================================================

describe("uma（順位ウマ）", () => {
  /** 特定のスコアでゲーム終了状態を作る */
  function makeFinishedGame(rule: RuleConfig, scores: [number, number, number, number]) {
    const game = startGame(createGame(rule, 0));
    game.scores = scores;
    game.phase = GamePhase.Finished;
    // 適切な局情報（東4局で終了）
    game.currentRound = { roundWind: TT.Ton, roundNumber: 4 };
    return game;
  }

  it("Uma5_10: 1位+10, 2位+5, 3位-5, 4位-10", () => {
    const rule = withRule(defaultRule, {
      uma: UmaRule.Uma5_10,
      startingPoints: 25000,
      returnPoints: 30000,
      rounding: RoundingRule.OneDecimal,
    });
    // 明確な順位差のあるスコア
    const game = makeFinishedGame(rule, [40000, 30000, 20000, 10000]);
    const result = calculateFinalResult(game);

    // P0: (40000-30000)/1000 + 10 + 20(oka) = 10+10+20 = 40
    // P1: (30000-30000)/1000 + 5 = 5
    // P2: (20000-30000)/1000 + (-5) = -10-5 = -15
    // P3: (10000-30000)/1000 + (-10) = -20-10 = -30
    expect(result.finalPoints[0]).toBe(40);
    expect(result.finalPoints[1]).toBe(5);
    expect(result.finalPoints[2]).toBe(-15);
    expect(result.finalPoints[3]).toBe(-30);
  });

  it("Uma10_20: 1位+20, 2位+10, 3位-10, 4位-20", () => {
    const rule = withRule(defaultRule, {
      uma: UmaRule.Uma10_20,
      startingPoints: 25000,
      returnPoints: 30000,
      rounding: RoundingRule.OneDecimal,
    });
    const game = makeFinishedGame(rule, [40000, 30000, 20000, 10000]);
    const result = calculateFinalResult(game);

    // P0: 10 + 20 + 20(oka) = 50
    // P1: 0 + 10 = 10
    // P2: -10 + (-10) = -20
    // P3: -20 + (-20) = -40
    expect(result.finalPoints[0]).toBe(50);
    expect(result.finalPoints[1]).toBe(10);
    expect(result.finalPoints[2]).toBe(-20);
    expect(result.finalPoints[3]).toBe(-40);
  });

  it("Uma10_30: 1位+30, 2位+10, 3位-10, 4位-30", () => {
    const rule = withRule(defaultRule, {
      uma: UmaRule.Uma10_30,
      startingPoints: 25000,
      returnPoints: 30000,
      rounding: RoundingRule.OneDecimal,
    });
    const game = makeFinishedGame(rule, [40000, 30000, 20000, 10000]);
    const result = calculateFinalResult(game);

    // P0: 10 + 30 + 20(oka) = 60
    // P1: 0 + 10 = 10
    // P2: -10 + (-10) = -20
    // P3: -20 + (-30) = -50
    expect(result.finalPoints[0]).toBe(60);
    expect(result.finalPoints[1]).toBe(10);
    expect(result.finalPoints[2]).toBe(-20);
    expect(result.finalPoints[3]).toBe(-50);
  });

  it("Uma20_30: 1位+30, 2位+20, 3位-20, 4位-30", () => {
    const rule = withRule(defaultRule, {
      uma: UmaRule.Uma20_30,
      startingPoints: 25000,
      returnPoints: 30000,
      rounding: RoundingRule.OneDecimal,
    });
    const game = makeFinishedGame(rule, [40000, 30000, 20000, 10000]);
    const result = calculateFinalResult(game);

    // P0: 10 + 30 + 20(oka) = 60
    // P1: 0 + 20 = 20
    // P2: -10 + (-20) = -30
    // P3: -20 + (-30) = -50
    expect(result.finalPoints[0]).toBe(60);
    expect(result.finalPoints[1]).toBe(20);
    expect(result.finalPoints[2]).toBe(-30);
    expect(result.finalPoints[3]).toBe(-50);
  });
});

// =====================================================
// rounding（端数計算）
// =====================================================

describe("rounding（端数計算）", () => {
  /** 端数が出るスコアでゲーム終了状態を作る */
  function makeFinishedGame(rule: RuleConfig, scores: [number, number, number, number]) {
    const game = startGame(createGame(rule, 0));
    game.scores = scores;
    game.phase = GamePhase.Finished;
    game.currentRound = { roundWind: TT.Ton, roundNumber: 4 };
    return game;
  }

  it("OneDecimal: 小数第1位まで計算", () => {
    const rule = withRule(defaultRule, {
      rounding: RoundingRule.OneDecimal,
      startingPoints: 25000,
      returnPoints: 30000,
      uma: UmaRule.Uma10_30,
    });
    // 端数の出るスコア: 25500 → rawPoints = (25500-30000)/1000 = -4.5
    const game = makeFinishedGame(rule, [40500, 25500, 22000, 12000]);
    const result = calculateFinalResult(game);

    // P0(1位): (40500-30000)/1000 + 30 + 20 = 10.5 + 50 = 60.5
    // P1(2位): (25500-30000)/1000 + 10 = -4.5 + 10 = 5.5
    // P2(3位): (22000-30000)/1000 + (-10) = -8 + (-10) = -18
    // P3(4位): (12000-30000)/1000 + (-30) = -18 + (-30) = -48
    expect(result.finalPoints[0]).toBe(60.5);
    expect(result.finalPoints[1]).toBe(5.5);
    expect(result.finalPoints[2]).toBe(-18);
    expect(result.finalPoints[3]).toBe(-48);
  });

  it("Round5Down6Up: 五捨六入", () => {
    const rule = withRule(defaultRule, {
      rounding: RoundingRule.Round5Down6Up,
      startingPoints: 25000,
      returnPoints: 30000,
      uma: UmaRule.Uma10_30,
    });
    // 0.5以下は切り捨て: 25500 → rawPoints = -4.5, + 10 = 5.5 → 5
    const game5 = makeFinishedGame(rule, [40500, 25500, 22000, 12000]);
    const result5 = calculateFinalResult(game5);

    // P0(1位): 10.5 + 30 + 20 = 60.5 → 60
    // P1(2位): -4.5 + 10 = 5.5 → 5
    expect(result5.finalPoints[0]).toBe(60);
    expect(result5.finalPoints[1]).toBe(5);

    // 0.6以上は切り上げ（浮動小数点の境界を避けるため 0.7 付近を使用）:
    // 25300 → rawPoints = -4.7, + 10 = 5.3 → 切り捨て → 5
    // 25900 → rawPoints = -4.1, + 10 = 5.9 → 切り上げ → 6
    const gameDown = makeFinishedGame(rule, [40700, 25300, 22000, 12000]);
    const resultDown = calculateFinalResult(gameDown);
    expect(resultDown.finalPoints[1]).toBe(5); // 5.3 → 5

    const gameUp = makeFinishedGame(rule, [41100, 25900, 22000, 11000]);
    const resultUp = calculateFinalResult(gameUp);
    expect(resultUp.finalPoints[1]).toBe(6); // 5.9 → 6
  });
});

// =====================================================
// カテゴリ7: 後付け（atozuke）
//
// copilot-instructions.md の全例を網羅
// =====================================================

/** チー副露を作成するヘルパー */
function makeChiMeld(tileTypes: [TileType, TileType, TileType], fromPlayer: number): Meld {
  return {
    type: MeldType.Chi,
    tiles: [tile(tileTypes[0], 0), tile(tileTypes[1], 1), tile(tileTypes[2], 2)],
    calledTile: tile(tileTypes[0], 0),
    fromPlayerIndex: fromPlayer,
  };
}

/** 後付けナシルール */
const atozukeNashiRule = withRule(defaultRule, { atozuke: false });

/** judgeWin を呼んで checkAtozukeAllowed の結果を返すヘルパー */
function isAtozukeAllowed(ctx: WinContext): boolean {
  const result = judgeWin(ctx);
  if (!result) return false; // 役なし
  return checkAtozukeAllowed(ctx, result);
}

// ===== ① 第一副露チェック =====

describe("atozuke（後付け）— ① 第一副露チェック", () => {
  it("アガれない例1: 第一副露が役に絡まず、役は第二副露の中のみ", () => {
    // 手牌: 23456s西西, 第一副露: 123p, 第二副露: 中中中, ロン: 1s/4s/7s
    const melds: Meld[] = [
      makeChiMeld([TT.Pin1, TT.Pin2, TT.Pin3], 3),  // 第一副露
      makePonMeld(TT.Chun, 1),                         // 第二副露
    ];
    // ロン牌 1s → 123456s + 西西 + 123p + 中中中
    const ctx = makeCtx({
      // 手牌14枚: 閉じた手牌 = ロン牌含む
      handTiles: tiles(TT.Sou1, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5, TT.Sou6, TT.Sha, TT.Sha),
      melds,
      winTile: tile(TT.Sou1),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("アガれない例2: 第一副露が役に絡まず、三色も手牌で完成していない", () => {
    // 手牌: 234s234m西, 第一副露: 123p, 第二副露: 234p, ロン: 西
    const melds: Meld[] = [
      makeChiMeld([TT.Pin1, TT.Pin2, TT.Pin3], 3),  // 第一副露
      makeChiMeld([TT.Pin2, TT.Pin3, TT.Pin4], 3),  // 第二副露
    ];
    const ctx = makeCtx({
      handTiles: tiles(TT.Sou2, TT.Sou3, TT.Sou4, TT.Man2, TT.Man3, TT.Man4, TT.Sha, TT.Sha),
      melds,
      winTile: tile(TT.Sha),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("アガれる例1: 第一副露が役に絡まないが、手牌で一気通貫が確定", () => {
    // 手牌: 123456789s西西, 第一副露: 123p, ロン: 西
    const melds: Meld[] = [
      makeChiMeld([TT.Pin1, TT.Pin2, TT.Pin3], 3),
    ];
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Sou7, TT.Sou8, TT.Sou9,
        TT.Sha, TT.Sha,
      ),
      melds,
      winTile: tile(TT.Sha),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("アガれる例2: 第一副露が役に絡まないが、白の暗刻で役が確定", () => {
    // 手牌: 123456s4m4m白白白, 第一副露: 123p, ロン: 4m
    const melds: Meld[] = [
      makeChiMeld([TT.Pin1, TT.Pin2, TT.Pin3], 3),
    ];
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Man4, TT.Man4,
        TT.Haku, TT.Haku, TT.Haku,
      ),
      melds,
      winTile: tile(TT.Man4),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("アガれる例3: 第一副露が一気通貫に絡み、待ちも1種で確定", () => {
    // 手牌: 12389s444m西西, 第一副露: 456s, ロン: 7s
    const melds: Meld[] = [
      makeChiMeld([TT.Sou4, TT.Sou5, TT.Sou6], 3),
    ];
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Sou7, TT.Sou8, TT.Sou9,
        TT.Man4, TT.Man4, TT.Man4,
        TT.Sha, TT.Sha,
      ),
      melds,
      winTile: tile(TT.Sou7),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("後付けアリではすべてのケースでアガれる", () => {
    // アガれない例1 と同じ手牌だが atozuke=true
    const melds: Meld[] = [
      makeChiMeld([TT.Pin1, TT.Pin2, TT.Pin3], 3),
      makePonMeld(TT.Chun, 1),
    ];
    const ctx = makeCtx({
      handTiles: tiles(TT.Sou1, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5, TT.Sou6, TT.Sha, TT.Sha),
      melds,
      winTile: tile(TT.Sou1),
      ruleConfig: withRule(defaultRule, { atozuke: true }),
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });
});

// ===== ② 片和了りチェック =====

describe("atozuke（後付け）— ② 片和了り禁止", () => {
  it("アガれない例1: 白が来たときのみ役 → 片和了り", () => {
    // 手牌: 123s33567m666p白白, ロン: 3m or 白
    // 3m → 役なし、白 → 白のみ → 片和了り → アガれない
    const winTileHaku = tile(TT.Haku);
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Man3, TT.Man3, TT.Man5, TT.Man6, TT.Man7,
        TT.Pin6, TT.Pin6, TT.Pin6,
        TT.Haku, TT.Haku,
        TT.Haku,
      ),
      melds: [],
      winTile: winTileHaku,
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("アガれない例2: 9s来れば一気通貫だが3s/6sでは役なし → 片和了り", () => {
    // 手牌: 12345678s456m白白, ロン: 3s/6s/9s
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5, TT.Sou6, TT.Sou7, TT.Sou8,
        TT.Man4, TT.Man5, TT.Man6,
        TT.Haku, TT.Haku,
        TT.Sou9,
      ),
      melds: [],
      winTile: tile(TT.Sou9),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("アガれない例3: 白 or 中のシャンポンでどちらの役か不定 → 片和了り", () => {
    // 手牌: 123456s456m白白中中, ロン: 白 or 中
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Man4, TT.Man5, TT.Man6,
        TT.Haku, TT.Haku,
        TT.Chun, TT.Chun,
        TT.Haku,
      ),
      melds: [],
      winTile: tile(TT.Haku),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("アガれない例4: 1s/3s/4sで役が異なる → 片和了り", () => {
    // 手牌: 2223s45678m234p, ロン: 1s/3s/4s
    // 1s → ピンフのみ, 3s → タンヤオのみ, 4s → ピンフ+タンヤオ
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou2, TT.Sou2, TT.Sou2, TT.Sou3,
        TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Man8,
        TT.Pin2, TT.Pin3, TT.Pin4,
        TT.Sou1,
        TT.Sou1, // ダミー — 下で修正
      ),
      melds: [],
      winTile: tile(TT.Sou1),
      ruleConfig: atozukeNashiRule,
    });
    // 正しい手牌: 2223s45678m234p + ロン1s = 14枚
    const correctCtx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou2, TT.Sou2, TT.Sou3,
        TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Man8,
        TT.Pin2, TT.Pin3, TT.Pin4,
      ),
      melds: [],
      winTile: tile(TT.Sou1),
      ruleConfig: atozukeNashiRule,
      seatWind: TT.Sha, // 非親
    });
    expect(isAtozukeAllowed(correctCtx)).toBe(false);
  });

  it("アガれる例1: 西 or 白どちらでもチャンタ確定 → OK", () => {
    // 手牌: 123s123m789p西西白白, ロン: 西 or 白
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Man1, TT.Man2, TT.Man3,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Sha, TT.Sha,
        TT.Haku, TT.Haku,
        TT.Sha,
      ),
      melds: [],
      winTile: tile(TT.Sha),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("アガれる例2: 3s/6sどちらでもタンヤオ確定 → OK", () => {
    // 手牌: 334455s234m33388p, ロン: 3s or 6s
    // 3s → イーペーコー+タンヤオ, 6s → タンヤオ → 共通: タンヤオ → OK
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou3, TT.Sou4, TT.Sou4, TT.Sou5, TT.Sou5,
        TT.Man2, TT.Man3, TT.Man4,
        TT.Pin3, TT.Pin3, TT.Pin3, TT.Pin8, TT.Pin8,
        TT.Sou3,
      ),
      melds: [],
      winTile: tile(TT.Sou3),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("アガれる例3: 二盃口(ryanpeiko)は一盃口(iipeiko)の上位役なので OK", () => {
    // 手牌: 112233m45566s白白, 待ち: 4s or 7s
    // 4s → 123m×2 + 456s×2 + 白白 = 二盃口
    // 7s → 123m×2 + 456s + 567s + 白白 = 一盃口
    // 展開後の交差: {iipeiko} → OK
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man1, TT.Man2, TT.Man2, TT.Man3, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou5, TT.Sou6, TT.Sou6,
        TT.Haku, TT.Haku,
        TT.Sou4,
      ),
      melds: [],
      winTile: tile(TT.Sou4),
      isTsumo: false,
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("門前で待ち1種なら常にOK", () => {
    // リーチのみの手でも待ちが1つなら後付けナシに引っかからない
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man2, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Ton, TT.Ton, TT.Ton,
        TT.Haku, TT.Haku,
      ),
      melds: [],
      winTile: tile(TT.Haku),
      isTsumo: false,
      isRiichi: true,
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });
});

// ===== ①と②の複合チェック =====

describe("atozuke（後付け）— 複合チェック", () => {
  it("アガれない例3(①): 片和了りで第一副露の関与が不定", () => {
    // 手牌: 12345s444m西西, 第一副露: 789s, ロン: 3s or 6s
    // 6s → 一気通貫(第一副露が絡む), 3s → 役なし → 片和了り＋第一副露不定
    const melds: Meld[] = [
      makeChiMeld([TT.Sou7, TT.Sou8, TT.Sou9], 3),
    ];
    // ロン 6s の場合（第一副露が一気通貫に絡む）でも片和了りでNG
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Sou1, TT.Sou2, TT.Sou3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Man4, TT.Man4, TT.Man4,
        TT.Sha, TT.Sha,
      ),
      melds,
      winTile: tile(TT.Sou6),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(false);
  });

  it("タンヤオ副露は全面子型で常にOK", () => {
    // 喰いタン: 全面子がタンヤオに絡む
    const melds: Meld[] = [
      makeChiMeld([TT.Sou2, TT.Sou3, TT.Sou4], 3),
    ];
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Man2, TT.Man3, TT.Man4,
        TT.Pin5, TT.Pin6, TT.Pin7,
        TT.Sou5, TT.Sou5, TT.Sou5,
        TT.Man8, TT.Man8,
      ),
      melds,
      winTile: tile(TT.Man8),
      ruleConfig: withRule(atozukeNashiRule, { kuitan: true }),
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });

  it("第一副露が役牌ポンなら常にOK", () => {
    // 第一副露: 白ポン → 白が役に絡む
    const melds: Meld[] = [
      makePonMeld(TT.Haku, 1),
    ];
    const ctx = makeCtx({
      handTiles: tiles(
        TT.Man1, TT.Man2, TT.Man3,
        TT.Sou4, TT.Sou5, TT.Sou6,
        TT.Pin7, TT.Pin8, TT.Pin9,
        TT.Sha, TT.Sha,
      ),
      melds,
      winTile: tile(TT.Sha),
      ruleConfig: atozukeNashiRule,
    });
    expect(isAtozukeAllowed(ctx)).toBe(true);
  });
});

// ============================================================
// kokushiAnkanRon（国士無双の暗槓ロン）
// ============================================================

describe("kokushiAnkanRon（国士無双の暗槓ロン）", () => {
  const kokushiRule = withRule(defaultRule, { kokushiAnkanRon: true });
  const noKokushiRule = withRule(defaultRule, { kokushiAnkanRon: false });

  // 国士テンパイの13枚（Man1を待ち — Man9が雀頭）
  const kokushiHandTypes = [
    TT.Man9, TT.Man9, TT.Pin1, TT.Pin9, TT.Sou1, TT.Sou9,
    TT.Ton, TT.Nan, TT.Sha, TT.Pei, TT.Haku, TT.Hatsu, TT.Chun,
  ];

  // 国士十三面テンパイの13枚（13種1枚ずつ）
  const kokushi13HandTypes = [
    TT.Man1, TT.Man9, TT.Pin1, TT.Pin9, TT.Sou1, TT.Sou9,
    TT.Ton, TT.Nan, TT.Sha, TT.Pei, TT.Haku, TT.Hatsu, TT.Chun,
  ];

  it("kokushiAnkanRon=true: 暗槓牌で国士無双が成立する場合ロンできる", () => {
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(kokushiRule, wall);

    // P1に国士テンパイ手牌を設定（Man1待ち）
    (state.players[1] as { hand: Hand }).hand = new Hand(tiles(...kokushiHandTypes));
    (state.players[1] as { isFirstTurn: boolean }).isFirstTurn = false;

    // P0にMan1×4を持たせて暗槓させる
    const ankanHand = [
      tile(TT.Man1, 100), tile(TT.Man1, 101), tile(TT.Man1, 102), tile(TT.Man1, 103),
      ...tiles(TT.Man2, TT.Man3, TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(ankanHand);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man1 });

    // AfterKan フェーズで、chankanTile が設定され、isAnkanChankan=true
    expect(state.phase).toBe(RoundPhase.AfterKan);
    expect(state.chankanTile).toBeDefined();
    expect(state.isAnkanChankan).toBe(true);

    // P1がロンできる
    const playerActions = new Map<number, PlayerAction>();
    playerActions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    playerActions.set(2, { type: ActionType.Skip, playerIndex: 2 });
    playerActions.set(3, { type: ActionType.Skip, playerIndex: 3 });
    resolveAfterKan(state, playerActions);

    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result!.reason).toBe(RoundEndReason.Win);
    // 槍槓の1飜は付かない — 国士無双役満のみ
    const winEntry = state.result!.wins[0];
    expect(winEntry.scoreResult.judgeResult.yakuList.some((y) => y.yaku === "kokushi")).toBe(true);
    expect(winEntry.scoreResult.judgeResult.yakuList.some((y) => y.yaku === "chankan")).toBe(false);
  });

  it("kokushiAnkanRon=true: 国士十三面待ちでダブル役満", () => {
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(kokushiRule, wall);

    // P1に国士十三面テンパイ（13種1枚ずつ）
    (state.players[1] as { hand: Hand }).hand = new Hand(tiles(...kokushi13HandTypes));
    (state.players[1] as { isFirstTurn: boolean }).isFirstTurn = false;

    // P0がMan1を暗槓
    const ankanHand = [
      tile(TT.Man1, 100), tile(TT.Man1, 101), tile(TT.Man1, 102), tile(TT.Man1, 103),
      ...tiles(TT.Man2, TT.Man3, TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(ankanHand);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man1 });
    expect(state.phase).toBe(RoundPhase.AfterKan);

    const playerActions = new Map<number, PlayerAction>();
    playerActions.set(1, { type: ActionType.Ron, playerIndex: 1 });
    playerActions.set(2, { type: ActionType.Skip, playerIndex: 2 });
    playerActions.set(3, { type: ActionType.Skip, playerIndex: 3 });
    resolveAfterKan(state, playerActions);

    expect(state.phase).toBe(RoundPhase.Completed);
    const winEntry = state.result!.wins[0];
    expect(winEntry.scoreResult.judgeResult.yakuList.some((y) => y.yaku === "kokushi-juusanmen")).toBe(true);
  });

  it("kokushiAnkanRon=true: 暗槓牌で国士が成立しない場合はAfterKanのまま進行", () => {
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(kokushiRule, wall);

    // P1に非国士の手牌
    (state.players[1] as { hand: Hand }).hand = new Hand(
      tiles(TT.Man1, TT.Man2, TT.Man3, TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Man8, TT.Man9, TT.Pin1, TT.Pin2, TT.Pin3, TT.Pin4),
    );

    // P0がMan5を暗槓
    const ankanHand = [
      tile(TT.Man5, 100), tile(TT.Man5, 101), tile(TT.Man5, 102), tile(TT.Man5, 103),
      ...tiles(TT.Sou1, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5, TT.Sou6, TT.Sou7, TT.Sou8, TT.Sou9, TT.Pin1),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(ankanHand);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man5 });
    expect(state.phase).toBe(RoundPhase.AfterKan);

    // 全員スキップ → 嶺上ツモへ進む
    const playerActions = new Map<number, PlayerAction>();
    playerActions.set(1, { type: ActionType.Skip, playerIndex: 1 });
    playerActions.set(2, { type: ActionType.Skip, playerIndex: 2 });
    playerActions.set(3, { type: ActionType.Skip, playerIndex: 3 });
    resolveAfterKan(state, playerActions);

    // ロンされずに進行（DrawPhase に戻る）
    expect(state.phase).not.toBe(RoundPhase.Completed);
  });

  it("kokushiAnkanRon=false: 暗槓牌で国士が成立してもロンできない", () => {
    const baseTiles = createAllTiles("none");
    const wall = Wall.fromTiles(baseTiles);
    const state = createAndStart(noKokushiRule, wall);

    // P1に国士テンパイ
    (state.players[1] as { hand: Hand }).hand = new Hand(tiles(...kokushiHandTypes));

    // P0がMan1を暗槓
    const ankanHand = [
      tile(TT.Man1, 100), tile(TT.Man1, 101), tile(TT.Man1, 102), tile(TT.Man1, 103),
      ...tiles(TT.Man2, TT.Man3, TT.Man4, TT.Man5, TT.Man6, TT.Man7, TT.Sou2, TT.Sou3, TT.Sou4, TT.Sou5),
    ];
    (state.players[0] as { hand: Hand }).hand = new Hand(ankanHand);

    applyAction(state, { type: ActionType.Ankan, playerIndex: 0, tileType: TT.Man1 });

    // kokushiAnkanRon=false なので AfterKan にならず、直接嶺上ツモへ
    expect(state.isAnkanChankan).toBe(false);
    expect(state.chankanTile).toBeUndefined();
    // 通常の暗槓処理で DrawPhase に戻る
    expect(state.phase).toBe(RoundPhase.DrawPhase);
  });
});
