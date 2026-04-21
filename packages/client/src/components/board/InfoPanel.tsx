import type { TileData } from "@/types";
import { TileView } from "@/components/tile/TileView";

interface InfoPanelProps {
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  remainingTiles: number;
  doraIndicators: readonly TileData[];
  scores: readonly number[];
  currentPlayer: number;
  dealerIndex?: number;
  playerNames?: readonly string[];
  seatLabels?: readonly string[];
}

const SEAT_WINDS = ["東", "南", "西", "北"] as const;

const WIND_LABELS: Record<string, string> = {
  ton: "東",
  nan: "南",
  sha: "西",
  pei: "北",
};

export function InfoPanel({
  roundWind,
  roundNumber,
  honba,
  riichiSticks,
  remainingTiles,
  doraIndicators,
  scores,
  currentPlayer,
  dealerIndex,
  playerNames,
  seatLabels = ["自家", "下家", "対面", "上家"],
}: InfoPanelProps) {
  const windLabel = WIND_LABELS[roundWind] ?? roundWind;

  return (
    <div className="bg-gray-900/80 rounded-lg p-3 text-white text-sm space-y-2 min-w-44">
      {/* Round info */}
      <div className="text-center font-bold text-base">
        {windLabel}
        {roundNumber}局 {honba > 0 && `${honba}本場`}
      </div>

      {/* Riichi sticks & remaining tiles */}
      <div className="flex justify-between text-xs text-gray-300">
        <span>供託: {riichiSticks * 1000}点</span>
        <span>残り: {remainingTiles}枚</span>
      </div>

      {/* Dora indicators */}
      <div>
        <span className="text-xs text-gray-400">ドラ表示牌</span>
        <div className="flex gap-0.5 mt-1">
          {doraIndicators.map((tile, i) => (
            <TileView key={i} tile={tile} size={22} />
          ))}
        </div>
      </div>

      {/* Scores */}
      <div className="space-y-0.5">
        {scores.map((score, i) => (
          <div
            key={i}
            className={`flex justify-between text-xs ${
              i === currentPlayer ? "text-yellow-300 font-bold" : "text-gray-300"
            }`}
          >
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {SEAT_WINDS[i]} - {playerNames?.[i] ?? seatLabels[i]}
              {dealerIndex === i && "(親)"}
            </span>
            <span className="shrink-0" style={{ marginLeft: 5 }}>
              {score.toLocaleString()}点
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
