/**
 * 牌の色（スート）
 */
export const TileSuit = {
  /** 萬子 */
  Manzu: "manzu",
  /** 索子 */
  Souzu: "souzu",
  /** 筒子 */
  Pinzu: "pinzu",
  /** 風牌 */
  Kaze: "kaze",
  /** 三元牌 */
  Sangen: "sangen",
} as const;

export type TileSuit = (typeof TileSuit)[keyof typeof TileSuit];

/**
 * 牌の種類（34種）
 *
 * 命名規則:
 * - 数牌: `{suit}{number}` (例: Man1 = 萬子1)
 * - 風牌: `{方角}` (例: Ton = 東)
 * - 三元牌: `{名前}` (例: Haku = 白)
 */
export const TileType = {
  // 萬子 (1-9)
  Man1: "man1",
  Man2: "man2",
  Man3: "man3",
  Man4: "man4",
  Man5: "man5",
  Man6: "man6",
  Man7: "man7",
  Man8: "man8",
  Man9: "man9",
  // 索子 (1-9)
  Sou1: "sou1",
  Sou2: "sou2",
  Sou3: "sou3",
  Sou4: "sou4",
  Sou5: "sou5",
  Sou6: "sou6",
  Sou7: "sou7",
  Sou8: "sou8",
  Sou9: "sou9",
  // 筒子 (1-9)
  Pin1: "pin1",
  Pin2: "pin2",
  Pin3: "pin3",
  Pin4: "pin4",
  Pin5: "pin5",
  Pin6: "pin6",
  Pin7: "pin7",
  Pin8: "pin8",
  Pin9: "pin9",
  // 風牌
  Ton: "ton",
  Nan: "nan",
  Sha: "sha",
  Pei: "pei",
  // 三元牌
  Haku: "haku",
  Hatsu: "hatsu",
  Chun: "chun",
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

/**
 * 牌1枚を表す型
 *
 * - `type`: 牌の種類（34種のうちの1つ）
 * - `id`: 同種牌を区別するための連番（0-3）
 * - `isRedDora`: 赤ドラかどうか
 */
export interface Tile {
  readonly type: TileType;
  readonly id: number;
  readonly isRedDora: boolean;
}

/**
 * 数牌の情報を表す型
 */
export interface NumberTileInfo {
  readonly suit: typeof TileSuit.Manzu | typeof TileSuit.Souzu | typeof TileSuit.Pinzu;
  readonly number: number;
}

/**
 * TileType と TileSuit の対応テーブル
 */
export const TILE_SUIT_MAP: ReadonlyMap<TileType, TileSuit> = new Map<TileType, TileSuit>([
  [TileType.Man1, TileSuit.Manzu],
  [TileType.Man2, TileSuit.Manzu],
  [TileType.Man3, TileSuit.Manzu],
  [TileType.Man4, TileSuit.Manzu],
  [TileType.Man5, TileSuit.Manzu],
  [TileType.Man6, TileSuit.Manzu],
  [TileType.Man7, TileSuit.Manzu],
  [TileType.Man8, TileSuit.Manzu],
  [TileType.Man9, TileSuit.Manzu],
  [TileType.Sou1, TileSuit.Souzu],
  [TileType.Sou2, TileSuit.Souzu],
  [TileType.Sou3, TileSuit.Souzu],
  [TileType.Sou4, TileSuit.Souzu],
  [TileType.Sou5, TileSuit.Souzu],
  [TileType.Sou6, TileSuit.Souzu],
  [TileType.Sou7, TileSuit.Souzu],
  [TileType.Sou8, TileSuit.Souzu],
  [TileType.Sou9, TileSuit.Souzu],
  [TileType.Pin1, TileSuit.Pinzu],
  [TileType.Pin2, TileSuit.Pinzu],
  [TileType.Pin3, TileSuit.Pinzu],
  [TileType.Pin4, TileSuit.Pinzu],
  [TileType.Pin5, TileSuit.Pinzu],
  [TileType.Pin6, TileSuit.Pinzu],
  [TileType.Pin7, TileSuit.Pinzu],
  [TileType.Pin8, TileSuit.Pinzu],
  [TileType.Pin9, TileSuit.Pinzu],
  [TileType.Ton, TileSuit.Kaze],
  [TileType.Nan, TileSuit.Kaze],
  [TileType.Sha, TileSuit.Kaze],
  [TileType.Pei, TileSuit.Kaze],
  [TileType.Haku, TileSuit.Sangen],
  [TileType.Hatsu, TileSuit.Sangen],
  [TileType.Chun, TileSuit.Sangen],
]);

/**
 * 全34種の TileType を順序通りに並べた配列
 */
export const ALL_TILE_TYPES: readonly TileType[] = [
  TileType.Man1,
  TileType.Man2,
  TileType.Man3,
  TileType.Man4,
  TileType.Man5,
  TileType.Man6,
  TileType.Man7,
  TileType.Man8,
  TileType.Man9,
  TileType.Sou1,
  TileType.Sou2,
  TileType.Sou3,
  TileType.Sou4,
  TileType.Sou5,
  TileType.Sou6,
  TileType.Sou7,
  TileType.Sou8,
  TileType.Sou9,
  TileType.Pin1,
  TileType.Pin2,
  TileType.Pin3,
  TileType.Pin4,
  TileType.Pin5,
  TileType.Pin6,
  TileType.Pin7,
  TileType.Pin8,
  TileType.Pin9,
  TileType.Ton,
  TileType.Nan,
  TileType.Sha,
  TileType.Pei,
  TileType.Haku,
  TileType.Hatsu,
  TileType.Chun,
];
