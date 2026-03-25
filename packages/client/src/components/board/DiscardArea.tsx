import type { DiscardEntryData } from "@/types";
import { TileView } from "@/components/tile/TileView";

/**
 * 捨て牌の流れ方向
 * - right: 自家 — 左→右、行は上→下に積む
 * - left:  対面 — 右→左、行は下→上に積む
 * - up:    下家 — 下→上、列は左→右に積む
 * - down:  上家 — 上→下、列は右→左に積む
 */
type DiscardFlow = "right" | "left" | "up" | "down";

interface DiscardAreaProps {
  discards: readonly DiscardEntryData[];
  tileSize?: number;
  flow?: DiscardFlow;
  /** 牌の回転角度（0=自家, 90=下家, 180=対面, 270=上家） */
  tileRotation?: number;
}

/** グループ（行/列）の並び方向 */
const containerClass: Record<DiscardFlow, string> = {
  right: "flex flex-col items-start",
  left: "flex flex-col-reverse items-end",
  up: "flex flex-row items-end",
  down: "flex flex-row-reverse items-start",
};

/** グループ内の牌の並び方向 */
const groupClass: Record<DiscardFlow, string> = {
  right: "flex flex-row",
  left: "flex flex-row-reverse",
  up: "flex flex-col-reverse",
  down: "flex flex-col",
};

export function DiscardArea({ discards, tileSize = 22, flow = "right", tileRotation = 0 }: DiscardAreaProps) {
  const riichiRotation = (360 - tileRotation) % 360;

  // 6枚ごとのグループに分割
  const groups: DiscardEntryData[][] = [];
  for (let i = 0; i < discards.length; i += 6) {
    groups.push(discards.slice(i, i + 6));
  }

  return (
    <div className={containerClass[flow]}>
      {groups.map((group, gi) => (
        <div key={gi} className={groupClass[flow]}>
          {group.map((entry, ti) => {
            const isRiichi = entry.isRiichi || entry.isRiichiRotated;
            return (
              <TileView
                key={gi * 6 + ti}
                tile={entry.tile}
                size={tileSize}
                rotated={isRiichi}
                rotation={isRiichi ? riichiRotation : tileRotation}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
