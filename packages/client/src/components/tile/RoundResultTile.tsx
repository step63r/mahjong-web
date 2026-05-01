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

  const url =
    faceDown || !tile
      ? getTileBackUrl()
      : getTileFaceUrl(tile.type, tile.isRedDora);

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
      className={`inline-flex shrink-0 items-center justify-center bg-white overflow-hidden${highlighted ? " outline outline-2 outline-amber-400" : ""}${className ? ` ${className}` : ""}`}
    >
      <img
        src={url}
        alt={tile?.type ?? "back"}
        style={{
          width: width * 0.85,
          height: height * 0.85,
          objectFit: "contain",
          transform: rotated ? "rotate(-90deg)" : undefined,
        }}
        draggable={false}
      />
    </div>
  );
}
