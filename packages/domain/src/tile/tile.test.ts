import { describe, it, expect } from "vitest";
import {
  TileType,
  TileSuit,
  ALL_TILE_TYPES,
  createAllTiles,
  isNumberTile,
  isHonorTile,
  isWindTile,
  isDragonTile,
  isTerminalOrHonor,
  isTerminal,
  getNumberTileInfo,
  getTileSuit,
  getDoraFromIndicator,
  sortTiles,
  isSameTileType,
  isSameTile,
} from "./index.js";

// ===== createAllTiles =====

describe("createAllTiles", () => {
  it("136枚の牌が生成される", () => {
    const tiles = createAllTiles();
    expect(tiles).toHaveLength(136);
  });

  it("各牌タイプが4枚ずつ存在する", () => {
    const tiles = createAllTiles();
    for (const tileType of ALL_TILE_TYPES) {
      const count = tiles.filter((t) => t.type === tileType).length;
      expect(count, `${tileType} should have 4 tiles`).toBe(4);
    }
  });

  it("赤ドラなし: 赤ドラが0枚", () => {
    const tiles = createAllTiles("none");
    const redDora = tiles.filter((t) => t.isRedDora);
    expect(redDora).toHaveLength(0);
  });

  it("赤ドラ one-each: 5萬・5索・5筒 各1枚（計3枚）", () => {
    const tiles = createAllTiles("one-each");
    const redDora = tiles.filter((t) => t.isRedDora);
    expect(redDora).toHaveLength(3);

    const redMan5 = redDora.filter((t) => t.type === TileType.Man5);
    const redSou5 = redDora.filter((t) => t.type === TileType.Sou5);
    const redPin5 = redDora.filter((t) => t.type === TileType.Pin5);
    expect(redMan5).toHaveLength(1);
    expect(redSou5).toHaveLength(1);
    expect(redPin5).toHaveLength(1);
  });

  it("赤ドラ two-pinzu (デフォルト): 5萬1枚・5索1枚・5筒2枚（計4枚）", () => {
    const tiles = createAllTiles("two-pinzu");
    const redDora = tiles.filter((t) => t.isRedDora);
    expect(redDora).toHaveLength(4);

    const redMan5 = redDora.filter((t) => t.type === TileType.Man5);
    const redSou5 = redDora.filter((t) => t.type === TileType.Sou5);
    const redPin5 = redDora.filter((t) => t.type === TileType.Pin5);
    expect(redMan5).toHaveLength(1);
    expect(redSou5).toHaveLength(1);
    expect(redPin5).toHaveLength(2);
  });

  it("引数なしのデフォルトは two-pinzu", () => {
    const tiles = createAllTiles();
    const redDora = tiles.filter((t) => t.isRedDora);
    expect(redDora).toHaveLength(4);
  });

  it("各牌の id は 0-3 の範囲", () => {
    const tiles = createAllTiles();
    for (const tile of tiles) {
      expect(tile.id).toBeGreaterThanOrEqual(0);
      expect(tile.id).toBeLessThanOrEqual(3);
    }
  });

  it("同一 type 内で id がユニーク", () => {
    const tiles = createAllTiles();
    for (const tileType of ALL_TILE_TYPES) {
      const ids = tiles.filter((t) => t.type === tileType).map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size, `${tileType} should have unique ids`).toBe(4);
    }
  });
});

// ===== ALL_TILE_TYPES =====

describe("ALL_TILE_TYPES", () => {
  it("34種の牌タイプが定義されている", () => {
    expect(ALL_TILE_TYPES).toHaveLength(34);
  });

  it("重複がない", () => {
    const set = new Set(ALL_TILE_TYPES);
    expect(set.size).toBe(34);
  });
});

// ===== 判定関数 =====

describe("isNumberTile", () => {
  it("萬子・索子・筒子は数牌", () => {
    const numberTypes = [
      TileType.Man1,
      TileType.Man9,
      TileType.Sou1,
      TileType.Sou5,
      TileType.Pin1,
      TileType.Pin9,
    ];
    for (const type of numberTypes) {
      expect(isNumberTile({ type, id: 0, isRedDora: false }), type).toBe(true);
    }
  });

  it("字牌は数牌でない", () => {
    const honorTypes = [TileType.Ton, TileType.Haku, TileType.Chun];
    for (const type of honorTypes) {
      expect(isNumberTile({ type, id: 0, isRedDora: false }), type).toBe(false);
    }
  });
});

