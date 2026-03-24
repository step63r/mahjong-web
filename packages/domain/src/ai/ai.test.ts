import { describe, it, expect } from "vitest";
import { TileType as TT, type Tile, createAllTiles } from "../tile/index.js";
import { Wall } from "../wall/index.js";
import { createDefaultRuleConfig } from "../rule/index.js";
import { ActionType } from "../action/index.js";
import { createRound, RoundPhase } from "../round/index.js";
import { BasicAiPlayer, playRoundWithAi } from "./ai.js";
import type { AiPlayer } from "./types.js";

// ===== ヘルパー =====

function tile(type: TT, id = 0, isRedDora = false): Tile {
  return { type, id, isRedDora };
}

function createFixedWall(): Wall {
  return Wall.fromTiles(createAllTiles("none"));
}

function createShuffledWall(): Wall {
  return Wall.create("none");
}

function create4Ai(): [AiPlayer, AiPlayer, AiPlayer, AiPlayer] {
  return [new BasicAiPlayer(), new BasicAiPlayer(), new BasicAiPlayer(), new BasicAiPlayer()];
}

// ===== BasicAiPlayer =====

describe("BasicAiPlayer", () => {
  const ai = new BasicAiPlayer();

  describe("chooseAction", () => {
    it("アクションが1つなら即座にそれを返す", () => {
      const action = {
        type: ActionType.Discard,
        playerIndex: 0,
        tile: tile(TT.Man1),
        isTsumogiri: true,
      } as const;
      const state = createRound({
        ruleConfig: createDefaultRuleConfig(),
        wall: createFixedWall(),
        dealerIndex: 0,
        roundWind: TT.Ton,
        honba: 0,
        riichiSticks: 0,
        playerScores: [25000, 25000, 25000, 25000],
      });
      const result = ai.chooseAction([action], state, 0);
      expect(result).toBe(action);
    });

    it("ツモ和了が選択肢にあれば和了する", () => {
      const tsumo = { type: ActionType.Tsumo, playerIndex: 0 } as const;
      const discard = {
        type: ActionType.Discard,
        playerIndex: 0,
        tile: tile(TT.Man1),
        isTsumogiri: true,
      } as const;
      const state = createRound({
        ruleConfig: createDefaultRuleConfig(),
        wall: createFixedWall(),
        dealerIndex: 0,
        roundWind: TT.Ton,
        honba: 0,
        riichiSticks: 0,
        playerScores: [25000, 25000, 25000, 25000],
      });
      const result = ai.chooseAction([tsumo, discard], state, 0);
      expect(result.type).toBe(ActionType.Tsumo);
    });

    it("ロンが選択肢にあればロンする", () => {
      const ron = { type: ActionType.Ron, playerIndex: 1 } as const;
      const skip = { type: ActionType.Skip, playerIndex: 1 } as const;
      const state = createRound({
        ruleConfig: createDefaultRuleConfig(),
        wall: createFixedWall(),
        dealerIndex: 0,
        roundWind: TT.Ton,
        honba: 0,
        riichiSticks: 0,
        playerScores: [25000, 25000, 25000, 25000],
      });
      const result = ai.chooseAction([ron, skip], state, 1);
      expect(result.type).toBe(ActionType.Ron);
    });

    it("スキップのみの場合はスキップを返す", () => {
      const skip = { type: ActionType.Skip, playerIndex: 2 } as const;
      const state = createRound({
        ruleConfig: createDefaultRuleConfig(),
        wall: createFixedWall(),
        dealerIndex: 0,
        roundWind: TT.Ton,
        honba: 0,
        riichiSticks: 0,
        playerScores: [25000, 25000, 25000, 25000],
      });
      const result = ai.chooseAction([skip], state, 2);
      expect(result.type).toBe(ActionType.Skip);
    });
  });
});

// ===== playRoundWithAi =====

describe("playRoundWithAi", () => {
  it("固定牌山で1局を完了できる", () => {
    const state = createRound({
      ruleConfig: createDefaultRuleConfig(),
      wall: createFixedWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });

    playRoundWithAi(state, create4Ai());

    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result).toBeDefined();
  });

  it("シャッフル牌山で1局を完了できる", () => {
    const state = createRound({
      ruleConfig: createDefaultRuleConfig(),
      wall: createShuffledWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });

    playRoundWithAi(state, create4Ai());

    expect(state.phase).toBe(RoundPhase.Completed);
    expect(state.result).toBeDefined();
  });

  it("得点変動の合計は0", () => {
    const state = createRound({
      ruleConfig: createDefaultRuleConfig(),
      wall: createShuffledWall(),
      dealerIndex: 0,
      roundWind: TT.Ton,
      honba: 0,
      riichiSticks: 0,
      playerScores: [25000, 25000, 25000, 25000],
    });

    playRoundWithAi(state, create4Ai());

    const result = state.result!;
    const totalChange = result.scoreChanges.reduce((a, b) => a + b, 0);
    // リーチ棒による±がある場合もあるが、局内完結なら0か供託分
    expect(totalChange).toBeLessThanOrEqual(0); // リーチ棒が供託に残る場合は負
  });

  it("複数回実行しても全てクラッシュしない", () => {
    for (let i = 0; i < 5; i++) {
      const state = createRound({
        ruleConfig: createDefaultRuleConfig(),
        wall: createShuffledWall(),
        dealerIndex: i % 4,
        roundWind: i < 4 ? TT.Ton : TT.Nan,
        honba: 0,
        riichiSticks: 0,
        playerScores: [25000, 25000, 25000, 25000],
      });

      playRoundWithAi(state, create4Ai());

      expect(state.phase).toBe(RoundPhase.Completed);
    }
  });
});
