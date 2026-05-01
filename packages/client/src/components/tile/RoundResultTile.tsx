/**
 * 局結果オーバーレイ用の牌コンポーネント
 *
 * Pixi.js 盤面と同じ SVG 画像（src/images/）を <img> タグで表示する。
 * TileView / TileFace は別系統のデザインのため、こちらを使用する。
 */
import { getTileFaceUrl, getTileBackUrl } from "@/pixi/tiles/tileAssets";
import type { TileData } from "@/types";

interface RoundResultTileProps {
  tile?: TileData;
  /** 牌の幅（px）。高さは 4/3 倍で自動計算 */
  size?: number;
  faceDown?: boolean;
  /** 和了牌などを強調表示するアンバー枠 */
  highlighted?: boolean;
  /** 横倒し（鳴き元牌） */
  rotated?: boolean;
  /** 外側コンテナへの追加 CSS クラス */
  className?: string;
}

export function RoundResultTile({
  tile,
  size = 32,
  faceDown = false,
  highlighted = false,
  rotated = false,
  className,
}: RoundResultTileProps) {
  const width = size;
  const height = Math.round(size * (4 / 3));
  const isBackFace = faceDown || !tile;

  const url =
    isBackFace
      ? getTileBackUrl()
      : getTileFaceUrl(tile.type, tile.isRedDora);
  const imageTransform = `${rotated ? "rotate(-90deg)" : ""}`.trim();

  // 横倒しのとき width/height を交換し rotate(-90deg)
  const displayWidth = rotated ? height : width;
  const displayHeight = rotated ? width : height;

  return (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        borderRadius: Math.round(Math.min(width, height) * 0.06),
      }}
      className={`inline-flex shrink-0 items-center justify-center ${isBackFace ? "bg-transparent" : "bg-white"} overflow-hidden${highlighted ? " outline outline-2 outline-amber-400" : ""}${className ? ` ${className}` : ""}`}
    >
      <img
        src={url}
        alt={tile?.type ?? "back"}
        style={{
          width: isBackFace ? "100%" : width * 0.85,
          height: isBackFace ? "100%" : height * 0.85,
          objectFit: "contain",
          transform: imageTransform || undefined,
        }}
        draggable={false}
      />
    </div>
  );
}
