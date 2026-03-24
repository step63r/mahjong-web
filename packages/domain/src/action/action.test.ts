import { describe, it, expect } from "vitest";
import { TileType as TT, type Tile } from "../tile/index.js";
import { Hand } from "../hand/index.js";
import { createDefaultRuleConfig } from "../rule/index.js";
import { ActionType } from "./types.js";
import { getActionsAfterDraw, getActionsAfterDiscard } from "./action.js";

// ===== ヘルパー =====

function tile(type: TT, id = 0, isRedDora = false): Tile {
  return { type, id, isRedDora };
}

const defaultRule = createDefaultRuleConfig();

// ===== getActionsAfterDraw =====

describe("getActionsAfterDraw", () => {
  it("打牌は常に含まれる", () => {
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Ton, 1),
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Ton, 1),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: true,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: false,
    });

    const discardActions = actions.filter((a) => a.type === ActionType.Discard);
    expect(discardActions.length).toBeGreaterThan(0);
  });

  it("リーチ中はツモ切りのみ", () => {
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Man8, 0),
      tile(TT.Man9, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin5, 0), // ツモ牌
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Pin5, 0),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: false,
      isRiichi: true,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: false,
    });

    const discardActions = actions.filter((a) => a.type === ActionType.Discard);
    expect(discardActions).toHaveLength(1);
    expect(discardActions[0].type === ActionType.Discard && discardActions[0].isTsumogiri).toBe(
      true,
    );
  });

  it("暗槓候補が手牌にあれば Ankan アクションが含まれる", () => {
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man1, 1),
      tile(TT.Man1, 2),
      tile(TT.Man1, 3),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Nan, 0),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: false,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: false,
    });

    const ankanActions = actions.filter((a) => a.type === ActionType.Ankan);
    expect(ankanActions.length).toBeGreaterThan(0);
    expect(ankanActions.some((a) => a.type === ActionType.Ankan && a.tileType === TT.Man1)).toBe(
      true,
    );
  });

  it("九種九牌が可能な場合 KyuushuKyuuhai が含まれる", () => {
    // 幺九牌9種以上
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man9, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou9, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin9, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
      tile(TT.Sha, 0),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Man6, 0),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: true,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: true,
    });

    expect(actions.some((a) => a.type === ActionType.KyuushuKyuuhai)).toBe(true);
  });

  it("九種九牌が不可能な場合は KyuushuKyuuhai が含まれない", () => {
    const hand = new Hand([
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Sou4, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Pin4, 0),
      tile(TT.Pin5, 0),
      tile(TT.Pin6, 0),
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Pin6, 0),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: true,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: true,
    });

    expect(actions.some((a) => a.type === ActionType.KyuushuKyuuhai)).toBe(false);
  });

  it("打牌タイプは重複しない", () => {
    // Man1 が2枚ある手牌
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man1, 1),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
    ]);

    const actions = getActionsAfterDraw({
      playerIndex: 0,
      hand,
      melds: [],
      drawnTile: tile(TT.Nan, 0),
      ruleConfig: defaultRule,
      seatWind: TT.Ton,
      roundWind: TT.Ton,
      isFirstDraw: false,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: false,
    });

    const discardTypes = actions
      .filter((a) => a.type === ActionType.Discard)
      .map((a) => (a as { tile: Tile }).tile.type);
    const uniqueTypes = new Set(discardTypes);
    expect(uniqueTypes.size).toBe(discardTypes.length);
  });
});

// ===== getActionsAfterDiscard =====

describe("getActionsAfterDiscard", () => {
  it("スキップは常に含まれる", () => {
    const hand = new Hand([
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Ton, 1),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Man8, 0),
      tile(TT.Haku, 0),
    ]);

    const actions = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Chun, 0),
      discardPlayerIndex: 0,
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    expect(actions.some((a) => a.type === ActionType.Skip)).toBe(true);
  });

  it("ポンが可能な場合アクションに含まれる", () => {
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man1, 1), // Man1のポン候補
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
    ]);

    const actions = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Man1, 2),
      discardPlayerIndex: 0,
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    expect(actions.some((a) => a.type === ActionType.Pon)).toBe(true);
  });

  it("チーは上家からのみ可能", () => {
    // playerIndex=1, discardPlayerIndex=0 → 上家なのでチー可能
    const hand = new Hand([
      tile(TT.Man2, 0),
      tile(TT.Man3, 0), // Man1に対するチー候補
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
    ]);

    const actionsFromKamicha = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Man1, 0),
      discardPlayerIndex: 0, // 上家
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    expect(actionsFromKamicha.some((a) => a.type === ActionType.Chi)).toBe(true);

    // 対面（playerIndex=2）からはチーできない
    const actionsFromToimen = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Man1, 0),
      discardPlayerIndex: 3, // 対面ではなく上家でもない
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    expect(actionsFromToimen.some((a) => a.type === ActionType.Chi)).toBe(false);
  });

  it("リーチ中はロンとスキップのみ", () => {
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man1, 1), // ポン候補があるが...
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin2, 0),
      tile(TT.Pin3, 0),
      tile(TT.Ton, 0),
      tile(TT.Nan, 0),
    ]);

    const actions = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Man1, 2),
      discardPlayerIndex: 0,
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: true,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: false,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    const actionTypes = actions.map((a) => a.type);
    // ポンやチーが含まれない
    expect(actionTypes).not.toContain(ActionType.Pon);
    expect(actionTypes).not.toContain(ActionType.Chi);
    expect(actionTypes).toContain(ActionType.Skip);
  });

  it("フリテンの場合ロンが含まれない", () => {
    // Man6, Man9 待ちの手でフリテン
    const hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Man8, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0),
      tile(TT.Sou3, 0),
      tile(TT.Pin1, 0),
      tile(TT.Pin1, 1),
    ]);

    const actions = getActionsAfterDiscard({
      playerIndex: 1,
      hand,
      melds: [],
      discardTile: tile(TT.Man9, 0),
      discardPlayerIndex: 0,
      ruleConfig: defaultRule,
      seatWind: TT.Nan,
      roundWind: TT.Ton,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHoutei: false,
      isFuriten: true,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });

    expect(actions.some((a) => a.type === ActionType.Ron)).toBe(false);
  });
});
