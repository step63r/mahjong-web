import { describe, it, expect } from "vitest";
import { Hand } from "./hand.js";
import { type Tile, TileType } from "../tile/index.js";

// ヘルパー: 簡単に牌を作成
function tile(type: TileType, id: number = 0, isRedDora: boolean = false): Tile {
  return { type, id, isRedDora };
}

// ===== 初期化 =====

describe("Hand 初期化", () => {
  it("空の手牌で生成できる", () => {
    const hand = new Hand();
    expect(hand.count).toBe(0);
    expect(hand.getTiles()).toEqual([]);
  });

  it("初期牌を指定して生成できる", () => {
    const tiles = [tile(TileType.Man1), tile(TileType.Man2), tile(TileType.Man3)];
    const hand = new Hand(tiles);
    expect(hand.count).toBe(3);
  });

  it("コンストラクタに渡した配列を変更しても手牌に影響しない", () => {
    const tiles = [tile(TileType.Man1)];
    const hand = new Hand(tiles);
    tiles.push(tile(TileType.Man2));
    expect(hand.count).toBe(1);
  });
});

// ===== addTile =====

describe("Hand.addTile", () => {
  it("ツモで手牌が1枚増える", () => {
    const hand = new Hand([tile(TileType.Man1)]);
    hand.addTile(tile(TileType.Man2));
    expect(hand.count).toBe(2);
  });
});

// ===== removeTile =====

describe("Hand.removeTile", () => {
  it("指定した牌を手牌から除去できる", () => {
    const t1 = tile(TileType.Man1, 0);
    const t2 = tile(TileType.Man2, 0);
    const hand = new Hand([t1, t2]);
    const removed = hand.removeTile(t1);
    expect(removed.type).toBe(TileType.Man1);
    expect(hand.count).toBe(1);
  });

  it("同じ type で id が異なる牌を区別して除去", () => {
    const t1 = tile(TileType.Man1, 0);
    const t2 = tile(TileType.Man1, 1);
    const hand = new Hand([t1, t2]);
    hand.removeTile(t2);
    expect(hand.count).toBe(1);
    expect(hand.getTiles()[0].id).toBe(0);
  });

  it("存在しない牌を除去しようとするとエラー", () => {
    const hand = new Hand([tile(TileType.Man1, 0)]);
    expect(() => hand.removeTile(tile(TileType.Man2, 0))).toThrow("手牌に指定の牌がありません");
  });
});

// ===== removeTilesByType =====

describe("Hand.removeTilesByType", () => {
  it("指定 type の牌を複数枚除去できる", () => {
    const hand = new Hand([
      tile(TileType.Man1, 0),
      tile(TileType.Man1, 1),
      tile(TileType.Man1, 2),
      tile(TileType.Man2, 0),
    ]);
    const removed = hand.removeTilesByType(TileType.Man1, 2);
    expect(removed).toHaveLength(2);
    expect(hand.count).toBe(2);
  });

  it("指定枚数が足りない場合はエラー", () => {
    const hand = new Hand([tile(TileType.Man1, 0)]);
    expect(() => hand.removeTilesByType(TileType.Man1, 2)).toThrow("2枚ありません");
  });
});

// ===== countByType =====

describe("Hand.countByType", () => {
  it("指定 type の枚数を返す", () => {
    const hand = new Hand([tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man2, 0)]);
    expect(hand.countByType(TileType.Man1)).toBe(2);
    expect(hand.countByType(TileType.Man2)).toBe(1);
    expect(hand.countByType(TileType.Man3)).toBe(0);
  });
});

// ===== contains / containsType =====

describe("Hand.contains / Hand.containsType", () => {
  it("contains: type と id で判定", () => {
    const t1 = tile(TileType.Man1, 0);
    const hand = new Hand([t1]);
    expect(hand.contains(t1)).toBe(true);
    expect(hand.contains(tile(TileType.Man1, 1))).toBe(false);
  });

  it("containsType: type のみで判定", () => {
    const hand = new Hand([tile(TileType.Man1, 0)]);
    expect(hand.containsType(TileType.Man1)).toBe(true);
    expect(hand.containsType(TileType.Man2)).toBe(false);
  });
});

// ===== getSortedTiles =====

describe("Hand.getSortedTiles", () => {
  it("ソートされた手牌を返す", () => {
    const hand = new Hand([
      tile(TileType.Ton, 0),
      tile(TileType.Man1, 0),
      tile(TileType.Pin9, 0),
      tile(TileType.Sou5, 0),
    ]);
    const sorted = hand.getSortedTiles();
    expect(sorted.map((t) => t.type)).toEqual([
      TileType.Man1,
      TileType.Sou5,
      TileType.Pin9,
      TileType.Ton,
    ]);
  });

  it("内部状態を変更しない", () => {
    const hand = new Hand([tile(TileType.Ton, 0), tile(TileType.Man1, 0)]);
    const original = hand.getTiles().map((t) => t.type);
    hand.getSortedTiles();
    const after = hand.getTiles().map((t) => t.type);
    expect(after).toEqual(original);
  });
});
