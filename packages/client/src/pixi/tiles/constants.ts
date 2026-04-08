/**
 * Pixi.js 牌描画用の定数・型定義
 *
 * GUI仕様書 (docs/gui-specifications.md) に基づく。
 */

// ===== カラー =====

/** 牌の表面色 */
export const TILE_FACE_COLOR = 0xe1e1d9;

/** 牌の裏面色（厚み部分にも使用） */
export const TILE_BACK_COLOR = 0xcd8d12;

/** 牌の表面の枠線色 */
export const TILE_BORDER_COLOR = 0x9e9e9e;

/** 卓面色 */
export const TABLE_COLOR = 0x065f46; // emerald-900 相当

// ===== 牌のサイズ比率 =====

/** 牌の縦横比（高さ / 幅 = 4:3） */
export const TILE_ASPECT_RATIO = 4 / 3;

/**
 * 牌の厚み比率（表面サイズに対する厚みの割合）
 *
 * - 自家の手牌（立牌）: 表面高さの 30%
 * - 河の捨て牌・副露・他家の手牌: 表面サイズの 20%
 */
export const DEPTH_RATIO_SELF_HAND = 0.3;
export const DEPTH_RATIO_DEFAULT = 0.2;

// ===== SVG viewBox =====

/** 既存 SVG の viewBox サイズ (TileFace / TileBack 共通) */
export const SVG_VIEWBOX_WIDTH = 60;
export const SVG_VIEWBOX_HEIGHT = 84;

// ===== 方向 =====

/** プレイヤーの座席方向 */
export type SeatDirection = "self" | "shimocha" | "toimen" | "kamicha";

/** 牌の状態 */
export type TileState = "standing" | "lying";

/** 各方向の牌描画で「正面」となる面 */
export interface TileFaces {
  /** 正面に見える面 */
  front: "face" | "back" | "top" | "bottom" | "left" | "right";
  /** 正面の上に見える面（2.5D の奥行き面） */
  depth: "face" | "top" | "bottom" | "left" | "right";
}

/**
 * 方向 × 状態ごとの「正面」と「奥行き面」のマッピング
 *
 * standing = 立牌（手牌）
 * lying    = 倒牌（河・副露の通常牌）
 */
export const TILE_FACE_MAP: Record<SeatDirection, Record<TileState, TileFaces>> = {
  self: {
    standing: { front: "face", depth: "top" },
    lying: { front: "bottom", depth: "face" },
  },
  shimocha: {
    standing: { front: "left", depth: "top" },
    lying: { front: "left", depth: "face" },
  },
  toimen: {
    standing: { front: "back", depth: "top" },
    lying: { front: "top", depth: "face" },
  },
  kamicha: {
    standing: { front: "right", depth: "top" },
    lying: { front: "right", depth: "face" },
  },
};

// ===== 起家表示 =====

/** 起家表示の背景色 */
export const DEALER_MARKER_BG = 0xf47f0c;

/** 起家表示の文字色 */
export const DEALER_MARKER_TEXT = 0x222222;

// ===== 間隔 =====

/** ツモ牌と手牌最右端のギャップ（px、デザイン基準） */
export const TSUMO_GAP = 10;

/** 手牌同士の間隔 */
export const HAND_TILE_GAP = 0;

/** 捨て牌1行の枚数 */
export const DISCARD_TILES_PER_ROW = 6;

/** 捨て牌の最大行数 */
export const DISCARD_MAX_ROWS = 4;
