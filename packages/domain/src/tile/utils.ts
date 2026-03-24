import { type Tile, type NumberTileInfo, TileType, TileSuit, TILE_SUIT_MAP } from "./types.js";

// --- 数牌のパース用テーブル ---

const NUMBER_TILE_INFO: ReadonlyMap<TileType, NumberTileInfo> = new Map([
  [TileType.Man1, { suit: TileSuit.Manzu, number: 1 }],
  [TileType.Man2, { suit: TileSuit.Manzu, number: 2 }],
  [TileType.Man3, { suit: TileSuit.Manzu, number: 3 }],
  [TileType.Man4, { suit: TileSuit.Manzu, number: 4 }],
  [TileType.Man5, { suit: TileSuit.Manzu, number: 5 }],
  [TileType.Man6, { suit: TileSuit.Manzu, number: 6 }],
  [TileType.Man7, { suit: TileSuit.Manzu, number: 7 }],
  [TileType.Man8, { suit: TileSuit.Manzu, number: 8 }],
  [TileType.Man9, { suit: TileSuit.Manzu, number: 9 }],
  [TileType.Sou1, { suit: TileSuit.Souzu, number: 1 }],
  [TileType.Sou2, { suit: TileSuit.Souzu, number: 2 }],
  [TileType.Sou3, { suit: TileSuit.Souzu, number: 3 }],
  [TileType.Sou4, { suit: TileSuit.Souzu, number: 4 }],
  [TileType.Sou5, { suit: TileSuit.Souzu, number: 5 }],
  [TileType.Sou6, { suit: TileSuit.Souzu, number: 6 }],
  [TileType.Sou7, { suit: TileSuit.Souzu, number: 7 }],
  [TileType.Sou8, { suit: TileSuit.Souzu, number: 8 }],
  [TileType.Sou9, { suit: TileSuit.Souzu, number: 9 }],
  [TileType.Pin1, { suit: TileSuit.Pinzu, number: 1 }],
  [TileType.Pin2, { suit: TileSuit.Pinzu, number: 2 }],
  [TileType.Pin3, { suit: TileSuit.Pinzu, number: 3 }],
  [TileType.Pin4, { suit: TileSuit.Pinzu, number: 4 }],
  [TileType.Pin5, { suit: TileSuit.Pinzu, number: 5 }],
  [TileType.Pin6, { suit: TileSuit.Pinzu, number: 6 }],
  [TileType.Pin7, { suit: TileSuit.Pinzu, number: 7 }],
  [TileType.Pin8, { suit: TileSuit.Pinzu, number: 8 }],
  [TileType.Pin9, { suit: TileSuit.Pinzu, number: 9 }],
]);

// --- ドラ表示牌 → ドラ牌 の変換テーブル ---

const DORA_NEXT_MAP: ReadonlyMap<TileType, TileType> = new Map([
  // 萬子: 1→2→…→9→1
  [TileType.Man1, TileType.Man2],
  [TileType.Man2, TileType.Man3],
  [TileType.Man3, TileType.Man4],
  [TileType.Man4, TileType.Man5],
  [TileType.Man5, TileType.Man6],
  [TileType.Man6, TileType.Man7],
  [TileType.Man7, TileType.Man8],
  [TileType.Man8, TileType.Man9],
  [TileType.Man9, TileType.Man1],
  // 索子: 1→2→…→9→1
  [TileType.Sou1, TileType.Sou2],
  [TileType.Sou2, TileType.Sou3],
  [TileType.Sou3, TileType.Sou4],
  [TileType.Sou4, TileType.Sou5],
  [TileType.Sou5, TileType.Sou6],
  [TileType.Sou6, TileType.Sou7],
  [TileType.Sou7, TileType.Sou8],
  [TileType.Sou8, TileType.Sou9],
  [TileType.Sou9, TileType.Sou1],
  // 筒子: 1→2→…→9→1
  [TileType.Pin1, TileType.Pin2],
  [TileType.Pin2, TileType.Pin3],
  [TileType.Pin3, TileType.Pin4],
  [TileType.Pin4, TileType.Pin5],
  [TileType.Pin5, TileType.Pin6],
  [TileType.Pin6, TileType.Pin7],
  [TileType.Pin7, TileType.Pin8],
  [TileType.Pin8, TileType.Pin9],
  [TileType.Pin9, TileType.Pin1],
  // 風牌: 東→南→西→北→東
  [TileType.Ton, TileType.Nan],
  [TileType.Nan, TileType.Sha],
  [TileType.Sha, TileType.Pei],
  [TileType.Pei, TileType.Ton],
  // 三元牌: 白→發→中→白
  [TileType.Haku, TileType.Hatsu],
  [TileType.Hatsu, TileType.Chun],
  [TileType.Chun, TileType.Haku],
]);

