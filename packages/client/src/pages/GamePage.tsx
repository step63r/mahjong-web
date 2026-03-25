import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GameBoard } from "@/components/board/GameBoard";
import { ActionButtons } from "@/components/action/ActionButtons";
import { RoundResultOverlay } from "@/components/overlay/RoundResultOverlay";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { useGameStore } from "@/stores/gameStore";
import { buildPlayerViews, buildActionOptions } from "@/utils/viewConverter";
import { ActionType } from "@mahjong-web/domain";
import type { TileData } from "@/types";

export function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const gameLength = (location.state as { gameLength?: string } | null)?.gameLength ?? "hanchan";

  const {
    uiPhase,
    gameState,
    roundState,
    availableActions,
    selectedTileIndex,
    debugMode,
    startCpuGame,
    selectTile,
    performAction,
    nextRound,
    toggleDebugMode,
  } = useGameStore();

  // ゲーム開始
  useEffect(() => {
    if (uiPhase === "idle") {
      startCpuGame(gameLength as "tonpu" | "hanchan");
    }
  }, [uiPhase, gameLength, startCpuGame]);

  // ゲーム終了 → リザルト画面へ遷移
  useEffect(() => {
    if (uiPhase === "gameResult") {
      navigate("/result");
    }
  }, [uiPhase, navigate]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (uiPhase !== "waitingHumanDraw") return;

      if (selectedTileIndex === index) {
        // ダブルクリックで打牌
        const discardActions = availableActions.filter((a) => a.type === ActionType.Discard);
        // ソート済みUI手牌からindex番目の牌のtypeを取得して打牌
        const views = buildPlayerViews(roundState!, 0, debugMode);
        const selfView = views[0];
        const sortedTile =
          index === selfView.hand.length ? selfView.drawnTile : selfView.hand[index];
        if (sortedTile) {
          const match = discardActions.find(
            (a) => a.type === ActionType.Discard && a.tile.type === sortedTile.type,
          );
          if (match) {
            performAction(match);
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
      selectedTileIndex,
      availableActions,
      roundState,
      debugMode,
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
      const match = availableActions.find((a) => a.type === type);
      if (match) {
        performAction(match);
      }
    },
    [availableActions, performAction],
  );

  // ロード中
  if (!roundState || !gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-emerald-900">
        <p className="text-white text-xl">読み込み中...</p>
      </div>
    );
  }

  const playerViews = buildPlayerViews(roundState, 0, debugMode);
  const actionOptions = buildActionOptions(availableActions);
  const doraIndicators: TileData[] = roundState.wall.getDoraIndicators().map((t) => ({
    type: t.type,
    id: t.id,
    isRedDora: t.isRedDora,
  }));

  const isWaiting = uiPhase === "waitingHumanDraw" || uiPhase === "waitingHumanAfterDiscard";

  return (
    <>
      <GameBoard
        players={playerViews}
        roundWind={gameState.currentRound.roundWind}
        roundNumber={gameState.currentRound.roundNumber}
        honba={gameState.honba}
        riichiSticks={roundState.riichiSticks}
        remainingTiles={roundState.wall.remainingDrawCount}
        doraIndicators={doraIndicators}
        currentPlayer={roundState.activePlayerIndex}
        dealerIndex={roundState.dealerIndex}
        selectedTileIndex={isWaiting ? selectedTileIndex : undefined}
        onTileClick={isWaiting ? handleTileClick : undefined}
        actionButtons={
          isWaiting ? <ActionButtons actions={actionOptions} onAction={handleAction} /> : undefined
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
      {debugMode && roundState && <DebugPanel round={roundState} />}

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
