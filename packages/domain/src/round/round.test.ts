import { describe, it, expect } from "vitest";
import { TileType as TT, type Tile, createAllTiles, isSameTile } from "../tile/index.js";
import { Wall } from "../wall/index.js";
import { Hand } from "../hand/index.js";
import { createDefaultRuleConfig, AbortiveDraw } from "../rule/index.js";
import type { RuleConfig } from "../rule/index.js";
import { ActionType, type PlayerAction } from "../action/index.js";
import {
  createRound,
  startRound,
  applyAction,
  advanceToNextDraw,
  resolveAfterDiscard,
  isFuriten,
  RoundPhase,
  RoundEndReason,
} from "../round/index.js";
import type { RoundState } from "../round/index.js";

// ===== ヘルパー =====

function tile(type: TT, id = 0, isRedDora = false): Tile {
  return { type, id, isRedDora };
}

/** テスト用のデフォルトルール */
function defaultRule(): RuleConfig {
  return createDefaultRuleConfig();
}

/** 固定牌山を作成（シャッフルなし） */
function createFixedWall(): Wall {
  return Wall.fromTiles(createAllTiles("none"));
}

/** 局を作成して開始する */
function createAndStartRound(ruleConfig?: RuleConfig, wall?: Wall): RoundState {
  const state = createRound({
    ruleConfig: ruleConfig ?? defaultRule(),
    wall: wall ?? createFixedWall(),
    dealerIndex: 0,
    roundWind: TT.Ton,
    honba: 0,
    riichiSticks: 0,
    playerScores: [25000, 25000, 25000, 25000],
  });
  startRound(state);
  return state;
}

// ===== createRound =====

describe("createRound", () => {
  it("初期状態が NotStarted で作成される", () => {
    const state = createRound({
      ruleConfig: defaultRule(),
      wall: createFixedWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });
    expect(state.phase).toBe(RoundPhase.NotStarted);
    expect(state.players).toHaveLength(4);
    expect(state.dealerIndex).toBe(0);
    expect(state.roundWind).toBe(TT.Ton);
  });

  it("各プレイヤーに13枚配牌される", () => {
    const state = createRound({
      ruleConfig: defaultRule(),
      wall: createFixedWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });
    for (const p of state.players) {
      expect(p.hand.count).toBe(13);
    }
  });

  it("親が東の自風を持つ", () => {
    const state = createRound({
      ruleConfig: defaultRule(),
      wall: createFixedWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });
    expect(state.players[0].seatWind).toBe(TT.Ton);
    expect(state.players[1].seatWind).toBe(TT.Nan);
    expect(state.players[2].seatWind).toBe(TT.Sha);
    expect(state.players[3].seatWind).toBe(TT.Pei);
  });

  it("dealerIndex=2 の場合、座席風が正しく回る", () => {
    const state = createRound({
      ruleConfig: defaultRule(),
      wall: createFixedWall(),
      dealerIndex: 2,
      roundWind: TT.Nan,
      honba: 1,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });
    expect(state.players[2].seatWind).toBe(TT.Ton); // 親
    expect(state.players[3].seatWind).toBe(TT.Nan);
    expect(state.players[0].seatWind).toBe(TT.Sha);
    expect(state.players[1].seatWind).toBe(TT.Pei);
  });
});

// ===== startRound =====

describe("startRound", () => {
  it("DrawPhase に遷移し、親が14枚になる", () => {
    const state = createRound({
      ruleConfig: defaultRule(),
      wall: createFixedWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });
    startRound(state);
    expect(state.phase).toBe(RoundPhase.DrawPhase);
    expect(state.players[0].hand.count).toBe(14);
    expect(state.turnCount).toBe(1);
  });

  it("既に開始済みならエラー", () => {
    const state = createAndStartRound();
    expect(() => startRound(state)).toThrow("不正なフェーズです");
  });
});

// ===== applyAction: Discard =====

describe("applyAction: Discard", () => {
  it("打牌後に AfterDiscard フェーズになる", () => {
    const state = createAndStartRound();
    const hand = state.players[0].hand;
    const tileToDiscard = hand.getTiles()[0];

    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tileToDiscard,
      isTsumogiri: false,
    });

    expect(state.phase).toBe(RoundPhase.AfterDiscard);
    expect(state.lastDiscardTile).toBeDefined();
    expect(isSameTile(state.lastDiscardTile!, tileToDiscard)).toBe(true);
    expect(state.lastDiscardPlayerIndex).toBe(0);
    expect(hand.count).toBe(13);
  });

  it("河に牌が追加される", () => {
    const state = createAndStartRound();
    const hand = state.players[0].hand;
    const tileToDiscard = hand.getTiles()[0];

    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tileToDiscard,
      isTsumogiri: false,
    });

    const discards = state.players[0].discard.getAllDiscards();
    expect(discards).toHaveLength(1);
    expect(discards[0].tile.type).toBe(tileToDiscard.type);
  });
});

// ===== advanceToNextDraw =====

describe("advanceToNextDraw", () => {
  it("次のプレイヤーがツモして DrawPhase に戻る", () => {
    const state = createAndStartRound();
    const hand = state.players[0].hand;
    const tileToDiscard = hand.getTiles()[0];

    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tileToDiscard,
      isTsumogiri: false,
    });

    advanceToNextDraw(state);

    expect(state.phase).toBe(RoundPhase.DrawPhase);
    expect(state.activePlayerIndex).toBe(1);
    expect(state.players[1].hand.count).toBe(14);
  });
});

// ===== resolveAfterDiscard =====

