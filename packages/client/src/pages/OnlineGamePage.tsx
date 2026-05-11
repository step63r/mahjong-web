import { useEffect, useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PixiGameBoard } from "@/components/board/PixiGameBoard";
import { ActionButtons } from "@/components/action/ActionButtons";
import { useOnlineGameStore } from "@/stores/onlineGameStore";
import { useOnlineRoomStore } from "@/stores/onlineRoomStore";
import {
  getOnlineRiichiCandidateTileTypes,
  computeOnlineWaitingTiles,
  gameViewToPlayerViews,
} from "@/utils/onlineViewConverter";
import type { OnlineWaitingTileInfo } from "@/utils/onlineViewConverter";
import type { RoundResultDto, GameResultDto } from "@mahjong-web/shared";
import { RoundResultTile } from "@/components/tile/RoundResultTile";
import { sortTiles } from "@mahjong-web/domain";

const SEAT_NAMES = ["自家", "下家", "対面", "上家"] as const;

// ===== 配牌シーケンスヘルパー =====

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

const YAKU_NAMES: Record<string, string> = {
  "riichi": "リーチ",
  "ippatsu": "一発",
  "menzen-tsumo": "門前清自摸和",
  "tanyao": "断么九",
  "pinfu": "平和",
  "iipeiko": "一盃口",
  "yakuhai-round-wind": "場風",
  "yakuhai-seat-wind": "自風",
  "yakuhai-haku": "白",
  "yakuhai-hatsu": "發",
  "yakuhai-chun": "中",
  "haitei": "海底摸月",
  "houtei": "河底撈魚",
  "rinshan": "嶺上開花",
  "chankan": "搶槓",
  "double-riichi": "ダブルリーチ",
  "chiitoitsu": "七対子",
  "toitoi": "対々和",
  "sanankou": "三暗刻",
  "sanshoku-doukou": "三色同刻",
  "sanshoku-doujun": "三色同順",
  "ikkitsuukan": "一気通貫",
  "chanta": "混全帯么九",
  "sankantsu": "三槓子",
  "shousangen": "小三元",
  "honroutou": "混老頭",
  "ryanpeiko": "二盃口",
  "junchan": "純全帯么九",
  "honitsu": "混一色",
  "chinitsu": "清一色",
  "tenhou": "天和",
  "chiihou": "地和",
  "kokushi": "国士無双",
  "kokushi-juusanmen": "国士無双十三面待ち",
  "suuankou": "四暗刻",
  "suuankou-tanki": "四暗刻単騎待ち",
  "daisangen": "大三元",
  "tsuuiisou": "字一色",
  "ryuuiisou": "緑一色",
  "shousuushii": "小四喜",
  "daisuushii": "大四喜",
  "chinroutou": "清老頭",
  "chuuren-poutou": "九蓮宝燈",
  "junsei-chuuren": "純正九蓮宝燈",
  "suukantsu": "四槓子",
  "renhou": "人和",
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
    isPostMeldTurn,
    roundStartKey,
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

  // 選択中の牌の待ち牌情報（リーチモード・通常打牌どちらでも計算）
  const activeWaitingIndex = riichiMode ? riichiSelectedIndex : selectedTileIndex;
  const riichiWaitingTiles: OnlineWaitingTileInfo[] | undefined = useMemo(() => {
    if (activeWaitingIndex === undefined || !latestView) return undefined;
    const selfView = playerViews[0];
    if (!selfView) return undefined;
    const tile =
      activeWaitingIndex === selfView.hand.length ? selfView.drawnTile : selfView.hand[activeWaitingIndex];
    if (!tile) return undefined;
    return computeOnlineWaitingTiles(latestView, tile.type);
  }, [activeWaitingIndex, latestView, playerViews]);

  // フェーズが変わったらリーチモードを解除
  useEffect(() => {
    setRiichiMode(false);
    setRiichiSelectedIndex(undefined);
  }, [uiPhase]);

  // 配牌アニメーション
  const [dealRevealedCounts, setDealRevealedCounts] = useState<readonly [number, number, number, number] | null>(null);
  useEffect(() => {
    if (!latestView || playerViews.length === 0) return;
    const mySeat = latestView.mySeatIndex;
    const dealerViewIdx = (latestView.dealerIndex - mySeat + 4) % 4;
    const totalCounts = [0, 1, 2, 3].map(
      (i) => playerViews[i].hand.length + (playerViews[i].drawnTile ? 1 : 0)
    ) as [number, number, number, number];
    const sequence = buildDealSequence(dealerViewIdx, totalCounts);
    setDealRevealedCounts([0, 0, 0, 0]);
    const STEP_MS = 150;
    const ids: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((counts, idx) => {
      ids.push(setTimeout(() => setDealRevealedCounts(counts), STEP_MS * (idx + 1)));
    });
    ids.push(setTimeout(() => setDealRevealedCounts(null), STEP_MS * (sequence.length + 1)));
    return () => { ids.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundStartKey]);

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
            const isDrawnTile = index === selfView.hand.length;
            // tile の type + id で正確な牌を特定（赤ドラと通常牌を区別）
            // ※id は種類ごとに 0-3 なのでグローバル一意でない
            const action = {
              ...match,
              tile: { type: tile.type, id: tile.id, isRedDora: tile.isRedDora },
              isTsumogiri: isPostMeldTurn ? false : (isDrawnTile ? true : match.isTsumogiri),
            };
            sendAction(action);
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

  // アニメーション中は配牌順（未ソート）ビューを使用
  const displayPlayerViews = dealRevealedCounts !== null
    ? gameViewToPlayerViews(latestView, false)
    : playerViews;

  return (
    <>
      <PixiGameBoard
        players={displayPlayerViews}
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
        riichiWaitingTiles={isMyTurn ? riichiWaitingTiles : undefined}
        onTileClick={isMyTurn ? handleTileClick : undefined}
        riichiCandidateIndices={isMyTurn ? riichiCandidateIndices : undefined}
        revealedCounts={dealRevealedCounts ?? undefined}
        highlightLastDiscardPlayerIndex={(() => {
          if (!isMyTurn || latestView.lastDiscardPlayerIndex === undefined) return undefined;
          const hasMeldAction = latestView.availableActions.some(
            (a) => a.type === "pon" || a.type === "chi" || a.type === "ron" || a.type === "minkan",
          );
          return hasMeldAction ? toRelative(latestView.lastDiscardPlayerIndex) : undefined;
        })()}
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

  const hasRiichiWin = result.wins.some(
    (w) => w.yakuList.some((y) => y.name === "riichi" || y.name === "double-riichi"),
  );
  const extra = result as RoundResultDto & {
    doraIndicators?: Array<{ type: string; id: number; isRedDora: boolean }>;
    uraDoraIndicators?: Array<{ type: string; id: number; isRedDora: boolean }>;
  };
  const doraIndicators = extra.doraIndicators ?? [];
  const uraDoraIndicators = extra.uraDoraIndicators ?? [];
  const mergedIndicators = hasRiichiWin
    ? [...doraIndicators, ...uraDoraIndicators]
    : doraIndicators;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-emerald-800 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center mb-4">
          {REASON_LABELS[result.reason] ?? result.reason}
        </h2>

        {/* 和了情報 */}
        {result.wins.length > 0 && (
          <div className="space-y-3 mb-4">
            {result.wins.map((win, i) => {
              // 手牌の表示（handTiles は和了牌を含む14枚）
              const winTile = win.winTile;
              const winTileIdx = win.handTiles.map((t, idx) => ({ t, idx }))
                .filter(({ t }) => t.id === winTile.id)
                .at(-1)?.idx;
              const nonWinRaw = winTileIdx !== undefined
                ? win.handTiles.filter((_, idx) => idx !== winTileIdx)
                : win.handTiles.slice(0, win.handTiles.length - 1);
              // TileDto を Tile として扱ってソート（構造互換）
              const nonWinTiles = sortTiles(nonWinRaw as Parameters<typeof sortTiles>[0]);

              // 副露を盤面と同じ並びに変換（calledTileIndex で横倒し位置を決定）
              const meldViews = win.melds.map((m) => {
                if (m.type === "ankan" || !m.calledTile || m.fromPlayerIndex === undefined) {
                  return { tiles: m.tiles, calledTileIndex: undefined, meldType: m.type };
                }
                const relative = (m.fromPlayerIndex - win.winnerIndex + 4) % 4;
                const calledTile = m.calledTile;
                const ownTiles = m.tiles.filter(
                  (t) => !(t.type === calledTile.type && t.id === calledTile.id),
                );
                if (relative === 3) {
                  return { tiles: [calledTile, ...ownTiles], calledTileIndex: 0, meldType: m.type };
                } else if (relative === 2) {
                  if (m.type === "minkan" || m.type === "kakan") {
                    return {
                      tiles: [ownTiles[0], calledTile, ownTiles[1], ownTiles[2]],
                      calledTileIndex: 1,
                      meldType: m.type,
                    };
                  }
                  return {
                    tiles: [ownTiles[0], calledTile, ownTiles[1]],
                    calledTileIndex: 1,
                    meldType: m.type,
                  };
                } else {
                  const tiles = [...ownTiles, calledTile];
                  return { tiles, calledTileIndex: tiles.length - 1, meldType: m.type };
                }
              });

              const yakuNames = win.yakuList.map((y) => YAKU_NAMES[y.name] ?? y.name);
              const yakuHan = win.yakuList.reduce((sum, y) => sum + y.han, 0);
              const doraHan = win.totalHan - yakuHan;
              if (doraHan > 0) yakuNames.push(`ドラ${doraHan}`);

              return (
                <div key={i} className="bg-emerald-700/50 rounded-lg p-3">
                  <div className="text-amber-400 font-bold">
                    {SEAT_NAMES[toRelative(win.winnerIndex)]}
                    {win.loserIndex !== undefined
                      ? ` ← ${SEAT_NAMES[toRelative(win.loserIndex)]}（ロン）`
                      : "（ツモ）"}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-emerald-400 whitespace-nowrap text-sm">ドラ</span>
                    <div className="flex gap-0">
                      {mergedIndicators.map((tile, di) => (
                        <RoundResultTile key={`dora-${di}`} tile={tile} size={24} />
                      ))}
                    </div>
                  </div>

                  {/* 手牌 */}
                  <div className="flex flex-wrap items-end gap-0 mt-2">
                    {nonWinTiles.map((tile, idx) => (
                      <RoundResultTile key={`hand-${idx}`} tile={tile} size={28} />
                    ))}
                    {/* 和了牌（アンバーでハイライト） */}
                    <RoundResultTile tile={winTile} size={28} highlighted className="ml-2" />
                    {[...meldViews].reverse().map((meldView, mi) => (
                      <span key={`meld-${mi}`} className="flex items-end gap-0 ml-2">
                        {meldView.tiles.map((tile, ti) => (
                          <RoundResultTile
                            key={`meld-${mi}-${ti}`}
                            tile={tile}
                            size={28}
                            faceDown={
                              meldView.meldType === "ankan"
                              && (ti === 0 || ti === meldView.tiles.length - 1)
                            }
                            rotated={ti === meldView.calledTileIndex}
                          />
                        ))}
                      </span>
                    ))}
                  </div>

                  <div className="text-white text-sm mt-2">
                    {yakuNames.join("\u3000")}
                  </div>
                  <div className="text-emerald-300 text-sm">
                    {win.totalHan > 0 ? `${win.totalFu}符${win.totalHan}飜` : "役満"}
                    {" — "}
                    {win.payment.totalWinnerGain.toLocaleString()}点
                  </div>
                </div>
              );
            })}
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