describe("isHonorTile", () => {
  it("風牌・三元牌は字牌", () => {
    const honorTypes = [
      TileType.Ton,
      TileType.Nan,
      TileType.Sha,
      TileType.Pei,
      TileType.Haku,
      TileType.Hatsu,
      TileType.Chun,
    ];
    for (const type of honorTypes) {
      expect(isHonorTile({ type, id: 0, isRedDora: false }), type).toBe(true);
    }
  });

  it("数牌は字牌でない", () => {
    expect(isHonorTile({ type: TileType.Man1, id: 0, isRedDora: false })).toBe(false);
  });
});

describe("isWindTile / isDragonTile", () => {
  it("東南西北は風牌", () => {
    expect(isWindTile({ type: TileType.Ton, id: 0, isRedDora: false })).toBe(true);
    expect(isWindTile({ type: TileType.Pei, id: 0, isRedDora: false })).toBe(true);
  });

  it("三元牌は風牌でない", () => {
    expect(isWindTile({ type: TileType.Haku, id: 0, isRedDora: false })).toBe(false);
  });

  it("白發中は三元牌", () => {
    expect(isDragonTile({ type: TileType.Haku, id: 0, isRedDora: false })).toBe(true);
    expect(isDragonTile({ type: TileType.Hatsu, id: 0, isRedDora: false })).toBe(true);
    expect(isDragonTile({ type: TileType.Chun, id: 0, isRedDora: false })).toBe(true);
  });
});

describe("isTerminalOrHonor / isTerminal", () => {
  it("1, 9 の数牌は幺九牌かつ老頭牌", () => {
    expect(isTerminalOrHonor({ type: TileType.Man1, id: 0, isRedDora: false })).toBe(true);
    expect(isTerminalOrHonor({ type: TileType.Sou9, id: 0, isRedDora: false })).toBe(true);
    expect(isTerminal({ type: TileType.Man1, id: 0, isRedDora: false })).toBe(true);
    expect(isTerminal({ type: TileType.Pin9, id: 0, isRedDora: false })).toBe(true);
  });

  it("2-8 の数牌は幺九牌でも老頭牌でもない", () => {
    expect(isTerminalOrHonor({ type: TileType.Man5, id: 0, isRedDora: false })).toBe(false);
    expect(isTerminal({ type: TileType.Sou5, id: 0, isRedDora: false })).toBe(false);
  });

  it("字牌は幺九牌だが老頭牌ではない", () => {
    expect(isTerminalOrHonor({ type: TileType.Ton, id: 0, isRedDora: false })).toBe(true);
    expect(isTerminal({ type: TileType.Ton, id: 0, isRedDora: false })).toBe(false);
  });
});

// ===== getNumberTileInfo =====

describe("getNumberTileInfo", () => {
  it("萬子5 → suit=manzu, number=5", () => {
    const info = getNumberTileInfo({ type: TileType.Man5, id: 0, isRedDora: false });
    expect(info).toEqual({ suit: TileSuit.Manzu, number: 5 });
  });

  it("字牌は undefined", () => {
    const info = getNumberTileInfo({ type: TileType.Ton, id: 0, isRedDora: false });
    expect(info).toBeUndefined();
  });
});

// ===== getTileSuit =====

describe("getTileSuit", () => {
  it("各牌タイプの正しいスートを返す", () => {
    expect(getTileSuit({ type: TileType.Man1, id: 0, isRedDora: false })).toBe(TileSuit.Manzu);
    expect(getTileSuit({ type: TileType.Sou1, id: 0, isRedDora: false })).toBe(TileSuit.Souzu);
    expect(getTileSuit({ type: TileType.Pin1, id: 0, isRedDora: false })).toBe(TileSuit.Pinzu);
    expect(getTileSuit({ type: TileType.Ton, id: 0, isRedDora: false })).toBe(TileSuit.Kaze);
    expect(getTileSuit({ type: TileType.Haku, id: 0, isRedDora: false })).toBe(TileSuit.Sangen);
  });
});