describe("resolveAfterDiscard", () => {
  it("全員スキップなら次のツモへ進む", () => {
    const state = createAndStartRound();
    const tileToDiscard = state.players[0].hand.getTiles()[0];

    applyAction(state, {
      type: ActionType.Discard,
      playerIndex: 0,
      tile: tileToDiscard,
      isTsumogiri: false,
    });

    const actions = new Map<number, PlayerAction>();
    actions.set(1, { type: ActionType.Skip, playerIndex: 1 });
    actions.set(2, { type: ActionType.Skip, playerIndex: 2 });
    actions.set(3, { type: ActionType.Skip, playerIndex: 3 });

    resolveAfterDiscard(state, actions);

    expect(state.activePlayerIndex).toBe(1);
    expect(state.players[1].hand.count).toBe(14);
  });

  it("不正なフェーズではエラー", () => {
    const state = createAndStartRound();
    const actions = new Map<number, PlayerAction>();

    expect(() => resolveAfterDiscard(state, actions)).toThrow("不正なフェーズです");
  });
});

// ===== 九種九牌 =====

describe("九種九牌", () => {
  it("九種九牌で途中流局する", () => {
    const rule = defaultRule();
    const state = createAndStartRound(rule);

    // 九種九牌を発動させるには isKyuushuKyuuhai チェック済みと仮定
    applyAction(state, {
      type: ActionType.KyuushuKyuuhai,
      playerIndex: 0,
    });

    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result).toBeDefined();
    expect(state.result!.reason).toBe(RoundEndReason.KyuushuKyuuhai);
    expect(state.result!.scoreChanges).toEqual([0, 0, 0, 0]);
  });

  it("九種九牌が disabled ならエラー", () => {
    const rule = { ...defaultRule(), kyuushuKyuuhai: AbortiveDraw.Disabled };
    const state = createAndStartRound(rule);

    expect(() =>
      applyAction(state, {
        type: ActionType.KyuushuKyuuhai,
        playerIndex: 0,
      }),
    ).toThrow("九種九牌は無効設定です");
  });
});

// ===== handleRiichi =====

describe("リーチ", () => {
  it("リーチ宣言で1000点供託される", () => {
    const state = createAndStartRound();
    const hand = state.players[0].hand;
    const tileToDiscard = hand.getTiles()[0];

    applyAction(state, {
      type: ActionType.Riichi,
      playerIndex: 0,
      tile: tileToDiscard,
    });

    expect(state.players[0].isRiichi).toBe(true);
    expect(state.players[0].score).toBe(24000);
    expect(state.riichiSticks).toBe(1);
    expect(state.riichiPlayerCount).toBe(1);
  });

  it("一巡目のリーチはダブルリーチ", () => {
    const state = createAndStartRound();
    const hand = state.players[0].hand;
    const tileToDiscard = hand.getTiles()[0];

    // 一巡目にリーチ
    applyAction(state, {
      type: ActionType.Riichi,
      playerIndex: 0,
      tile: tileToDiscard,
    });

    expect(state.players[0].isDoubleRiichi).toBe(true);
  });
});

// ===== handleAnkan =====

describe("暗槓", () => {
  it("暗槓で4枚除去、副露追加、槓ドラ開示", () => {
    const state = createAndStartRound();
    const player = state.players[0];

    // テスト用: 手牌に同一牌4枚があると仮定して tileType 指定
    // 固定牌山では man1 が id=0~3 の4枚 → 配牌で4枚揃う保証はないが、
    // 手動で手牌を調整する
    (player as { hand: Hand }).hand = new Hand([
      tile(TT.Man1, 0),
      tile(TT.Man1, 1),
      tile(TT.Man1, 2),
      tile(TT.Man1, 3),
      tile(TT.Man2, 0),
      tile(TT.Man3, 0),
      tile(TT.Man4, 0),
      tile(TT.Man5, 0),
      tile(TT.Man6, 0),
      tile(TT.Man7, 0),
      tile(TT.Man8, 0),
      tile(TT.Man9, 0),
      tile(TT.Sou1, 0),
      tile(TT.Sou2, 0), // 14枚
    ]);

    applyAction(state, {
      type: ActionType.Ankan,
      playerIndex: 0,
      tileType: TT.Man1,
    });

    expect(player.melds).toHaveLength(1);
    expect(player.melds[0].type).toBe("ankan");
    expect(player.hand.count).toBe(11); // 14-4+1(嶺上)
    expect(state.totalKanCount).toBe(1);
    expect(state.isRinshanDraw).toBe(true);
    expect(state.phase).toBe(RoundPhase.DrawPhase);
  });
});

// ===== isFuriten =====

describe("isFuriten", () => {
  it("自分の捨て牌に待ち牌がある場合はフリテン", () => {
    const state = createAndStartRound();
    const player = state.players[0];

    // テンパイ状態を作る
    (player as { hand: Hand }).hand = new Hand([
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

    // 待ちは Man6 or Man9 → Man9 を捨て牌に入れる
    player.discard.addDiscard(tile(TT.Man9, 0), false);

    expect(isFuriten(state, 0)).toBe(true);
  });

  it("捨て牌に待ち牌がなければフリテンでない", () => {
    const state = createAndStartRound();
    const player = state.players[0];

    (player as { hand: Hand }).hand = new Hand([
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

    // 待ちは Man6 or Man9 → 関係ない牌を捨て牌にする
    player.discard.addDiscard(tile(TT.Haku, 0), false);

    expect(isFuriten(state, 0)).toBe(false);
  });
});
