import { create } from "zustand";
import type {
  RoundState,
  GameState as DomainGameState,
  GameResult,
  PlayerAction,
  RuleConfig,
  Tile,
  SkipAction,
} from "@mahjong-web/domain";
import {
  createGame,
  startGame,
  processRoundResult,
  calculateFinalResult,
  getCurrentRoundInfo,
  createRound,
  startRound,
  applyAction,
  resolveAfterDiscard,
  resolveAfterKan,
  isFuriten,
  getActionsAfterDraw,
  getActionsAfterDiscard,
  getActionsAfterAnkan,
  Wall,
  RoundPhase,
  GamePhase,
  ActionType,
  BasicAiPlayer,
} from "@mahjong-web/domain";

// ===== UI phases =====

export type UiPhase =
  | "idle"
  | "playing"
  | "waitingHumanDraw"
  | "waitingHumanAfterDiscard"
  | "cpuThinking"
  | "roundResult"
  | "gameResult";

// ===== Store state =====

export interface GameStore {
  uiPhase: UiPhase;
  gameState: DomainGameState | null;
  roundState: RoundState | null;
  gameResult: GameResult | null;
  humanPlayerIndex: number;
  availableActions: PlayerAction[];
  selectedTileIndex: number | undefined;
  cpuDelay: number;
  debugMode: boolean;
  debugSelectedWallTileKey: string | undefined;
  debugSelectedHandTileKey: string | undefined;
  debugTargetPlayer: number;

  // actions
  startCpuGame: (ruleConfig: RuleConfig) => void;
  selectTile: (index: number | undefined) => void;
  performAction: (action: PlayerAction) => void;
  nextRound: () => void;
  returnToTop: () => void;
  toggleDebugMode: () => void;
  selectDebugWallTile: (key: string | undefined) => void;
  selectDebugHandTile: (key: string | undefined) => void;
  setDebugTargetPlayer: (playerIndex: number) => void;
  performDebugSwap: () => void;
}

const AI = new BasicAiPlayer();
function skipAction(playerIndex: number): SkipAction {
  return { type: ActionType.Skip, playerIndex };
}

// ===== Helper: determine human's available actions in DrawPhase =====

function getHumanDrawActions(round: RoundState, playerIndex: number): PlayerAction[] {
  const player = round.players[playerIndex];
  const handTiles = player.hand.getTiles();
  const drawnTile = handTiles[handTiles.length - 1];

  return getActionsAfterDraw({
    playerIndex,
    hand: player.hand,
    melds: player.melds,
    drawnTile,
    ruleConfig: round.ruleConfig,
    seatWind: player.seatWind,
    roundWind: round.roundWind,
    isFirstDraw: player.isFirstTurn,
    isRiichi: player.isRiichi,
    isDoubleRiichi: player.isDoubleRiichi,
    isIppatsu: player.isIppatsu,
    isHaitei: round.wall.remainingDrawCount === 0,
    doraCount: 0,
    uraDoraCount: 0,
    redDoraCount: 0,
    canKyuushuKyuuhai: player.isFirstTurn,
    kuikaeForbiddenTypes: round.kuikaeForbiddenTypes,
  });
}

// ===== Helper: get human's available after-discard actions =====

function getHumanAfterDiscardActions(round: RoundState, playerIndex: number): PlayerAction[] {
  const discardTile = round.lastDiscardTile;
  const discardPlayer = round.lastDiscardPlayerIndex;
  if (!discardTile || discardPlayer === undefined) return [];
  if (discardPlayer === playerIndex) return [];

  const player = round.players[playerIndex];
  return getActionsAfterDiscard({
    playerIndex,
    hand: player.hand,
    melds: player.melds,
    discardTile,
    discardPlayerIndex: discardPlayer,
    ruleConfig: round.ruleConfig,
    seatWind: player.seatWind,
    roundWind: round.roundWind,
    isRiichi: player.isRiichi,
    isDoubleRiichi: player.isDoubleRiichi,
    isIppatsu: player.isIppatsu,
    isHoutei: round.wall.remainingDrawCount === 0,
    isFuriten: isFuriten(round, playerIndex),
    doraCount: 0,
    uraDoraCount: 0,
    redDoraCount: 0,
  });
}

