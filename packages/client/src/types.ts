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
}

export interface MeldViewData {
  readonly tiles: readonly TileData[];
  readonly calledTileIndex?: number;
}

export interface PlayerViewState {
  readonly hand: readonly TileData[];
  readonly drawnTile?: TileData;
  readonly discards: readonly DiscardEntryData[];
  readonly melds: readonly MeldViewData[];
  readonly score: number;
}
