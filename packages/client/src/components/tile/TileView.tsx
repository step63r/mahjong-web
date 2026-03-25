import type { TileData } from "@/types";
import { TileFace } from "./TileFace";
import { TileBack } from "./TileBack";

interface TileViewProps {
  tile?: TileData;
  size?: number;
  onClick?: () => void;
  selected?: boolean;
  faceDown?: boolean;
  rotated?: boolean;
  /** プレイヤー方向に応じた回転角度 (0, 90, 180, 270) */
  rotation?: number;
}

export function TileView({
  tile,
  size = 40,
  onClick,
  selected = false,
  faceDown = false,
  rotated = false,
  rotation = 0,
}: TileViewProps) {
  const width = size;
  const height = size * 1.4;

  const effectiveRotation = (rotation + (rotated ? 90 : 0)) % 360;
  const isSwapped = effectiveRotation === 90 || effectiveRotation === 270;
  const diff = (height - width) / 2;

  const style: React.CSSProperties = {
    width,
    height,
    transform: [
      selected ? "translateY(-8px)" : "",
      effectiveRotation ? `rotate(${effectiveRotation}deg)` : "",
    ]
      .filter(Boolean)
      .join(" "),
    ...(isSwapped && { margin: `${-diff}px ${diff}px` }),
    transition: "transform 0.1s ease",
    cursor: onClick ? "pointer" : "default",
  };

  return (
    <div
      style={style}
      onClick={onClick}
      className="inline-block shrink-0"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <svg viewBox="0 0 60 84" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {faceDown || !tile ? <TileBack /> : <TileFace tile={tile} />}
      </svg>
    </div>
  );
}
