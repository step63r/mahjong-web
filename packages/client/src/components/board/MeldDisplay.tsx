import type { MeldViewData } from "@/types";
import { TileView } from "@/components/tile/TileView";

interface MeldDisplayProps {
  melds: readonly MeldViewData[];
  tileSize?: number;
}

export function MeldDisplay({ melds, tileSize = 32 }: MeldDisplayProps) {
  if (melds.length === 0) return null;

  return (
    <div className="flex gap-2">
      {melds.map((meld, mi) => (
        <div key={mi} className="flex items-end">
          {meld.tiles.map((tile, ti) => (
            <TileView
              key={`${tile.type}-${tile.id}`}
              tile={tile}
              size={tileSize}
              rotated={ti === meld.calledTileIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
