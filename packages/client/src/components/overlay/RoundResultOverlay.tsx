import type { RoundResult } from "@mahjong-web/domain";
import { RoundEndReason, Yaku, sortTiles } from "@mahjong-web/domain";
import { RoundResultTile } from "@/components/tile/RoundResultTile";
import { toTileData, toMeldView } from "@/utils/viewConverter";

interface RoundResultOverlayProps {
  result: RoundResult;
  scores: readonly [number, number, number, number];
  onNext: () => void;
}

const SEAT_NAMES = ["自家", "下家", "対面", "上家"] as const;

const REASON_LABELS: Record<string, string> = {
  [RoundEndReason.Win]: "和了",
  [RoundEndReason.ExhaustiveDraw]: "流局",
  [RoundEndReason.KyuushuKyuuhai]: "九種九牌",
  [RoundEndReason.SuufonsuRenda]: "四風子連打",
  [RoundEndReason.Suukaikan]: "四開槓",
  [RoundEndReason.SuuchaRiichi]: "四家リーチ",
  [RoundEndReason.TripleRonDraw]: "トリプルロン流局",
  [RoundEndReason.NagashiMangan]: "流し満貫",
};

const YAKU_NAMES: Record<string, string> = {
  [Yaku.Riichi]: "リーチ",
  [Yaku.Ippatsu]: "一発",
  [Yaku.MenzenTsumo]: "門前清自摸和",
  [Yaku.Tanyao]: "断么九",
  [Yaku.Pinfu]: "平和",
  [Yaku.Iipeiko]: "一盃口",
  [Yaku.YakuhaiRoundWind]: "場風",
  [Yaku.YakuhaiSeatWind]: "自風",
  [Yaku.YakuhaiHaku]: "白",
  [Yaku.YakuhaiHatsu]: "發",
  [Yaku.YakuhaiChun]: "中",
  [Yaku.Haitei]: "海底摸月",
  [Yaku.Houtei]: "河底撈魚",
  [Yaku.Rinshan]: "嶺上開花",
  [Yaku.Chankan]: "搶槓",
  [Yaku.DoubleRiichi]: "ダブルリーチ",
  [Yaku.Chiitoitsu]: "七対子",
  [Yaku.Toitoi]: "対々和",
  [Yaku.Sanankou]: "三暗刻",
  [Yaku.SanshokuDoukou]: "三色同刻",
  [Yaku.SanshokuDoujun]: "三色同順",
  [Yaku.Ikkitsuukan]: "一気通貫",
  [Yaku.Chanta]: "混全帯么九",
  [Yaku.Sankantsu]: "三槓子",
  [Yaku.Shousangen]: "小三元",
  [Yaku.Honroutou]: "混老頭",
  [Yaku.Ryanpeiko]: "二盃口",
  [Yaku.Junchan]: "純全帯么九",
  [Yaku.Honitsu]: "混一色",
  [Yaku.Chinitsu]: "清一色",
  [Yaku.Tenhou]: "天和",
  [Yaku.Chiihou]: "地和",
  [Yaku.Kokushi]: "国士無双",
  [Yaku.KokushiJuusanmen]: "国士無双十三面待ち",
  [Yaku.Suuankou]: "四暗刻",
  [Yaku.SuuankouTanki]: "四暗刻単騎待ち",
  [Yaku.Daisangen]: "大三元",
  [Yaku.Tsuuiisou]: "字一色",
  [Yaku.Ryuuiisou]: "緑一色",
  [Yaku.Shousuushii]: "小四喜",
  [Yaku.Daisuushii]: "大四喜",
  [Yaku.Chinroutou]: "清老頭",
  [Yaku.ChuurenPoutou]: "九蓮宝燈",
  [Yaku.JunseiChuuren]: "純正九蓮宝燈",
  [Yaku.Suukantsu]: "四槓子",
  [Yaku.Renhou]: "人和",
};

export function RoundResultOverlay({ result, scores, onNext }: RoundResultOverlayProps) {
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
              const winCtx = win.winContext;
              const winTileData = toTileData(winCtx.winTile);

              // 手牌から和了牌を除いた閉じた手牌をソートして表示
              const rawHand = winCtx.handTiles;
              const winTileRawIdx = rawHand.map((t, idx) => ({ t, idx }))
                .filter(({ t }) => t.id === winCtx.winTile.id)
                .at(-1)?.idx;
              const nonWinRaw = winTileRawIdx !== undefined
                ? rawHand.filter((_, idx) => idx !== winTileRawIdx)
                : rawHand.slice(0, rawHand.length - 1);
              const nonWinTiles = sortTiles([...nonWinRaw]).map(toTileData);

              // 副露を盤面と同じ並びに変換（calledTileIndex で横倒し位置を取得）
              const meldViews = winCtx.melds.map((m) => toMeldView(m, win.winnerIndex));

              const yakuNames = win.scoreResult.judgeResult.yakuList
                .map((y) => YAKU_NAMES[y.yaku] ?? y.yaku);
              const yakuHan = win.scoreResult.judgeResult.yakuList
                .reduce((sum, y) => sum + y.han, 0);
              const doraHan = win.scoreResult.judgeResult.totalHan - yakuHan;
              if (doraHan > 0) yakuNames.push(`ドラ${doraHan}`);

              return (
                <div key={i} className="bg-emerald-700/50 rounded-lg p-3">
                  <div className="text-amber-400 font-bold">
                    {SEAT_NAMES[win.winnerIndex]}
                    {win.loserIndex !== undefined
                      ? ` ← ${SEAT_NAMES[win.loserIndex]}（ロン）`
                      : "（ツモ）"}
                  </div>

                  {/* 手牌 */}
                  <div className="flex flex-wrap items-end gap-0 mt-2">
                    {nonWinTiles.map((tile, idx) => (
                      <RoundResultTile key={`hand-${idx}`} tile={tile} size={28} />
                    ))}
                    {/* 和了牌（アンバーでハイライト） */}
                    <RoundResultTile tile={winTileData} size={28} highlighted className="ml-2" />
                    {[...meldViews].reverse().map((meldView, mi) => (
                      <span key={`meld-${mi}`} className="flex items-end gap-0 ml-2">
                        {meldView.tiles.map((tile, ti) => (
                          <RoundResultTile
                            key={`meld-${mi}-${ti}`}
                            tile={tile}
                            size={28}
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
                    {win.scoreResult.totalHan > 0
                      ? `${win.scoreResult.totalFu}符${win.scoreResult.totalHan}飜`
                      : "役満"}
                    {" — "}
                    {win.scoreResult.payment.totalWinnerGain.toLocaleString()}点
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 流局テンパイ情報 */}
        {result.reason === RoundEndReason.ExhaustiveDraw && (
          <div className="text-emerald-300 text-center mb-4">
            テンパイ:{" "}
            {result.tenpaiPlayers
              .map((t, i) => (t ? SEAT_NAMES[i] : null))
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
                  result.scoreChanges[i] > 0
                    ? "text-green-400"
                    : result.scoreChanges[i] < 0
                      ? "text-red-400"
                      : "text-gray-400"
                }`}
              >
                {result.scoreChanges[i] > 0 ? "+" : ""}
                {result.scoreChanges[i].toLocaleString()}
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