// ===== Helper: get after-kan actions (handles both ankan-chankan and kakan-chankan) =====

function getAfterKanActions(round: RoundState, playerIndex: number): PlayerAction[] {
  const chankanTile = round.chankanTile;
  if (!chankanTile) return [{ type: ActionType.Skip, playerIndex }];

  const kanPlayer = round.activePlayerIndex;
  if (kanPlayer === playerIndex) return [{ type: ActionType.Skip, playerIndex }];

  const player = round.players[playerIndex];
  if (round.isAnkanChankan) {
    return getActionsAfterAnkan({
      playerIndex,
      hand: player.hand,
      melds: player.melds,
      ankanTile: chankanTile,
      ankanPlayerIndex: kanPlayer,
      ruleConfig: round.ruleConfig,
      seatWind: player.seatWind,
      roundWind: round.roundWind,
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      isIppatsu: player.isIppatsu,
      isFuriten: isFuriten(round, playerIndex),
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });
  }
  return getActionsAfterDiscard({
    playerIndex,
    hand: player.hand,
    melds: player.melds,
    discardTile: chankanTile,
    discardPlayerIndex: kanPlayer,
    ruleConfig: round.ruleConfig,
    seatWind: player.seatWind,
    roundWind: round.roundWind,
    isRiichi: player.isRiichi,
    isDoubleRiichi: player.isDoubleRiichi,
    isIppatsu: player.isIppatsu,
    isHoutei: false,
    isFuriten: isFuriten(round, playerIndex),
    doraCount: 0,
    uraDoraCount: 0,
    redDoraCount: 0,
  });
}

// ===== Create store =====

