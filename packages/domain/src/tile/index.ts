export { TileSuit, TileType, ALL_TILE_TYPES, TILE_SUIT_MAP } from "./types.js";
export type { Tile, NumberTileInfo } from "./types.js";
export { createAllTiles } from "./create.js";
export type { RedDoraConfig } from "./create.js";
export {
  isNumberTile,
  isHonorTile,
  isWindTile,
  isDragonTile,
  isTerminalOrHonor,
  isTerminal,
  getNumberTileInfo,
  getTileSuit,
  getDoraFromIndicator,
  tileOrderIndex,
  sortTiles,
  isSameTileType,
  isSameTile,
} from "./utils.js";
