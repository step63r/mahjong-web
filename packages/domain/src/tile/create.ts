import { type Tile, TileType, ALL_TILE_TYPES } from "./types.js";

/**
 * 赤ドラの設定
 *
 * - `"none"`: 赤ドラなし
 * - `"one-each"`: 5萬・5索・5筒 各1枚（計3枚）
 * - `"two-pinzu"`: 5萬1枚・5索1枚・5筒2枚（計4枚） ← デフォルト
 */
export type RedDoraConfig = "none" | "one-each" | "two-pinzu";

/**
 * 赤ドラの設定に基づき、各 TileType の赤ドラ枚数を返す
 */
function getRedDoraCount(config: RedDoraConfig): Map<TileType, number> {
  const map = new Map<TileType, number>();
  if (config === "none") return map;

  map.set(TileType.Man5, 1);
  map.set(TileType.Pin5, 1);

  map.set(TileType.Sou5, 1);

  if (config === "two-pinzu") {
    // "two-pinzu": 5筒が2枚赤ドラ
    map.set(TileType.Pin5, 2);
  }

  return map;
}

/**
 * 麻雀牌136枚を生成する
 *
 * @param redDoraConfig 赤ドラの設定（デフォルト: "two-pinzu"）
 * @returns 136枚の牌配列（シャッフルされていない状態）
 */
export function createAllTiles(redDoraConfig: RedDoraConfig = "two-pinzu"): Tile[] {
  const redDoraCountMap = getRedDoraCount(redDoraConfig);
  const tiles: Tile[] = [];

  for (const tileType of ALL_TILE_TYPES) {
    const redCount = redDoraCountMap.get(tileType) ?? 0;

    for (let id = 0; id < 4; id++) {
      // id が小さい方から赤ドラにする（id=0 が最初の赤ドラ）
      const isRedDora = id < redCount;
      tiles.push({ type: tileType, id, isRedDora });
    }
  }

  return tiles;
}