export const useGameStore = create<GameStore>((set, get) => ({
  uiPhase: "idle",
  gameState: null,
  roundState: null,
  gameResult: null,
  humanPlayerIndex: 0,
  availableActions: [],
  selectedTileIndex: undefined,
  cpuDelay: 300,
  debugMode: false,
  debugSelectedWallTileKey: undefined,
  debugSelectedHandTileKey: undefined,
  debugTargetPlayer: 0,

  startCpuGame: (ruleConfig) => {
    // Strict Mode の二重実行によるゲームループ重複を防止
    if (get().uiPhase !== "idle") return;

    const game = startGame(createGame(ruleConfig));
    const info = getCurrentRoundInfo(game);

    const wall = Wall.create(ruleConfig.redDora);
    const round = createRound({
      ruleConfig,
      wall,
      dealerIndex: info.dealerIndex,
      roundWind: info.roundWind as Tile["type"],
      honba: info.honba,
      riichiSticks: game.riichiSticks,
      playerScores: [...game.scores] as [number, number, number, number],
    });
    startRound(round);

    set({
      uiPhase: "playing",
      gameState: game,
      roundState: round,
      gameResult: null,
      availableActions: [],
      selectedTileIndex: undefined,
    });

    // Kick off the game loop
    setTimeout(() => get().performAction(null as unknown as PlayerAction), 0);
  },

  selectTile: (index) => {
    set({ selectedTileIndex: index });
  },

  performAction: (action) => {
    const { roundState, gameState, humanPlayerIndex } = get();
    if (!roundState || !gameState) return;

    // If action is null, this is just a loop trigger
    if (action) {
      // Human performed an action
      if (
        roundState.phase === RoundPhase.DrawPhase &&
        roundState.activePlayerIndex === humanPlayerIndex
      ) {
        applyAction(roundState, action);
        set({ availableActions: [], selectedTileIndex: undefined });
      } else if (
        roundState.phase === RoundPhase.AfterDiscard ||
        roundState.phase === RoundPhase.AfterKan
      ) {
        // Human responded to discard/kan — collect all responses
        resolveWithHumanAction(roundState, humanPlayerIndex, action);
        set({ availableActions: [], selectedTileIndex: undefined });
      }
    }

    // Continue game loop
    runGameLoop(get, set);
  },

  nextRound: () => {
    const { gameState } = get();
    if (!gameState) return;

    if (gameState.phase === GamePhase.Finished) {
      const result = calculateFinalResult(gameState);
      set({ uiPhase: "gameResult", gameResult: result });
      return;
    }

    const info = getCurrentRoundInfo(gameState);
    const wall = Wall.create(gameState.ruleConfig.redDora);
    const round = createRound({
      ruleConfig: gameState.ruleConfig,
      wall,
      dealerIndex: info.dealerIndex,
      roundWind: info.roundWind as Tile["type"],
      honba: info.honba,
      riichiSticks: gameState.riichiSticks,
      playerScores: [...gameState.scores] as [number, number, number, number],
    });
    startRound(round);

    set({
      uiPhase: "playing",
      roundState: round,
      availableActions: [],
      selectedTileIndex: undefined,
    });

    setTimeout(() => get().performAction(null as unknown as PlayerAction), 0);
  },

  returnToTop: () => {
    set({
      uiPhase: "idle",
      gameState: null,
      roundState: null,
      gameResult: null,
      availableActions: [],
      selectedTileIndex: undefined,
    });
  },

  toggleDebugMode: () => {
    set((s) => ({
      debugMode: !s.debugMode,
      debugSelectedWallTileKey: undefined,
      debugSelectedHandTileKey: undefined,
      debugTargetPlayer: 0,
    }));
  },

  selectDebugWallTile: (key) => {
    set({ debugSelectedWallTileKey: key });
  },

  selectDebugHandTile: (key) => {
    set({ debugSelectedHandTileKey: key });
  },

  setDebugTargetPlayer: (playerIndex) => {
    set({ debugTargetPlayer: playerIndex, debugSelectedHandTileKey: undefined });
  },

  performDebugSwap: () => {
    const { roundState, debugSelectedWallTileKey, debugSelectedHandTileKey, debugTargetPlayer } =
      get();
    if (
      !roundState ||
      debugSelectedWallTileKey === undefined ||
      debugSelectedHandTileKey === undefined
    )
      return;

    const tileKey = (t: Tile) => `${t.type}:${t.id}`;
    const player = roundState.players[debugTargetPlayer];
    const handTile = [...player.hand.getTiles()].find((t) => tileKey(t) === debugSelectedHandTileKey);
    if (!handTile) return;

    // 牌山の残り牌からキーで検索し、絶対インデックスを算出
    const remainingTiles = roundState.wall.getRemainingTiles();
    const wallRelativeIndex = remainingTiles.findIndex((t) => tileKey(t) === debugSelectedWallTileKey);
    if (wallRelativeIndex === -1) return;
    const absoluteIndex = roundState.wall.getDrawIndex() + wallRelativeIndex;

    // 牌山の牌を手牌の牌と交換
    const wallTile = roundState.wall.swapTileAt(absoluteIndex, handTile);

    // 手牌から元の牌を除去して、牌山から取り出した牌を追加
    player.hand.removeTile(handTile);
    player.hand.addTile(wallTile);

    // 人間の手牌を入れ替えた場合、availableActions を再計算
    const { uiPhase, humanPlayerIndex } = get();
    const newAvailableActions =
      uiPhase === "waitingHumanDraw" && debugTargetPlayer === humanPlayerIndex
        ? getHumanDrawActions(roundState, humanPlayerIndex)
        : get().availableActions;

    set({
      roundState: { ...roundState } as unknown as RoundState,
      debugSelectedWallTileKey: undefined,
      debugSelectedHandTileKey: undefined,
      availableActions: newAvailableActions,
    });
  },
}));

// ===== Game loop =====

