/**
 * PixiInfoPanel — 盤面中央の情報パネル（HTML オーバーレイ）
 *
 * GUI 仕様: 2.5D 表示不要、HTML オーバーレイで表示。
 * 1 辺 = 6 × tileW の正方形。各辺にプレイヤー得点を配置し、
 * 中央に局情報・ドラ表示牌を表示する。
 */
import { TileView } from "../tile/TileView";
import type { TileData } from "../../types";

const WIND_LABELS: Record<string, string> = {
  ton: "東",
  nan: "南",
  sha: "西",
  pei: "北",
};

const SEAT_WINDS = ["東", "南", "西", "北"];

export interface PixiInfoPanelProps {
  left: number;
  top: number;
  size: number;
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  remainingTiles: number;
  doraIndicators: readonly TileData[];
  scores: readonly number[];
  currentPlayer: number;
  dealerIndex?: number;
}

export function PixiInfoPanel({
  left,
  top,
  size,
  roundWind,
  roundNumber,
  honba,
  riichiSticks,
  remainingTiles,
  doraIndicators,
  scores,
  currentPlayer,
  dealerIndex,
}: PixiInfoPanelProps) {
  const windLabel = WIND_LABELS[roundWind] ?? roundWind;
  const barH = Math.round(size * 0.14);
  const fontSize = Math.max(10, Math.round(size * 0.06));
  const tileSz = Math.max(16, Math.round(size * 0.1));

  const scoreBar = (idx: number) => {
    const isDealer = dealerIndex === idx;
    const isCurrent = currentPlayer === idx;
    return (
      <div
        className={`flex items-center justify-between px-2 whitespace-nowrap ${
          isDealer ? "bg-amber-600/50" : ""
        }`}
        style={{ height: barH, fontSize, lineHeight: `${barH}px` }}
      >
        <span
          className={
            isCurrent ? "text-yellow-300 font-bold" : "text-gray-200"
          }
        >
          {SEAT_WINDS[idx]}
        </span>
        <span
          className={
            isCurrent ? "text-yellow-300 font-bold" : "text-white"
          }
        >
          {scores[idx]?.toLocaleString()}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        pointerEvents: "none",
      }}
      className="bg-gray-900/80 rounded text-white overflow-hidden"
    >
      {/* 上辺: 対面 (180° 回転) */}
      <div style={{ transform: "rotate(180deg)" }}>{scoreBar(2)}</div>

      {/* 中段: 上家 | 中央情報 | 下家 */}
      <div className="flex" style={{ height: size - barH * 2 }}>
        {/* 左辺: 上家 (90° 反時計回り) */}
        <div style={{ width: barH, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: size - barH * 2,
              transform: "translate(-50%, -50%) rotate(-90deg)",
            }}
          >
            {scoreBar(3)}
          </div>
        </div>

        {/* 中央: 局情報 + ドラ */}
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5 overflow-hidden">
          <div
            style={{ fontSize: Math.max(12, Math.round(size * 0.08)) }}
            className="font-bold leading-tight"
          >
            {windLabel}
            {roundNumber}局
          </div>
          {honba > 0 && (
            <div
              style={{ fontSize: Math.max(9, Math.round(size * 0.055)) }}
              className="text-gray-300 leading-tight"
            >
              {honba}本場
            </div>
          )}
          <div
            style={{ fontSize: Math.max(8, Math.round(size * 0.05)) }}
            className="text-gray-400 flex gap-2 leading-tight"
          >
            <span>供託{riichiSticks * 1000}</span>
            <span>残{remainingTiles}</span>
          </div>
          <div className="flex gap-px mt-0.5">
            {doraIndicators.map((tile, i) => (
              <TileView key={i} tile={tile} size={tileSz} />
            ))}
          </div>
        </div>

        {/* 右辺: 下家 (90° 時計回り) */}
        <div style={{ width: barH, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: size - barH * 2,
              transform: "translate(-50%, -50%) rotate(90deg)",
            }}
          >
            {scoreBar(1)}
          </div>
        </div>
      </div>

      {/* 下辺: 自家 */}
      {scoreBar(0)}
    </div>
  );
}
