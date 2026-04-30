/**
 * 牌譜再生ページ
 * URL: /replay?gameId=xxx
 */
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PixiGameBoard } from "@/components/board/PixiGameBoard";
import { ReplayControls } from "@/components/replay/ReplayControls";
import { ReplayRoundResultOverlay } from "@/components/replay/ReplayRoundResultOverlay";
import { useReplayStore } from "@/stores/replayStore";

const WIND_LABELS: Record<string, string> = {
  "1": "東",
  "2": "南",
  "3": "西",
  "4": "北",
};

function roundLabel(wind: string, number: number, honba: number): string {
  const w = WIND_LABELS[wind] ?? wind;
  return `${w}${number}局${honba > 0 ? `${honba}本場` : ""}`;
}

export function ReplayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const {
    roundSummaries,
    roundIndex: currentRoundIndex,
    snapshots,
    eventIndex: currentSnapshotIndex,
    isLoading,
    error,
    loadGame,
    loadRound,
    stepForward,
    stepBackward,
    jumpTo,
    prevRound,
    nextRound,
    reset,
  } = useReplayStore();

  // ゲームロード
  useEffect(() => {
    if (!gameId) return;
    void loadGame(gameId);
    return () => {
      reset();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const snapshot = snapshots?.[currentSnapshotIndex];

  // 次・前の局が存在するか
  const hasPrevRound = useMemo(() => {
    if (!roundSummaries) return false;
    return roundSummaries.slice(0, currentRoundIndex).some((s) => s.hasReplay);
  }, [roundSummaries, currentRoundIndex]);

  const hasNextRound = useMemo(() => {
    if (!roundSummaries) return false;
    return roundSummaries.slice(currentRoundIndex + 1).some((s) => s.hasReplay);
  }, [roundSummaries, currentRoundIndex]);

  const isLastRound = !hasNextRound;

  // プレイヤー名（牌譜データからは取れないのでシート番号で代替）
  const playerNames: readonly string[] = ["自分", "下家", "対面", "上家"];

  // 局結果オーバーレイを表示するか（最後のスナップショットかつ round_result 型）
  const showRoundResult =
    snapshot?.eventType === "round_result" && snapshot.roundResult != null;

  // 次の局へ or 終了
  const handleResultNext = () => {
    if (isLastRound) {
      navigate(-1);
    } else {
      nextRound();
    }
  };

  // ===== ローディング / エラー =====
  if (isLoading) {
    return (
      <div className="min-h-screen bg-emerald-900 text-white flex items-center justify-center">
        <p className="text-xl animate-pulse">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-emerald-900 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-rose-300 text-lg">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg"
        >
          戻る
        </button>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-emerald-900 text-white flex items-center justify-center">
        <p>牌譜データがありません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-900 text-white flex flex-col items-center">
      {/* ヘッダー */}
      <div className="w-full flex items-center justify-between px-4 py-2 bg-emerald-950/80">
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-3 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition-colors"
        >
          ← 戻る
        </button>
        <h1 className="text-base font-bold">牌譜再生</h1>
        <div className="w-16" />
      </div>

      {/* 局タブ */}
      {roundSummaries && roundSummaries.length > 0 && (
        <div className="flex gap-1 px-3 py-2 overflow-x-auto w-full bg-emerald-950/60">
          {roundSummaries.map((s, i) => (
            <button
              key={s.roundId}
              onClick={() => {
                if (s.hasReplay) void loadRound(i);
              }}
              disabled={!s.hasReplay}
              className={[
                "whitespace-nowrap text-xs px-3 py-1 rounded transition-colors",
                i === currentRoundIndex
                  ? "bg-amber-600 text-white font-bold"
                  : s.hasReplay
                  ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                  : "bg-emerald-900 text-emerald-500 cursor-not-allowed",
              ].join(" ")}
            >
              {roundLabel(String(s.roundWind), s.roundNumber, s.honba)}
            </button>
          ))}
        </div>
      )}

      {/* 盤面 */}
      <div className="relative flex-1 flex items-center justify-center w-full">
        <PixiGameBoard
          players={snapshot.players}
          roundWind={snapshot.roundWind}
          roundNumber={snapshot.roundNumber}
          honba={snapshot.honba}
          riichiSticks={snapshot.riichiSticks}
          remainingTiles={snapshot.remainingTiles}
          doraIndicators={snapshot.doraIndicators}
          playerNames={playerNames}
          currentPlayer={snapshot.activePlayerIndex}
          dealerIndex={snapshot.dealerIndex}
          actionButtons={
            <ReplayControls
              currentIndex={currentSnapshotIndex}
              total={snapshots!.length}
              eventType={snapshot.eventType}
              onPrev={stepBackward}
              onNext={stepForward}
              onJump={jumpTo}
              onPrevRound={prevRound}
              onNextRound={nextRound}
              hasPrevRound={hasPrevRound}
              hasNextRound={hasNextRound}
            />
          }
        />

        {/* 局結果オーバーレイ */}
        {showRoundResult && snapshot.roundResult && (
          <ReplayRoundResultOverlay
            result={snapshot.roundResult}
            playerNames={playerNames}
            onNext={handleResultNext}
            isLastRound={isLastRound}
          />
        )}
      </div>
    </div>
  );
}
