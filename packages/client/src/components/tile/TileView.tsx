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
}

export function TileView({
  tile,
  size = 40,
  onClick,
  selected = false,
  faceDown = false,
  rotated = false,
}: TileViewProps) {
  const width = size;
  const height = size * 1.4;

  const style: React.CSSProperties = {
    width: rotated ? height : width,
    height: rotated ? width : height,
    transform: [selected ? "translateY(-8px)" : "", rotated ? "rotate(90deg)" : ""]
      .filter(Boolean)
      .join(" "),
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
