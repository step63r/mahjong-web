import { type Tile, type TileType } from "../tile/index.js";

/**
 * 副露の種類
 */
export const MeldType = {
  /** チー（順子を構成する鳴き、上家からのみ） */
  Chi: "chi",
  /** ポン（刻子を構成する鳴き） */
  Pon: "pon",
  /** 明槓（他家の捨て牌を使って槓子を構成） */
  Minkan: "minkan",
  /** 暗槓（手牌4枚で槓子を構成） */
  Ankan: "ankan",
  /** 加槓（ポンした刻子に手牌の1枚を加えて槓子にする） */
  Kakan: "kakan",
} as const;

export type MeldType = (typeof MeldType)[keyof typeof MeldType];

/**
 * 副露（鳴き）を表す型
 *
 * - `type`: 副露の種類
 * - `tiles`: 副露を構成する牌（チー: 3枚、ポン: 3枚、槓: 4枚）
 * - `calledTile`: 鳴いた牌（他家から取得した牌）。暗槓の場合は undefined
 * - `fromPlayerIndex`: 鳴き元のプレイヤー番号（0-3）。暗槓の場合は undefined
 */
export interface Meld {
  readonly type: MeldType;
  readonly tiles: readonly Tile[];
  readonly calledTile?: Tile;
  readonly fromPlayerIndex?: number;
}

/**
 * チーの候補を表す型
 *
 * - `tiles`: 手牌から出す2枚
 * - `calledTile`: 鳴く牌（上家の捨て牌）
 * - `resultTiles`: 完成する順子（ソート済み3枚）
 */
export interface ChiCandidate {
  readonly tiles: readonly [Tile, Tile];
  readonly calledTile: Tile;
  readonly resultTiles: readonly [Tile, Tile, Tile];
}

/**
 * 食い替えで禁止される打牌の TileType を表す型
 */
export interface KuikaeConstraint {
  /** 食い替えで捨ててはいけない TileType のリスト */
  readonly forbiddenTypes: readonly TileType[];
}