// ===== 判定関数 =====

/**
 * 数牌（萬子・索子・筒子）かどうか
 */
export function isNumberTile(tile: Tile): boolean {
  const suit = TILE_SUIT_MAP.get(tile.type);
  return suit === TileSuit.Manzu || suit === TileSuit.Souzu || suit === TileSuit.Pinzu;
}

/**
 * 字牌（風牌・三元牌）かどうか
 */
export function isHonorTile(tile: Tile): boolean {
  const suit = TILE_SUIT_MAP.get(tile.type);
  return suit === TileSuit.Kaze || suit === TileSuit.Sangen;
}

/**
 * 風牌かどうか
 */
export function isWindTile(tile: Tile): boolean {
  return TILE_SUIT_MAP.get(tile.type) === TileSuit.Kaze;
}

/**
 * 三元牌かどうか
 */
export function isDragonTile(tile: Tile): boolean {
  return TILE_SUIT_MAP.get(tile.type) === TileSuit.Sangen;
}

/**
 * 幺九牌（1, 9, 字牌）かどうか
 */
export function isTerminalOrHonor(tile: Tile): boolean {
  if (isHonorTile(tile)) return true;
  const info = getNumberTileInfo(tile);
  return info !== undefined && (info.number === 1 || info.number === 9);
}

/**
 * 老頭牌（1, 9 の数牌）かどうか
 */
export function isTerminal(tile: Tile): boolean {
  const info = getNumberTileInfo(tile);
  return info !== undefined && (info.number === 1 || info.number === 9);
}

// ===== 情報取得 =====

/**
 * 数牌の場合、スートと数字を返す。字牌の場合は undefined
 */
export function getNumberTileInfo(tile: Tile): NumberTileInfo | undefined {
  return NUMBER_TILE_INFO.get(tile.type);
}

/**
 * 牌のスートを取得する
 */
export function getTileSuit(tile: Tile): TileSuit {
  const suit = TILE_SUIT_MAP.get(tile.type);
  if (suit === undefined) {
    throw new Error(`Unknown tile type: ${tile.type}`);
  }
  return suit;
}

// ===== ドラ =====

/**
 * ドラ表示牌からドラ牌の TileType を取得する
 *
 * ルール:
 * - 数牌: 次の数字（9の次は1）
 * - 風牌: 東→南→西→北→東
 * - 三元牌: 白→發→中→白
 */
export function getDoraFromIndicator(indicatorType: TileType): TileType {
  const dora = DORA_NEXT_MAP.get(indicatorType);
  if (dora === undefined) {
    throw new Error(`Unknown indicator tile type: ${indicatorType}`);
  }
  return dora;
}

// ===== ソート =====

/**
 * 牌のソート順序を返す（小さい値ほど先頭）
 *
 * 順序: 萬子1-9 → 索子1-9 → 筒子1-9 → 東南西北 → 白發中
 * 同種牌内では赤ドラを先に（赤5 → 通常5）、さらに id 順
 */
export function tileOrderIndex(tile: Tile): number {
  const typeIndex = ALL_TILE_TYPES_INDEX.get(tile.type) ?? 0;
  // typeIndex * 8 でグループ化し、赤ドラを先に、id でさらに区別
  return typeIndex * 8 + (tile.isRedDora ? 0 : 4) + tile.id;
}

/**
 * 牌配列をソートする（非破壊的）
 */
export function sortTiles(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort((a, b) => tileOrderIndex(a) - tileOrderIndex(b));
}

// ALL_TILE_TYPES のインデックスマップ（高速参照用）
import { ALL_TILE_TYPES } from "./types.js";

const ALL_TILE_TYPES_INDEX: ReadonlyMap<TileType, number> = new Map(
  ALL_TILE_TYPES.map((t, i) => [t, i]),
);

/**
 * 2つの牌が同じ種類かどうか（id や赤ドラフラグは無視）
 */
export function isSameTileType(a: Tile, b: Tile): boolean {
  return a.type === b.type;
}

/**
 * 2つの牌が完全に同一かどうか（type と id が一致）
 */
export function isSameTile(a: Tile, b: Tile): boolean {
  return a.type === b.type && a.id === b.id;
}
