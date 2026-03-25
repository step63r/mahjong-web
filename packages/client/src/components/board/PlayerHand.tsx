import type { TileData } from "@/types";
import { TileView } from "@/components/tile/TileView";

interface PlayerHandProps {
  tiles: readonly TileData[];
  drawnTile?: TileData;
  selectedIndex?: number;
  onTileClick?: (index: number) => void;
  tileSize?: number;
  faceDown?: boolean;
}

export function PlayerHand({
  tiles,
  drawnTile,
  selectedIndex,
  onTileClick,
  tileSize = 40,
  faceDown = false,
}: PlayerHandProps) {
  const drawnTileWidth = tileSize + tileSize * 0.25;

  return (
    <div className="flex items-end gap-0.5 flex-wrap justify-center">
      {tiles.map((tile, i) => (
        <TileView
          key={`${tile.type}-${tile.id}`}
          tile={tile}
          size={tileSize}
          selected={selectedIndex === i}
          onClick={onTileClick ? () => onTileClick(i) : undefined}
          faceDown={faceDown}
        />
      ))}
      {/* ツモ牌領域（常に確保） */}
      <div style={{ width: drawnTileWidth }} className="flex items-end">
        {drawnTile && (
          <>
            <div style={{ width: tileSize * 0.25 }} className="shrink-0" />
            <TileView
              tile={drawnTile}
              size={tileSize}
              selected={selectedIndex === tiles.length}
              onClick={onTileClick ? () => onTileClick(tiles.length) : undefined}
              faceDown={faceDown}
            />
          </>
        )}
      </div>
    </div>
  );
}
