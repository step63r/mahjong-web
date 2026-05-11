import { useEffect, useCallback, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PixiGameBoard } from "@/components/board/PixiGameBoard";
import { ActionButtons } from "@/components/action/ActionButtons";
import { RoundResultOverlay } from "@/components/overlay/RoundResultOverlay";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { buildPlayerViews, buildActionOptions, getRiichiCandidateTileTypes, computeWaitingTiles } from "@/utils/viewConverter";
import { ActionType, RoundEndReason, createDefaultRuleConfig } from "@mahjong-web/domain";
import type { RuleConfig } from "@mahjong-web/domain";
import type { TileData } from "@/types";
import type { WaitingTileInfo } from "@/utils/viewConverter";

// ===== 配牌シーケンスヘルパー =====

/**
 * 配牌アニメーションの各ステップ終了時における
 * [self, shimocha, toimen, kamicha] の公開枚数配列を返す。
 * 検被順: 東家→南家→西家→北家（親 = dealerViewIdx）。
 */
function buildDealSequence(
  dealerViewIdx: number,
  totalCounts: readonly [number, number, number, number],
): Array<readonly [number, number, number, number]> {
  const steps: Array<readonly [number, number, number, number]> = [];
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  // 3周 × 4枚ずつ
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 4; i++) {
      const vIdx = (dealerViewIdx + i) % 4;
      counts[vIdx] = Math.min(counts[vIdx] + 4, totalCounts[vIdx]);
      steps.push([...counts] as [number, number, number, number]);
    }
  }
  // 最終: 東家が 2 枚（1 枚ずつ）、他家が 1 枚ずつ
  const d = dealerViewIdx;
  for (let extra = 0; extra < 2; extra++) {
    if (counts[d] < totalCounts[d]) {
      counts[d]++;
      steps.push([...counts] as [number, number, number, number]);
    }
  }
  for (let i = 1; i < 4; i++) {
    const vIdx = (dealerViewIdx + i) % 4;
    if (counts[vIdx] < totalCounts[vIdx]) {
      counts[vIdx]++;
      steps.push([...counts] as [number, number, number, number]);
    }
  }
  return steps;
}

