import { useEffect, useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PixiGameBoard } from "@/components/board/PixiGameBoard";
import { ActionButtons } from "@/components/action/ActionButtons";
import { useOnlineGameStore } from "@/stores/onlineGameStore";
import { useOnlineRoomStore } from "@/stores/onlineRoomStore";
import {
  getOnlineRiichiCandidateTileTypes,
  computeOnlineWaitingTiles,
} from "@/utils/onlineViewConverter";
import type { OnlineWaitingTileInfo } from "@/utils/onlineViewConverter";
import type { RoundResultDto, GameResultDto } from "@mahjong-web/shared";

const SEAT_NAMES = ["自家", "下家", "対面", "上家"] as const;

const REASON_LABELS: Record<string, string> = {
  win: "和了",
  exhaustive_draw: "流局",
  kyuushu_kyuuhai: "九種九牌",
  suufonsu_renda: "四風子連打",
  suukaikan: "四開槓",
  suucha_riichi: "四家リーチ",
  triple_ron_draw: "トリプルロン流局",
  nagashi_mangan: "流し満貫",
};

export function OnlineGamePage() {
  const navigate = useNavigate();
  const {
    uiPhase,
    latestView,
    playerViews,
    doraIndicators,
    actionOptions,
    availableActions,
    selectedTileIndex,
    roundResult,
    gameResult,
    scores,
    error,
    setupGameListeners,
    selectTile,
    sendAction,
    acknowledgeRoundResult,
    reset,
  } = useOnlineGameStore();

  const roomReset = useOnlineRoomStore((s) => s.reset);

  useEffect(() => {
    setupGameListeners();
    return () => {
      reset();
    };
  }, [setupGameListeners, reset]);

  const mySeat = latestView?.mySeatIndex ?? 0;

  /** 絶対座席 → 相対座席 (0=自家, 1=下家, 2=対面, 3=上家) */
  const toRelative = useCallback(
    (absoluteSeat: number) => (absoluteSeat - mySeat + 4) % 4,
    [mySeat],
  );

  // === リーチモード ===
  const [riichiMode, setRiichiMode] = useState(false);
  const [riichiSelectedIndex, setRiichiSelectedIndex] = useState<number | undefined>(undefined);

  // リーチモード中の候補牌の手牌インデックス集合
  const riichiCandidateIndices = useMemo(() => {
    if (!riichiMode || !latestView) return undefined;
    const candidateTypes = getOnlineRiichiCandidateTileTypes(availableActions);
    if (candidateTypes.size === 0) return undefined;
    const selfView = playerViews[0];
    if (!selfView) return undefined;
    const indices = new Set<number>();
    for (let i = 0; i < selfView.hand.length; i++) {
      if (candidateTypes.has(selfView.hand[i].type)) indices.add(i);
    }
    if (selfView.drawnTile && candidateTypes.has(selfView.drawnTile.type)) {
      indices.add(selfView.hand.length);
    }
    return indices;
  }, [riichiMode, latestView, availableActions, playerViews]);

  // リーチモードで選択中の牌の待ち牌情報
  const riichiWaitingTiles: OnlineWaitingTileInfo[] | undefined = useMemo(() => {
    if (!riichiMode || riichiSelectedIndex === undefined || !latestView) return undefined;
    const selfView = playerViews[0];
    if (!selfView) return undefined;
    const tile =
      riichiSelectedIndex === selfView.hand.length ? selfView.drawnTile : selfView.hand[riichiSelectedIndex];
    if (!tile) return undefined;
    return computeOnlineWaitingTiles(latestView, tile.type);
  }, [riichiMode, riichiSelectedIndex, latestView, playerViews]);

  // フェーズが変わったらリーチモードを解除
  useEffect(() => {
    setRiichiMode(false);
    setRiichiSelectedIndex(undefined);
  }, [uiPhase]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (uiPhase !== "myTurn") return;

      // リーチモード中: 1回目は選択、同じ牌を2回目でリーチ確定
      if (riichiMode) {
        if (riichiSelectedIndex === index) {
          // 確定: リーチアクション実行
          const selfView = playerViews[0];
          if (!selfView) return;
          const sortedTile =
            index === selfView.hand.length ? selfView.drawnTile : selfView.hand[index];
          if (sortedTile) {
            const match = availableActions.find(
              (a) => a.type === "riichi" && a.tile?.type === sortedTile.type,
            );
            if (match) {
              setRiichiMode(false);
              setRiichiSelectedIndex(undefined);
              sendAction(match);
            }
          }
        } else {
          setRiichiSelectedIndex(index);
        }
        return;
      }

      if (selectedTileIndex === index) {
        // ダブルクリックで打牌
        const discardActions = availableActions.filter((a) => a.type === "discard");
        const selfView = playerViews[0];
        if (!selfView) return;
        const tile = index === selfView.hand.length ? selfView.drawnTile : selfView.hand[index];
        if (tile) {
          const match = discardActions.find((a) => a.tile?.type === tile.type);
          if (match) {
            sendAction(match);
            return;
          }
        }
        selectTile(undefined);
      } else {
        selectTile(index);
      }
    },
    [uiPhase, riichiMode, riichiSelectedIndex, selectedTileIndex, availableActions, playerViews, sendAction, selectTile],
  );

  const handleAction = useCallback(
    (type: string) => {
      if (type === "skip") {
        const skipAction = availableActions.find((a) => a.type === "skip");
        if (skipAction) sendAction(skipAction);
        return;
      }
      // リーチボタン: リーチモードに入る
      if (type === "riichi") {
        setRiichiMode(true);
        setRiichiSelectedIndex(undefined);
        selectTile(undefined);
        return;
      }
      const option = actionOptions.find((o) => o.type === type);
      if (option) {
        sendAction(option.dto);
      }
    },
    [availableActions, actionOptions, sendAction, selectTile],
  );

  const handleCancelRiichi = useCallback(() => {
    setRiichiMode(false);
    setRiichiSelectedIndex(undefined);
  }, []);

  const handleBackToLobby = useCallback(() => {
    reset();
    roomReset();
    navigate("/lobby");
  }, [reset, roomReset, navigate]);

  // ロード中 / エラー
  if (!latestView || playerViews.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-emerald-900">
        <p className="text-white text-xl">
          {error ? `エラー: ${error}` : "ゲーム開始待ち..."}
        </p>
      </div>
    );
  }

  const isMyTurn = uiPhase === "myTurn";
  const relativeCurrentPlayer = toRelative(latestView.activePlayerIndex);
  const relativeDealer = toRelative(latestView.dealerIndex);
  const relativeInitialDealer = toRelative(latestView.initialDealerIndex);
  const playerNames = ["", "", "", ""];
  playerNames[0] = latestView.self.playerName || "ゲスト";
  for (const opp of latestView.opponents) {
    const rel = toRelative(opp.seatIndex);
    playerNames[rel] = opp.playerName || "ゲスト";
  }

  return (
    <>
      <PixiGameBoard
        players={playerViews}
        roundWind={latestView.roundWind}
        roundNumber={latestView.roundNumber}
        honba={latestView.honba}
        riichiSticks={latestView.riichiSticks}
        remainingTiles={latestView.remainingTiles}
        doraIndicators={doraIndicators}
        playerNames={playerNames}
        currentPlayer={relativeCurrentPlayer}
        dealerIndex={relativeDealer}
        initialDealerIndex={relativeInitialDealer}
        selectedTileIndex={isMyTurn && !riichiMode ? selectedTileIndex : undefined}
        riichiSelectedIndex={isMyTurn && riichiMode ? riichiSelectedIndex : undefined}
        riichiWaitingTiles={isMyTurn && riichiMode ? riichiWaitingTiles : undefined}
        onTileClick={isMyTurn ? handleTileClick : undefined}
        riichiCandidateIndices={isMyTurn ? riichiCandidateIndices : undefined}
        actionButtons={
          isMyTurn ? (
            <ActionButtons
              actions={actionOptions}
              onAction={handleAction}
              riichiMode={riichiMode}
              onCancelRiichi={handleCancelRiichi}
            />
          ) : undefined
        }
      />

      {/* 相手ターン中の表示 */}
      {uiPhase === "playing" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm z-40">
          {SEAT_NAMES[relativeCurrentPlayer]}のターン
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm z-50">
          {error}
        </div>
      )}

      {/* 局結果 */}
      {uiPhase === "roundResult" && roundResult && (
        <OnlineRoundResultOverlay
          result={roundResult}
          scores={scores}
          toRelative={toRelative}
          onNext={acknowledgeRoundResult}
        />
      )}

      {/* 最終結果 */}
      {uiPhase === "gameResult" && gameResult && (
        <OnlineGameResultOverlay result={gameResult} onBack={handleBackToLobby} />
      )}
    </>
  );
}

