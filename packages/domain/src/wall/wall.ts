import { type Tile } from "../tile/index.js";
import { createAllTiles, type RedDoraConfig } from "../tile/index.js";

/**
 * 牌山を表すクラス
 *
 * 麻雀の牌山は136枚から構成され、以下の領域に分かれる:
 * - 配牌・ツモ用: 牌山の先頭側（インデックスが小さい方）
 * - 王牌 (14枚): 牌山の末尾側
 *   - 嶺上牌: 王牌の先頭4枚
 *   - ドラ表示牌: 王牌の特定位置
 *
 * 牌山の構造（配列のインデックス）:
 * ```
 * [0 ... 121] [122 123 124 125] [126 127 128 129 130 131 132 133 134 135]
 *  ツモ牌      嶺上牌(4枚)        残り王牌(ドラ表示牌等)
 * ```
 *
 * ドラ表示牌の位置（王牌内）:
 * - 1枚目: index 130
 * - 2枚目: index 132 （槓ドラ1）
 * - 3枚目: index 134 （槓ドラ2）
 * - 4枚目: index 128 （槓ドラ3）
 * - 5枚目: index 126 （槓ドラ4）
 *
 * 裏ドラ表示牌の位置:
 * - 1枚目: index 131
 * - 2枚目: index 133 （槓裏ドラ1）
 * - 3枚目: index 135 （槓裏ドラ2）
 * - 4枚目: index 129 （槓裏ドラ3）
 * - 5枚目: index 127 （槓裏ドラ4）
 */
export class Wall {
  private readonly tiles: Tile[];

  /** 次にツモる牌のインデックス */
  private drawIndex: number;

  /** 次の嶺上牌のインデックス（嶺上牌は 122,123,124,125） */
  private rinshanIndex: number;

  /** 開かれた槓ドラの数 */
  private kanDoraCount: number;

  /** 王牌の開始インデックス */
  private static readonly DEAD_WALL_START = 122;

  /** 嶺上牌のインデックス（取得順） */
  private static readonly RINSHAN_INDICES = [122, 123, 124, 125];

  /** ドラ表示牌のインデックス（開示順） */
  private static readonly DORA_INDICATOR_INDICES = [130, 132, 134, 128, 126];

  /** 裏ドラ表示牌のインデックス（開示順） */
  private static readonly URA_DORA_INDICATOR_INDICES = [131, 133, 135, 129, 127];

  private constructor(tiles: Tile[]) {
    this.tiles = tiles;
    this.drawIndex = 0;
    this.rinshanIndex = 0;
    this.kanDoraCount = 0;
  }

  /**
   * 牌山を生成する
   *
   * @param redDoraConfig 赤ドラ設定
   * @param shuffleFn シャッフル関数（テスト用にDI可能）
   */
  static create(
    redDoraConfig: RedDoraConfig = "two-pinzu",
    shuffleFn: (tiles: Tile[]) => void = fisherYatesShuffle,
  ): Wall {
    const tiles = createAllTiles(redDoraConfig);
    shuffleFn(tiles);
    return new Wall(tiles);
  }

  /**
   * テスト用: 指定した牌配列で牌山を作成する（シャッフルなし）
   */
  static fromTiles(tiles: Tile[]): Wall {
    if (tiles.length !== 136) {
      throw new Error(`牌山は136枚である必要があります（現在: ${tiles.length}枚）`);
    }
    return new Wall([...tiles]);
  }

  /**
   * 配牌を行う（4人分、各13枚）
   *
   * 実際の麻雀と同様に 4枚ずつ3回 + 1枚 の順で配る
   *
   * @returns 4人分の手牌（各13枚）
   */
  dealInitialHands(): [Tile[], Tile[], Tile[], Tile[]] {
    const hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];

    // 4枚ずつ3回
    for (let round = 0; round < 3; round++) {
      for (let player = 0; player < 4; player++) {
        for (let i = 0; i < 4; i++) {
          hands[player].push(this.drawTile());
        }
      }
    }

    // 各プレイヤーに1枚ずつ
    for (let player = 0; player < 4; player++) {
      hands[player].push(this.drawTile());
    }

    return hands;
  }

  /**
   * ツモ（牌山から1枚引く）
   */
  drawTile(): Tile {
    if (this.drawIndex >= Wall.DEAD_WALL_START) {
      throw new Error("牌山にツモ牌がありません");
    }
    const tile = this.tiles[this.drawIndex];
    this.drawIndex++;
    return tile;
  }

  /**
   * 嶺上牌を引く（槓の後に使用）
   */
  drawRinshanTile(): Tile {
    if (this.rinshanIndex >= Wall.RINSHAN_INDICES.length) {
      throw new Error("嶺上牌がありません");
    }
    const index = Wall.RINSHAN_INDICES[this.rinshanIndex];
    this.rinshanIndex++;
    return this.tiles[index];
  }

  /**
   * 槓ドラを追加で開く
   */
  openKanDora(): void {
    if (this.kanDoraCount >= 4) {
      throw new Error("槓ドラはこれ以上開けません");
    }
    this.kanDoraCount++;
  }

  /**
   * 現在開示されているドラ表示牌を返す（通常ドラ1枚 + 槓ドラ）
   */
  getDoraIndicators(): Tile[] {
    const count = 1 + this.kanDoraCount;
    return Wall.DORA_INDICATOR_INDICES.slice(0, count).map((i) => this.tiles[i]);
  }

  /**
   * 裏ドラ表示牌を返す（リーチ者のアガリ時に開示）
   */
  getUraDoraIndicators(): Tile[] {
    const count = 1 + this.kanDoraCount;
    return Wall.URA_DORA_INDICATOR_INDICES.slice(0, count).map((i) => this.tiles[i]);
  }

  /**
   * ツモ可能な残り枚数（嶺上牌の消費分は差し引く）
   */
  get remainingDrawCount(): number {
    return Wall.DEAD_WALL_START - this.drawIndex - this.rinshanIndex;
  }

  /**
   * 牌山のすべての牌を返す（デバッグ用）
   */
  getAllTiles(): readonly Tile[] {
    return this.tiles;
  }

  /**
   * まだツモされていない残りの牌を返す（デバッグ用）
   * drawIndex から王牌開始位置までの牌を返す。
   */
  getRemainingTiles(): readonly Tile[] {
    return this.tiles.slice(this.drawIndex, Wall.DEAD_WALL_START);
  }

  /**
   * 牌山内の指定位置の牌を差し替える（デバッグ用）
   *
   * @param absoluteIndex 牌山配列内の絶対インデックス
   * @param newTile 差し替える新しい牌
   * @returns 元の牌
   */
  swapTileAt(absoluteIndex: number, newTile: Tile): Tile {
    if (absoluteIndex < this.drawIndex || absoluteIndex >= Wall.DEAD_WALL_START) {
      throw new Error("指定位置の牌は交換できません");
    }
    const old = this.tiles[absoluteIndex];
    this.tiles[absoluteIndex] = newTile;
    return old;
  }

  /**
   * 現在の drawIndex を返す（デバッグ用）
   */
  getDrawIndex(): number {
    return this.drawIndex;
  }
}

/**
 * Fisher-Yates シャッフル（in-place）
 */
function fisherYatesShuffle(tiles: Tile[]): void {
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
}