// ===== getDoraFromIndicator =====

describe("getDoraFromIndicator", () => {
  it("数牌: 次の数字がドラ", () => {
    expect(getDoraFromIndicator(TileType.Man1)).toBe(TileType.Man2);
    expect(getDoraFromIndicator(TileType.Sou5)).toBe(TileType.Sou6);
    expect(getDoraFromIndicator(TileType.Pin8)).toBe(TileType.Pin9);
  });

  it("数牌: 9 の次は 1", () => {
    expect(getDoraFromIndicator(TileType.Man9)).toBe(TileType.Man1);
    expect(getDoraFromIndicator(TileType.Sou9)).toBe(TileType.Sou1);
    expect(getDoraFromIndicator(TileType.Pin9)).toBe(TileType.Pin1);
  });

  it("風牌: 東→南→西→北→東", () => {
    expect(getDoraFromIndicator(TileType.Ton)).toBe(TileType.Nan);
    expect(getDoraFromIndicator(TileType.Nan)).toBe(TileType.Sha);
    expect(getDoraFromIndicator(TileType.Sha)).toBe(TileType.Pei);
    expect(getDoraFromIndicator(TileType.Pei)).toBe(TileType.Ton);
  });

  it("三元牌: 白→發→中→白", () => {
    expect(getDoraFromIndicator(TileType.Haku)).toBe(TileType.Hatsu);
    expect(getDoraFromIndicator(TileType.Hatsu)).toBe(TileType.Chun);
    expect(getDoraFromIndicator(TileType.Chun)).toBe(TileType.Haku);
  });
});

// ===== sortTiles =====

describe("sortTiles", () => {
  it("萬子→索子→筒子→字牌の順にソートされる", () => {
    const tiles = [
      { type: TileType.Ton, id: 0, isRedDora: false },
      { type: TileType.Pin1, id: 0, isRedDora: false },
      { type: TileType.Man1, id: 0, isRedDora: false },
      { type: TileType.Sou1, id: 0, isRedDora: false },
    ];
    const sorted = sortTiles(tiles);
    expect(sorted.map((t) => t.type)).toEqual([
      TileType.Man1,
      TileType.Sou1,
      TileType.Pin1,
      TileType.Ton,
    ]);
  });

  it("同種牌内では赤ドラが先", () => {
    const tiles = [
      { type: TileType.Man5, id: 1, isRedDora: false },
      { type: TileType.Man5, id: 0, isRedDora: true },
    ];
    const sorted = sortTiles(tiles);
    expect(sorted[0].isRedDora).toBe(true);
    expect(sorted[1].isRedDora).toBe(false);
  });

  it("元の配列を破壊しない", () => {
    const tiles = [
      { type: TileType.Sou1, id: 0, isRedDora: false },
      { type: TileType.Man1, id: 0, isRedDora: false },
    ];
    const original = [...tiles];
    sortTiles(tiles);
    expect(tiles).toEqual(original);
  });
});

// ===== isSameTileType / isSameTile =====

describe("isSameTileType / isSameTile", () => {
  it("同じ type なら isSameTileType は true", () => {
    const a = { type: TileType.Man1, id: 0, isRedDora: false };
    const b = { type: TileType.Man1, id: 1, isRedDora: false };
    expect(isSameTileType(a, b)).toBe(true);
  });

  it("異なる type なら isSameTileType は false", () => {
    const a = { type: TileType.Man1, id: 0, isRedDora: false };
    const b = { type: TileType.Man2, id: 0, isRedDora: false };
    expect(isSameTileType(a, b)).toBe(false);
  });

  it("type と id が同じなら isSameTile は true", () => {
    const a = { type: TileType.Man1, id: 0, isRedDora: true };
    const b = { type: TileType.Man1, id: 0, isRedDora: false };
    expect(isSameTile(a, b)).toBe(true);
  });

  it("id が異なれば isSameTile は false", () => {
    const a = { type: TileType.Man1, id: 0, isRedDora: false };
    const b = { type: TileType.Man1, id: 1, isRedDora: false };
    expect(isSameTile(a, b)).toBe(false);
  });
});
