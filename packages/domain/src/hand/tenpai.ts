import { type TileType, ALL_TILE_TYPES, getNumberTileInfo } from "../tile/index.js";
import { type Meld } from "../meld/index.js";
import { parseMentsu, parseChiitoitsu, parseKokushi } from "../yaku/index.js";

// ===== テンパイ判定 =====

/**
 * 手牌（13枚）がテンパイかどうかを判定し、待ち牌のリストを返す。
 * テンパイでなければ空配列を返す。
 *
 * @param closedTileTypes 門前手牌の TileType 配列（13枚）
 * @param melds 副露一覧
 * @returns 待ち牌の TileType 配列（重複なし）
 */
export function getTenpaiTiles(
  closedTileTypes: readonly TileType[],
  melds: readonly Meld[],
): TileType[] {
  const waiting: TileType[] = [];

  for (const candidate of ALL_TILE_TYPES) {
    // 同一牌が既に4枚使用されていたらスキップ
    const usedCount =
      closedTileTypes.filter((t) => t === candidate).length +
      melds.reduce((sum, m) => sum + m.tiles.filter((t) => t.type === candidate).length, 0);
    if (usedCount >= 4) continue;

    // 候補牌を追加して和了形になるか判定
    const testHand = [...closedTileTypes, candidate];

    if (canComplete(testHand, melds)) {
      waiting.push(candidate);
    }
  }

  return waiting;
}

/**
 * 14枚の手牌が和了形（4面子1雀頭 or 七対子 or 国士無双）になるかを判定する。
 * 役の有無は問わない（形式テンパイ）。
 */
function canComplete(tileTypes: readonly TileType[], melds: readonly Meld[]): boolean {
  // 4面子1雀頭
  if (parseMentsu(tileTypes, melds).length > 0) return true;

  // 七対子（門前のみ）
  if (melds.length === 0 && parseChiitoitsu(tileTypes)) return true;

  // 国士無双（門前のみ）
  // テンパイ判定では和了牌は問わないので、最後の牌を仮のwinTileとして渡す
  if (melds.length === 0 && parseKokushi(tileTypes, tileTypes[tileTypes.length - 1])) return true;

  return false;
}

/**
 * 九種九牌（配牌時またはツモ直後で、幺九牌が9種以上）の判定
 *
 * @param closedTileTypes 門前手牌の TileType 配列（14枚: ツモ直後）
 * @returns 幺九牌が9種以上あれば true
 */
export function isKyuushuKyuuhai(closedTileTypes: readonly TileType[]): boolean {
  const yaochuuTypes = new Set<TileType>();

  for (const t of closedTileTypes) {
    if (isYaochuuType(t)) {
      yaochuuTypes.add(t);
    }
  }

  return yaochuuTypes.size >= 9;
}

/** TileType が幺九牌かどうか */
function isYaochuuType(type: TileType): boolean {
  const info = getNumberTileInfo({ type, id: 0, isRedDora: false });
  if (!info) return true; // 字牌は幺九牌
  return info.number === 1 || info.number === 9;
}
