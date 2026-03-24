import { type Tile } from "../tile/index.js";
import { sortTiles, isSameTile } from "../tile/index.js";

/**
 * プレイヤーの手牌を管理するクラス
 *
 * 手牌は最大14枚（ツモ直後）、通常は13枚。
 * 副露（チー・ポン・カン）による手牌枚数の減少は、
 * このクラスでは手牌からの牌除去のみを担当し、
 * 副露の管理自体は別モジュール（meld）で行う。
 */
export class Hand {
  private tiles: Tile[];

  constructor(initialTiles: Tile[] = []) {
    this.tiles = [...initialTiles];
  }

  /**
   * 手牌のコピーを返す（ソート済み）
   */
  getSortedTiles(): Tile[] {
    return sortTiles(this.tiles);
  }

  /**
   * 手牌をそのままの順序で返す
   */
  getTiles(): readonly Tile[] {
    return this.tiles;
  }

  /**
   * 手牌の枚数
   */
  get count(): number {
    return this.tiles.length;
  }

  /**
   * ツモ（手牌に1枚追加）
   */
  addTile(tile: Tile): void {
    this.tiles.push(tile);
  }

  /**
   * 打牌（手牌から指定の牌を1枚除去して返す）
   *
   * @param tile 捨てる牌（type と id で一致判定）
   * @returns 除去された牌
   * @throws 指定の牌が手牌に存在しない場合
   */
  removeTile(tile: Tile): Tile {
    const index = this.tiles.findIndex((t) => isSameTile(t, tile));
    if (index === -1) {
      throw new Error(`手牌に指定の牌がありません: ${tile.type} (id=${tile.id})`);
    }
    return this.tiles.splice(index, 1)[0];
  }

  /**
   * 指定した TileType の牌を手牌から取り除く（副露時に使用）
   *
   * @param count 取り除く枚数
   * @param type 取り除く牌の TileType
   * @returns 取り除かれた牌の配列
   */
  removeTilesByType(type: string, count: number): Tile[] {
    const removed: Tile[] = [];
    for (let i = 0; i < count; i++) {
      const index = this.tiles.findIndex(
        (t) => t.type === type && !removed.some((r) => isSameTile(r, t)),
      );
      if (index === -1) {
        throw new Error(
          `手牌に ${type} が${count}枚ありません（${removed.length}枚しか見つかりません）`,
        );
      }
      removed.push(this.tiles.splice(index, 1)[0]);
    }
    return removed;
  }

  /**
   * 手牌に特定の TileType の牌が何枚あるか
   */
  countByType(type: string): number {
    return this.tiles.filter((t) => t.type === type).length;
  }

  /**
   * 手牌に特定の牌が含まれているか（type と id で判定）
   */
  contains(tile: Tile): boolean {
    return this.tiles.some((t) => isSameTile(t, tile));
  }

  /**
   * 手牌に特定の TileType が含まれているか
   */
  containsType(type: string): boolean {
    return this.tiles.some((t) => t.type === type);
  }
}