function runGameLoop(get: () => GameStore, set: (partial: Partial<GameStore>) => void) {
  const { roundState, gameState, humanPlayerIndex, cpuDelay } = get();
  if (!roundState || !gameState) return;

  // Round completed
  if (roundState.phase === RoundPhase.Completed) {
    const result = roundState.result!;
    processRoundResult(gameState, result);
    set({ uiPhase: "roundResult" });
    return;
  }

  // DrawPhase
  if (roundState.phase === RoundPhase.DrawPhase) {
    if (roundState.activePlayerIndex === humanPlayerIndex) {
      // Human's turn
      const actions = getHumanDrawActions(roundState, humanPlayerIndex);
      set({
        uiPhase: "waitingHumanDraw",
        availableActions: actions,
        roundState: { ...roundState } as unknown as RoundState,
      });
      return;
    }

    // CPU's turn
    set({ uiPhase: "cpuThinking" });
    setTimeout(() => {
      const state = get().roundState;
      if (!state || state.phase !== RoundPhase.DrawPhase) return;
      // 人間の番をCPUとして処理しないガード
      if (state.activePlayerIndex === get().humanPlayerIndex) return;

      const pIdx = state.activePlayerIndex;
      const player = state.players[pIdx];
      const handTiles = player.hand.getTiles();
      const drawnTile = handTiles[handTiles.length - 1];

      const actions = getActionsAfterDraw({
        playerIndex: pIdx,
        hand: player.hand,
        melds: player.melds,
        drawnTile,
        ruleConfig: state.ruleConfig,
        seatWind: player.seatWind,
        roundWind: state.roundWind,
        isFirstDraw: player.isFirstTurn,
        isRiichi: player.isRiichi,
        isDoubleRiichi: player.isDoubleRiichi,
        isIppatsu: player.isIppatsu,
        isHaitei: state.wall.remainingDrawCount === 0,
        doraCount: 0,
        uraDoraCount: 0,
        redDoraCount: 0,
        canKyuushuKyuuhai: player.isFirstTurn,
        kuikaeForbiddenTypes: state.kuikaeForbiddenTypes,
      });

      const chosen = AI.chooseAction(actions, state, pIdx);
      applyAction(state, chosen);
      set({ roundState: state });

      // Continue loop
      runGameLoop(get, set);
    }, cpuDelay);
    return;
  }

  // AfterDiscard
  if (roundState.phase === RoundPhase.AfterDiscard) {
    const discardPlayer = roundState.lastDiscardPlayerIndex!;

    // Check if human has meaningful actions (not just skip)
    if (discardPlayer !== humanPlayerIndex) {
      const humanActions = getHumanAfterDiscardActions(roundState, humanPlayerIndex);
      const meaningfulActions = humanActions.filter((a) => a.type !== ActionType.Skip);

      if (meaningfulActions.length > 0) {
        set({
          uiPhase: "waitingHumanAfterDiscard",
          availableActions: humanActions,
        });
        return;
      }
    }

    // All CPUs decide (+ human auto-skips)
    resolveAllCpu(roundState, humanPlayerIndex);
    set({ roundState });
    runGameLoop(get, set);
    return;
  }

  // AfterKan
  if (roundState.phase === RoundPhase.AfterKan) {
    const kanPlayer = roundState.activePlayerIndex;

    // Check if human can ron (chankan / kokushi ankan ron)
    if (kanPlayer !== humanPlayerIndex && roundState.chankanTile) {
      const humanActions = getAfterKanActions(roundState, humanPlayerIndex);
      const ronActions = humanActions.filter((a) => a.type === ActionType.Ron);

      if (ronActions.length > 0) {
        set({
          uiPhase: "waitingHumanAfterDiscard",
          availableActions: [
            ...ronActions,
            { type: ActionType.Skip, playerIndex: humanPlayerIndex },
          ],
        });
        return;
      }
    }

    // All CPUs decide
    resolveKanAllCpu(roundState, humanPlayerIndex);
    set({ roundState });
    runGameLoop(get, set);
    return;
  }
}

// ===== Resolve helpers =====

