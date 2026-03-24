import { describe, it, expect } from "vitest";
import { Wall } from "../wall/index.js";
import { createDefaultRuleConfig, createTonpuDefaults } from "../rule/index.js";
import {
  createGame,
  startGame,
  processRoundResult,
  calculateFinalResult,
  GamePhase,
} from "../game/index.js";
import { createRound, RoundPhase } from "../round/index.js";
import { BasicAiPlayer, playRoundWithAi } from "./ai.js";
import type { AiPlayer } from "./types.js";

// ===== ヘルパー =====

function create4Ai(): [AiPlayer, AiPlayer, AiPlayer, AiPlayer] {
  return [new BasicAiPlayer(), new BasicAiPlayer(), new BasicAiPlayer(), new BasicAiPlayer()];
}

/**
 * ゲーム（半荘 or 東風）を最初から最後までAI4人で自動進行する
 */
function playFullGame(gameLength: "hanchan" | "tonpu" = "hanchan"): {
  finalScores: [number, number, number, number];
  roundCount: number;
} {
  const ruleConfig = gameLength === "tonpu" ? createTonpuDefaults() : createDefaultRuleConfig();
  const gameState = createGame(ruleConfig);
  startGame(gameState);

  const aiPlayers = create4Ai();
  let roundCount = 0;
  const MAX_ROUNDS = 50; // 安全弁

  while (gameState.phase === GamePhase.InProgress && roundCount < MAX_ROUNDS) {
    roundCount++;

    const wall = Wall.create(ruleConfig.redDora);
    const roundState = createRound({
      ruleConfig,
      wall,
      dealerIndex: gameState.dealerIndex,
      roundWind: gameState.currentRound.roundWind,
      honba: gameState.honba,
      riichiSticks: gameState.riichiSticks,
      playerScores: gameState.scores as [number, number, number, number],
    });

    playRoundWithAi(roundState, aiPlayers);

    expect(roundState.phase).toBe(RoundPhase.Completed);
    expect(roundState.result).toBeDefined();

    processRoundResult(gameState, roundState.result!);
  }

  expect(roundCount).toBeLessThan(MAX_ROUNDS);
  expect(gameState.phase).toBe(GamePhase.Finished);

  const result = calculateFinalResult(gameState);
  return {
    finalScores: [...result.finalScores] as [number, number, number, number],
    roundCount,
  };
}

// ===== CPU 4人対局シミュレーション =====

describe("CPU4人対局シミュレーション", () => {
  it("半荘をAI4人で完走できる", () => {
    const { finalScores, roundCount } = playFullGame("hanchan");

    // ゲームが少なくとも4局は行われる（東1〜東4 or 南まで）
    expect(roundCount).toBeGreaterThanOrEqual(4);

    // 4人の最終得点が存在する
    expect(finalScores).toHaveLength(4);
    finalScores.forEach((score) => {
      expect(typeof score).toBe("number");
    });
  });

  it("東風戦をAI4人で完走できる", () => {
    const { finalScores, roundCount } = playFullGame("tonpu");

    // 東風は最低4局
    expect(roundCount).toBeGreaterThanOrEqual(4);
    expect(finalScores).toHaveLength(4);
  });

  it("半荘を3回実行して全てクラッシュしない", { timeout: 30000 }, () => {
    for (let i = 0; i < 3; i++) {
      const { roundCount } = playFullGame("hanchan");
      expect(roundCount).toBeGreaterThanOrEqual(4);
    }
  });

  it("得点の合計は初期持ち点の合計とリーチ棒を考慮して妥当", () => {
    const { finalScores } = playFullGame("hanchan");
    const totalScore = finalScores.reduce((a, b) => a + b, 0);

    // 初期持ち点 25000×4 = 100000
    // リーチ棒が残っている場合があるが、calculateFinalResult で供託はトップに加算されるので
    // 最終得点の合計は 100000 になるはず
    expect(totalScore).toBe(100000);
  });

  it("順位が1-4で全員異なる（同点でない場合）", () => {
    const ruleConfig = createDefaultRuleConfig();
    const gameState = createGame(ruleConfig);
    startGame(gameState);

    const aiPlayers = create4Ai();
    let roundCount = 0;

    while (gameState.phase === GamePhase.InProgress && roundCount < 50) {
      roundCount++;
      const wall = Wall.create(ruleConfig.redDora);
      const roundState = createRound({
        ruleConfig,
        wall,
        dealerIndex: gameState.dealerIndex,
        roundWind: gameState.currentRound.roundWind,
        honba: gameState.honba,
        riichiSticks: gameState.riichiSticks,
        playerScores: gameState.scores as [number, number, number, number],
      });

      playRoundWithAi(roundState, aiPlayers);
      processRoundResult(gameState, roundState.result!);
    }

    const result = calculateFinalResult(gameState);
    const sorted = [...result.rankings].sort();
    expect(sorted).toEqual([1, 2, 3, 4]);
  });
});
