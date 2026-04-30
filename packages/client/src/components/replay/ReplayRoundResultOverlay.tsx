/**
 * 牌譜再生用 局結果オーバーレイ
 */
import type { ReplayRoundResult } from "@/utils/replayConverter";

interface ReplayRoundResultOverlayProps {
  result: ReplayRoundResult;
  playerNames: readonly string[];
  onNext: () => void;
  isLastRound: boolean;
}

const WIND_LABELS = ["東", "南", "西", "北"];

export function ReplayRoundResultOverlay({
  result,
  playerNames,
  onNext,
  isLastRound,
}: ReplayRoundResultOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 min-w-[280px] max-w-sm w-full shadow-2xl">
        {/* 局結果見出し */}
        <h2 className="text-white text-lg font-bold text-center mb-4">
          {formatReason(result.reason)}
        </h2>

        {/* 得点変動 */}
        <div className="space-y-2 mb-6">
          {result.scoreChanges.map((delta, i) => {
            if (delta === 0) return null;
            const sign = delta > 0 ? "+" : "";
            return (
              <div key={i} className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">
                  {playerNames[i] ?? `プレイヤー${i + 1}`}
                </span>
                <span
                  className={
                    delta > 0
                      ? "text-yellow-300 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                >
                  {sign}
                  {delta.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* テンパイプレイヤー（流局時） */}
        {result.reason === "ryukyoku" && (
          <div className="mb-4 text-sm text-gray-400 text-center">
            テンパイ:{" "}
            {result.tenpaiPlayers
              .map((t, i) => (t ? WIND_LABELS[i] : null))
              .filter(Boolean)
              .join(" ・ ") || "なし"}
          </div>
        )}

        {/* ナビゲーションボタン */}
        <button
          onClick={onNext}
          className="w-full py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors"
        >
          {isLastRound ? "対局結果へ" : "次の局へ"}
        </button>
      </div>
    </div>
  );
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    tsumo: "ツモ和了",
    ron: "ロン和了",
    ryukyoku: "流局",
    kyuushu_kyuuhai: "九種九牌",
    suufon_renta: "四風子連打",
    suukan: "四開槓",
    suuriichi: "四人リーチ",
    nagashi_mangan: "流し満貫",
  };
  return map[reason] ?? reason;
}
