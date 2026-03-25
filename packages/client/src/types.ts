/**
 * 牌の表示に使うデータ型（domain の Tile と構造互換）
 */
export interface TileData {
  readonly type: string;
  readonly id: number;
  readonly isRedDora: boolean;
}

export interface DiscardEntryData {
  readonly tile: TileData;
  readonly isRiichi?: boolean;
  /** リーチ宣言牌が鳴かれた場合、代わりにこの牌を横向きにする */
  readonly isRiichiRotated?: boolean;
}

export interface MeldViewData {
  readonly tiles: readonly TileData[];
  /** 横倒しにする牌のインデックス（鳴き元に基づく位置） */
  readonly calledTileIndex?: number;
  /** 副露の種類 */
  readonly meldType: string;
}

export interface PlayerViewState {
  readonly hand: readonly TileData[];
  readonly drawnTile?: TileData;
  readonly discards: readonly DiscardEntryData[];
  readonly melds: readonly MeldViewData[];
  readonly score: number;
}
