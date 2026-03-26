import type { RoundState } from "@mahjong-web/domain";
import { sortTiles } from "@mahjong-web/domain";
import { TileView } from "@/components/tile/TileView";
import type { TileData } from "@/types";

interface DebugPanelProps {
  round: RoundState;
  targetPlayer: number;
  selectedWallTileKey: string | undefined;
  selectedHandTileKey: string | undefined;
  onSelectWallTile: (key: string | undefined) => void;
  onSelectHandTile: (key: string | undefined) => void;
  onSetTargetPlayer: (playerIndex: number) => void;
  onSwap: () => void;
}

const SEAT_NAMES = ["自家", "下家", "対面", "上家"] as const;

function tileKey(t: { type: string; id: number }): string {
  return `${t.type}:${t.id}`;
}

export function DebugPanel({
  round,
  targetPlayer,
  selectedWallTileKey,
  selectedHandTileKey,
  onSelectWallTile,
  onSelectHandTile,
  onSetTargetPlayer,
  onSwap,
}: DebugPanelProps) {
  const handTiles = sortTiles([...round.players[targetPlayer].hand.getTiles()]);
  const remainingTiles = sortTiles([...round.wall.getRemainingTiles()]);

  const canSwap = selectedWallTileKey !== undefined && selectedHandTileKey !== undefined;

  return (
    <div className="fixed top-10 right-2 bg-gray-900/95 text-white text-xs rounded-lg p-3 w-80 max-h-[90vh] overflow-y-auto z-50 space-y-3">
      <div className="text-red-400 font-bold text-sm">DEBUG MODE</div>

      {/* 対象プレイヤー選択 */}
      <div>
        <div className="text-gray-400 mb-1">対象プレイヤー:</div>
        <div className="flex gap-1">
          {SEAT_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => onSetTargetPlayer(i)}
              className={`px-2 py-0.5 rounded text-xs ${
                targetPlayer === i
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* 手牌 */}
      <div>
        <div className="text-amber-400 mb-1">
          {SEAT_NAMES[targetPlayer]}の手牌（{handTiles.length}枚）
        </div>
        <div className="flex flex-wrap gap-0.5">
          {handTiles.map((t, i) => {
            const td: TileData = { type: t.type, id: t.id, isRedDora: t.isRedDora };
            return (
              <TileView
                key={tileKey(t)}
                tile={td}
                size={24}
                selected={selectedHandTileKey === tileKey(t)}
                onClick={() => {
                  const k = tileKey(t);
                  onSelectHandTile(selectedHandTileKey === k ? undefined : k);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 牌山残り */}
      <div>
        <div className="text-amber-400 mb-1">牌山残り（{remainingTiles.length}枚）</div>
        <div className="flex flex-wrap gap-0.5">
          {remainingTiles.map((t, i) => {
            const td: TileData = { type: t.type, id: t.id, isRedDora: t.isRedDora };
            return (
              <TileView
                key={tileKey(t)}
                tile={td}
                size={20}
                selected={selectedWallTileKey === tileKey(t)}
                onClick={() => {
                  const k = tileKey(t);
                  onSelectWallTile(selectedWallTileKey === k ? undefined : k);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 交換ボタン */}
      <button
        onClick={onSwap}
        disabled={!canSwap}
        className={`w-full py-1.5 rounded text-sm font-bold ${
          canSwap
            ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        交換する
      </button>
    </div>
  );
}
