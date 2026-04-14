import { getTileFaceUrl } from "@/pixi/tiles/tileAssets";
import type { WaitingTileInfo } from "@/utils/viewConverter";

interface RiichiWaitTooltipProps {
  waitingTiles: readonly WaitingTileInfo[];
  /** ツールチップの中心X座標（canvas内px） */
  centerX: number;
  /** ツールチップの下端Y座標（牌の上端付近、canvas内px） */
  bottomY: number;
}

export function RiichiWaitTooltip({ waitingTiles, centerX, bottomY }: RiichiWaitTooltipProps) {
  if (waitingTiles.length === 0) return null;

  const totalRemaining = waitingTiles.reduce((sum, t) => sum + t.remaining, 0);

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        left: centerX,
        top: bottomY,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="bg-black/85 rounded-lg px-3 py-2 flex flex-col items-center gap-1">
        <div className="flex items-end gap-2">
          {waitingTiles.map((wt) => (
            <div key={wt.type} className="flex flex-col items-center">
              <img
                src={getTileFaceUrl(wt.type, false)}
                alt={wt.type}
                className="w-7 h-auto bg-white rounded p-[10%]"
                draggable={false}
              />
              <span className="text-white text-xs mt-0.5">×{wt.remaining}</span>
            </div>
          ))}
        </div>
        <span className="text-gray-300 text-[10px]">
          残り {totalRemaining} 枚
        </span>
      </div>
    </div>
  );
}