export function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const ruleConfig = (location.state as { ruleConfig?: RuleConfig } | null)?.ruleConfig
    ?? createDefaultRuleConfig();

  const {
    uiPhase,
    gameState,
    roundState,
    availableActions,
    selectedTileIndex,
    isPostMeldTurn,
    debugMode,
    debugSelectedWallTileKey,
    debugSelectedHandTileKey,
    debugTargetPlayer,
    roundStartKey,
    startCpuGame,
    selectTile,
    performAction,
    nextRound,
    toggleDebugMode,
    selectDebugWallTile,
    selectDebugHandTile,
    setDebugTargetPlayer,
    performDebugSwap,
    kickoffGameLoop,
  } = useGameStore();
  const { status: authStatus, profile } = useAuthStore();

  // ゲーム開始
  useEffect(() => {
    if (uiPhase === "idle") {
      startCpuGame(ruleConfig);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase, startCpuGame]);

  // ゲーム終了 → リザルト画面へ遷移
  // Zustand の set 完了 → React が uiPhase: "gameResult" でレンダーした後に
  // useEffect が発火することで、navigate 時点で gameResult が確実にセットされる
  useEffect(() => {
    if (uiPhase === "gameResult") {
      navigate("/result");
    }
  }, [uiPhase, navigate]);

  // === リーチモード ===
  const [riichiMode, setRiichiMode] = useState(false);
  /** リーチモードで選択中の手牌インデックス */
  const [riichiSelectedIndex, setRiichiSelectedIndex] = useState<number | undefined>(undefined);

  // リーチモード中の候補牌の手牌インデックス集合
  const riichiCandidateIndices = useMemo(() => {
    if (!riichiMode || !roundState) return undefined;
    const candidateTypes = getRiichiCandidateTileTypes(availableActions);
    if (candidateTypes.size === 0) return undefined;
    const views = buildPlayerViews(roundState, 0, debugMode);
    const selfView = views[0];
    const indices = new Set<number>();
    for (let i = 0; i < selfView.hand.length; i++) {
      if (candidateTypes.has(selfView.hand[i].type)) indices.add(i);
    }
    if (selfView.drawnTile && candidateTypes.has(selfView.drawnTile.type)) {
      indices.add(selfView.hand.length);
    }
    return indices;
  }, [riichiMode, roundState, availableActions, debugMode]);

  // 選択中の牌の待ち牌情報（リーチモード・通常打牌どちらでも計算）
  const activeWaitingIndex = riichiMode ? riichiSelectedIndex : selectedTileIndex;
  const riichiWaitingTiles: WaitingTileInfo[] | undefined = useMemo(() => {
    if (activeWaitingIndex === undefined || !roundState) return undefined;
    const views = buildPlayerViews(roundState, 0, debugMode, undefined, true, isPostMeldTurn);
    const selfView = views[0];
    const tile =
      activeWaitingIndex === selfView.hand.length ? selfView.drawnTile : selfView.hand[activeWaitingIndex];
    if (!tile) return undefined;
    return computeWaitingTiles(roundState, tile.type);
  }, [activeWaitingIndex, roundState, debugMode, isPostMeldTurn]);

  // フェーズが変わったらリーチモードを解除
  useEffect(() => {
    setRiichiMode(false);
    setRiichiSelectedIndex(undefined);
  }, [uiPhase]);

  // 配牌アニメーション
  const [dealRevealedCounts, setDealRevealedCounts] = useState<readonly [number, number, number, number] | null>(null);
  useEffect(() => {
    if (!roundState) return;
    // totalCounts: 実際の手牌枚数（東家=14、他家=13）
    const totalCounts = [0, 1, 2, 3].map(
      (i) => roundState.players[i].hand.getTiles().length
    ) as [number, number, number, number];
    const dealerViewIdx = roundState.dealerIndex;
    const sequence = buildDealSequence(dealerViewIdx, totalCounts);
    setDealRevealedCounts([0, 0, 0, 0]);
    const STEP_MS = 150;
    const ids: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((counts, idx) => {
      ids.push(setTimeout(() => setDealRevealedCounts(counts), STEP_MS * (idx + 1)));
    });
    // アニメーション完了: 表示をソート済みに戻し、ゲームループを起動
    ids.push(setTimeout(() => {
      setDealRevealedCounts(null);
      kickoffGameLoop();
    }, STEP_MS * (sequence.length + 1)));
    return () => { ids.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundStartKey]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (uiPhase !== "waitingHumanDraw") return;

      // リーチモード中: 1回目は選択、同じ牌を2回目でリーチ確定
      if (riichiMode && roundState) {
        if (riichiSelectedIndex === index) {
          // 確定: リーチアクション実行
          const views = buildPlayerViews(roundState, 0, debugMode, undefined, true, isPostMeldTurn);
          const selfView = views[0];
          const sortedTile =
            index === selfView.hand.length ? selfView.drawnTile : selfView.hand[index];
          if (sortedTile) {
            const match = availableActions.find(
              (a) => a.type === ActionType.Riichi && a.tile.type === sortedTile.type,
            );
            if (match) {
              setRiichiMode(false);
              setRiichiSelectedIndex(undefined);
              performAction(match);
            }
          }
        } else {
          // 選択（候補牌のみ — handRenderer でクリック制限済み）
          setRiichiSelectedIndex(index);
        }
        return;
      }

      if (selectedTileIndex === index) {
        // ダブルクリックで打牌
        const discardActions = availableActions.filter((a) => a.type === ActionType.Discard);
        // ソート済みUI手牌からindex番目の牌のtypeを取得して打牌
        const views = buildPlayerViews(roundState!, 0, debugMode, undefined, true, isPostMeldTurn);
        const selfView = views[0];
        const sortedTile =
          index === selfView.hand.length ? selfView.drawnTile : selfView.hand[index];
        if (sortedTile) {
          const match = discardActions.find(
            (a) => a.type === ActionType.Discard && a.tile.type === sortedTile.type,
          );
          if (match) {
            const isDrawnTile = index === selfView.hand.length;
            // sortedTile の type + id で正確な牌を特定（赤ドラと通常牌を区別）
            // ※id は種類ごとに 0-3 なのでグローバル一意でない。type と id 両方で照合する
            const handTiles = roundState!.players[0].hand.getTiles();
            const exactTile = handTiles.find((t) => t.type === sortedTile.type && t.id === sortedTile.id) ?? match.tile;
            const action = {
              ...match,
              tile: exactTile,
              isTsumogiri: isPostMeldTurn ? false : (isDrawnTile ? true : match.isTsumogiri),
            };
            performAction(action);
            return;
          }
        }
        selectTile(undefined);
      } else {
        selectTile(index);
      }
    },
    [
      uiPhase,
      riichiMode,
      riichiSelectedIndex,
      selectedTileIndex,
      availableActions,
      roundState,
      debugMode,
      isPostMeldTurn,
      performAction,
      selectTile,
    ],
  );

  const handleAction = useCallback(
    (type: string) => {
      if (type === ActionType.Skip) {
        performAction({ type: ActionType.Skip, playerIndex: 0 });
        return;
      }
      // リーチボタン: リーチモードに入る（待ち牌確認のため常に選択ステップを経由）
      if (type === ActionType.Riichi) {
        setRiichiMode(true);
        setRiichiSelectedIndex(undefined);
        selectTile(undefined);
        return;
      }
      const match = availableActions.find((a) => a.type === type);
      if (match) {
        performAction(match);
      }
    },
    [availableActions, performAction, selectTile],
  );

  const handleCancelRiichi = useCallback(() => {
    setRiichiMode(false);
    setRiichiSelectedIndex(undefined);
  }, []);

  // 局結果表示時に手牌を公開するプレイヤー
  const revealedPlayers = useMemo(() => {
    if (uiPhase !== "roundResult" || !roundState?.result) return undefined;
    const result = roundState.result;
    const indices = new Set<number>();
    if (result.reason === RoundEndReason.Win) {
      for (const win of result.wins) {
        indices.add(win.winnerIndex);
      }
    } else if (result.reason === RoundEndReason.ExhaustiveDraw) {
      result.tenpaiPlayers.forEach((isTenpai, i) => {
        if (isTenpai) indices.add(i);
      });
    }
    return indices.size > 0 ? indices : undefined;
  }, [uiPhase, roundState?.result]);

  // ロード中
  if (!roundState || !gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-emerald-900">
        <p className="text-white text-xl">読み込み中...</p>
      </div>
    );
  }

  const playerViews = dealRevealedCounts !== null
    ? buildPlayerViews(roundState, 0, debugMode, revealedPlayers, false)
    : buildPlayerViews(roundState, 0, debugMode, revealedPlayers, true, isPostMeldTurn);
  const selfPlayerName = authStatus === "authenticated"
    ? (profile?.displayName ?? "ゲスト")
    : "ゲスト";
  const playerNames = [selfPlayerName, "CPU", "CPU", "CPU"] as const;
  const actionOptions = buildActionOptions(availableActions);
  const doraIndicators: TileData[] = roundState.wall.getDoraIndicators().map((t) => ({
    type: t.type,
    id: t.id,
    isRedDora: t.isRedDora,
  }));

  const isWaiting = !debugMode && !dealRevealedCounts && (uiPhase === "waitingHumanDraw" || uiPhase === "waitingHumanAfterDiscard");

  return (
    <>
      <PixiGameBoard
        players={playerViews}
        roundWind={gameState.currentRound.roundWind}
        roundNumber={gameState.currentRound.roundNumber}
        honba={gameState.honba}
        riichiSticks={roundState.riichiSticks}
        remainingTiles={roundState.wall.remainingDrawCount}
        doraIndicators={doraIndicators}
        playerNames={playerNames}
        currentPlayer={roundState.activePlayerIndex}
        dealerIndex={roundState.dealerIndex}
        initialDealerIndex={gameState.initialDealerIndex}
        selectedTileIndex={isWaiting && !riichiMode ? selectedTileIndex : undefined}
        riichiSelectedIndex={isWaiting && riichiMode ? riichiSelectedIndex : undefined}
        riichiWaitingTiles={isWaiting ? riichiWaitingTiles : undefined}
        onTileClick={isWaiting ? handleTileClick : undefined}
        riichiCandidateIndices={isWaiting ? riichiCandidateIndices : undefined}
        revealedCounts={dealRevealedCounts ?? undefined}
        highlightLastDiscardPlayerIndex={
          !debugMode && uiPhase === "waitingHumanAfterDiscard"
            ? roundState.lastDiscardPlayerIndex
            : undefined
        }
        actionButtons={
          isWaiting ? (
            <ActionButtons
              actions={actionOptions}
              onAction={handleAction}
              riichiMode={riichiMode}
              onCancelRiichi={handleCancelRiichi}
            />
          ) : undefined
        }
      />

      {/* デバッグモード切替（開発環境のみ） */}
      {import.meta.env.DEV && (
        <button
          onClick={toggleDebugMode}
          className={`fixed top-2 right-2 text-xs px-2 py-1 rounded z-50 ${
            debugMode ? "bg-red-600 text-white" : "bg-gray-700/50 text-gray-300"
          }`}
        >
          {debugMode ? "DEBUG ON" : "DEBUG"}
        </button>
      )}

      {/* デバッグパネル */}
      {debugMode && roundState && (
        <DebugPanel
          round={roundState}
          targetPlayer={debugTargetPlayer}
          selectedWallTileKey={debugSelectedWallTileKey}
          selectedHandTileKey={debugSelectedHandTileKey}
          onSelectWallTile={selectDebugWallTile}
          onSelectHandTile={selectDebugHandTile}
          onSetTargetPlayer={setDebugTargetPlayer}
          onSwap={performDebugSwap}
        />
      )}

      {/* CPU思考中表示 */}
      {uiPhase === "cpuThinking" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm z-40">
          CPUが思考中...
        </div>
      )}

      {/* 局結果オーバーレイ */}
      {uiPhase === "roundResult" && roundState.result && (
        <RoundResultOverlay
          result={roundState.result}
          scores={gameState.scores}
          onNext={nextRound}
        />
      )}
    </>
  );
}
