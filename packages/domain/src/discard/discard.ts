import { type Tile, type TileType } from "../tile/index.js";

/**
 * 捨て牌1枚の情報
 */
export interface DiscardEntry {
  /** 捨てた牌 */
  readonly tile: Tile;
  /** ツモ切り（ツモった牌をそのまま捨てた）かどうか */
  readonly isTsumogiri: boolean;
  /** リーチ宣言牌かどうか */
  readonly isRiichiDeclare: boolean;
  /** 他家に鳴かれたかどうか（鳴かれた場合は河に残らない） */
  calledBy: number | undefined;
}

/**
 * プレイヤーの河（捨て牌置き場）を管理するクラス
 *
 * フリテン判定に使用するため、鳴かれた牌も含めて全捨て牌の履歴を保持する。
 */
export class Discard {
  private readonly entries: DiscardEntry[] = [];

  /**
   * 捨て牌を追加する
   */
  addDiscard(tile: Tile, isTsumogiri: boolean, isRiichiDeclare: boolean = false): void {
    this.entries.push({
      tile,
      isTsumogiri,
      isRiichiDeclare,
      calledBy: undefined,
    });
  }

  /**
   * 直前の捨て牌を鳴かれた状態にする
   *
   * @param calledByPlayerIndex 鳴いたプレイヤーの番号
   */
  markLastAsCalled(calledByPlayerIndex: number): void {
    if (this.entries.length === 0) {
      throw new Error("捨て牌がありません");
    }
    const last = this.entries[this.entries.length - 1];
    last.calledBy = calledByPlayerIndex;
  }

  /**
   * 直前の捨て牌を取得する
   */
  getLastDiscard(): DiscardEntry | undefined {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : undefined;
  }

  /**
   * 河に表示されている牌（鳴かれていない牌のみ）
   */
  getVisibleDiscards(): readonly DiscardEntry[] {
    return this.entries.filter((e) => e.calledBy === undefined);
  }

  /**
   * 全捨て牌（鳴かれた牌を含む）の履歴
   * フリテン判定に使用する
   */
  getAllDiscards(): readonly DiscardEntry[] {
    return this.entries;
  }

  /**
   * 捨て牌の中に指定した TileType が含まれるか（フリテン判定用）
   *
   * 鳴かれた牌も含めて判定する
   */
  hasDiscardedType(tileType: TileType): boolean {
    return this.entries.some((e) => e.tile.type === tileType);
  }

  /**
   * 捨て牌の数
   */
  get count(): number {
    return this.entries.length;
  }

  /**
   * 河に表示されている牌の数（鳴かれていないもの）
   */
  get visibleCount(): number {
    return this.entries.filter((e) => e.calledBy === undefined).length;
  }
}
