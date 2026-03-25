import type { DiscardEntryData } from "@/types";
import { TileView } from "@/components/tile/TileView";

interface DiscardAreaProps {
  discards: readonly DiscardEntryData[];
  tileSize?: number;
  label?: string;
}

export function DiscardArea({ discards, tileSize = 28, label }: DiscardAreaProps) {
  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-xs text-emerald-300/70 mb-1">{label}</span>}
      <div className="grid grid-cols-6 gap-px">
        {discards.map((entry, i) => (
          <TileView key={i} tile={entry.tile} size={tileSize} rotated={entry.isRiichi} />
        ))}
      </div>
    </div>
  );
}