function resolveWithHumanAction(round: RoundState, humanIndex: number, humanAction: PlayerAction) {
  if (round.phase === RoundPhase.AfterDiscard) {
    const discardPlayer = round.lastDiscardPlayerIndex!;
    const discardTile = round.lastDiscardTile!;
    const playerActions = new Map<number, PlayerAction>();

    for (let i = 0; i < 4; i++) {
      if (i === discardPlayer) continue;
      if (i === humanIndex) {
        playerActions.set(i, humanAction);
        continue;
      }
      const player = round.players[i];
      const actions = getActionsAfterDiscard({
        playerIndex: i,
        hand: player.hand,
        melds: player.melds,
        discardTile,
        discardPlayerIndex: discardPlayer,
        ruleConfig: round.ruleConfig,
        seatWind: player.seatWind,
        roundWind: round.roundWind,
        isRiichi: player.isRiichi,
        isDoubleRiichi: player.isDoubleRiichi,
        isIppatsu: player.isIppatsu,
        isHoutei: round.wall.remainingDrawCount === 0,
        isFuriten: isFuriten(round, i),
        doraCount: 0,
        uraDoraCount: 0,
        redDoraCount: 0,
      });
      const chosen = AI.chooseAction(actions, round, i);
      playerActions.set(i, chosen);
    }
    resolveAfterDiscard(round, playerActions);
  } else if (round.phase === RoundPhase.AfterKan) {
    const kanPlayer = round.activePlayerIndex;
    const playerActions = new Map<number, PlayerAction>();

    for (let i = 0; i < 4; i++) {
      if (i === kanPlayer) continue;
      if (i === humanIndex) {
        playerActions.set(i, humanAction);
        continue;
      }
      const actions = getAfterKanActions(round, i);
      const ronOrSkip = actions.filter(
        (a) => a.type === ActionType.Ron || a.type === ActionType.Skip,
      );
      const chosen = ronOrSkip.length > 0 ? AI.chooseAction(ronOrSkip, round, i) : skipAction(i);
      playerActions.set(i, chosen);
    }
    resolveAfterKan(round, playerActions);
  }
}

function resolveAllCpu(round: RoundState, humanIndex: number) {
  const discardPlayer = round.lastDiscardPlayerIndex!;
  const discardTile = round.lastDiscardTile!;
  const playerActions = new Map<number, PlayerAction>();

  for (let i = 0; i < 4; i++) {
    if (i === discardPlayer) continue;
    if (i === humanIndex) {
      playerActions.set(i, skipAction(i));
      continue;
    }
    const player = round.players[i];
    const actions = getActionsAfterDiscard({
      playerIndex: i,
      hand: player.hand,
      melds: player.melds,
      discardTile,
      discardPlayerIndex: discardPlayer,
      ruleConfig: round.ruleConfig,
      seatWind: player.seatWind,
      roundWind: round.roundWind,
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      isIppatsu: player.isIppatsu,
      isHoutei: round.wall.remainingDrawCount === 0,
      isFuriten: isFuriten(round, i),
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });
    const chosen = AI.chooseAction(actions, round, i);
    playerActions.set(i, chosen);
  }
  resolveAfterDiscard(round, playerActions);
}

function resolveKanAllCpu(round: RoundState, humanIndex: number) {
  const kanPlayer = round.activePlayerIndex;
  const playerActions = new Map<number, PlayerAction>();

  for (let i = 0; i < 4; i++) {
    if (i === kanPlayer) continue;
    if (i === humanIndex) {
      playerActions.set(i, skipAction(i));
      continue;
    }
    const actions = getAfterKanActions(round, i);
    const ronOrSkip = actions.filter(
      (a) => a.type === ActionType.Ron || a.type === ActionType.Skip,
    );
    const chosen = ronOrSkip.length > 0 ? AI.chooseAction(ronOrSkip, round, i) : skipAction(i);
    playerActions.set(i, chosen);
  }
  resolveAfterKan(round, playerActions);
}