// ===== 局結果オーバーレイ (DTO ベース) =====

function OnlineRoundResultOverlay({
  result,
  scores,
  toRelative,
  onNext,
}: {
  result: RoundResultDto;
  scores: readonly [number, number, number, number];
  toRelative: (absoluteSeat: number) => number;
  onNext: () => void;
}) {
  // scoreChanges を相対座席順に並べ替え
  const relScoreChanges = [0, 1, 2, 3].map((rel) => {
    // relativeToAbsolute: inverse of toRelative
    const abs = [0, 1, 2, 3].find((a) => toRelative(a) === rel) ?? 0;
    return result.scoreChanges[abs];
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-emerald-800 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center mb-4">
          {REASON_LABELS[result.reason] ?? result.reason}
        </h2>

        {/* 和了情報 */}
        {result.wins.length > 0 && (
          <div className="space-y-3 mb-4">
            {result.wins.map((win, i) => (
              <div key={i} className="bg-emerald-700/50 rounded-lg p-3">
                <div className="text-amber-400 font-bold">
                  {SEAT_NAMES[toRelative(win.winnerIndex)]}
                  {win.loserIndex !== undefined
                    ? ` ← ${SEAT_NAMES[toRelative(win.loserIndex)]}（ロン）`
                    : "（ツモ）"}
                </div>
                <div className="text-white text-sm mt-1">
                  {win.yakuList.map((y) => y.name).join("\u3000")}
                </div>
                <div className="text-emerald-300 text-sm">
                  {win.totalHan > 0 ? `${win.totalFu}符${win.totalHan}飜` : "役満"}
                  {" — "}
                  {win.payment.totalWinnerGain.toLocaleString()}点
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 流局テンパイ情報 */}
        {result.reason === "exhaustive_draw" && (
          <div className="text-emerald-300 text-center mb-4">
            テンパイ:{" "}
            {result.tenpaiPlayers
              .map((t, i) => (t ? SEAT_NAMES[toRelative(i)] : null))
              .filter(Boolean)
              .join("、") || "なし"}
          </div>
        )}

        {/* 得点変動 */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {scores.map((score, i) => (
            <div key={i} className="text-center">
              <div className="text-emerald-400 text-xs">{SEAT_NAMES[i]}</div>
              <div className="text-white font-bold">{score.toLocaleString()}</div>
              <div
                className={`text-sm ${
                  relScoreChanges[i] > 0
                    ? "text-green-400"
                    : relScoreChanges[i] < 0
                      ? "text-red-400"
                      : "text-gray-400"
                }`}
              >
                {relScoreChanges[i] > 0 ? "+" : ""}
                {relScoreChanges[i].toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          次へ
        </button>
      </div>
    </div>
  );
}

// ===== ゲーム最終結果オーバーレイ (DTO ベース) =====

function OnlineGameResultOverlay({
  result,
  onBack,
}: {
  result: GameResultDto;
  onBack: () => void;
}) {
  // rankings でソート (1位→4位)
  const sorted = result.rankings
    .map((rank, seat) => ({ seat, rank, score: result.finalScores[seat], point: result.finalPoints[seat], name: result.playerNames[seat] }))
    .sort((a, b) => a.rank - b.rank);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-emerald-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center mb-6">最終結果</h2>

        <div className="space-y-3 mb-6">
          {sorted.map((entry) => (
            <div
              key={entry.seat}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                entry.rank === 1 ? "bg-amber-700/50" : "bg-emerald-700/50"
              }`}
            >
              <span
                className={`text-2xl font-bold w-8 text-center ${
                  entry.rank === 1 ? "text-amber-400" : "text-emerald-300"
                }`}
              >
                {entry.rank}
              </span>
              <span className="text-white font-bold flex-1">{entry.name}</span>
              <div className="text-right">
                <div className="text-white font-bold">
                  {entry.score.toLocaleString()}点
                </div>
                <div
                  className={`text-sm ${
                    entry.point > 0
                      ? "text-green-400"
                      : entry.point < 0
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  {entry.point > 0 ? "+" : ""}
                  {entry.point.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onBack}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          ロビーに戻る
        </button>
      </div>
    </div>
  );
}
