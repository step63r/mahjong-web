import { describe, it, expect } from "vitest";
import { Wall } from "./wall.js";
import { createAllTiles } from "../tile/index.js";

// ===== Wall.create =====

describe("Wall.create", () => {
  it("牌山が生成される", () => {
    const wall = Wall.create();
    expect(wall.getAllTiles()).toHaveLength(136);
  });

  it("シャッフルにより牌の順序がランダム化される", () => {
    const wall1 = Wall.create();
    const wall2 = Wall.create();
    // 2回生成して完全に一致する可能性は天文学的に低い
    const types1 = wall1.getAllTiles().map((t) => t.type);
    const types2 = wall2.getAllTiles().map((t) => t.type);
    expect(types1).not.toEqual(types2);
  });
});

// ===== Wall.fromTiles =====

describe("Wall.fromTiles", () => {
  it("136枚でない場合はエラー", () => {
    expect(() => Wall.fromTiles([])).toThrow("136枚");
  });

  it("指定した順序で牌山が作成される", () => {
    const tiles = createAllTiles("none");
    const wall = Wall.fromTiles(tiles);
    expect(wall.getAllTiles()[0].type).toBe(tiles[0].type);
  });
});

// ===== 配牌 =====

describe("dealInitialHands", () => {
  it("4人に各13枚ずつ配られる", () => {
    const wall = Wall.create();
    const hands = wall.dealInitialHands();
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(13);
    }
  });

  it("配牌後に52枚消費されている（残り: 122 - 52 - 0 = 70）", () => {
    const wall = Wall.create();
    wall.dealInitialHands();
    expect(wall.remainingDrawCount).toBe(70);
  });

  it("配牌された牌に重複がない", () => {
    const wall = Wall.create();
    const hands = wall.dealInitialHands();
    const allDealt = hands.flat();
    const ids = allDealt.map((t) => `${t.type}-${t.id}`);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(52);
  });
});

// ===== ツモ =====

describe("drawTile", () => {
  it("ツモで1枚引ける", () => {
    const tiles = createAllTiles("none");
    const wall = Wall.fromTiles(tiles);
    const drawn = wall.drawTile();
    expect(drawn.type).toBe(tiles[0].type);
    expect(drawn.id).toBe(tiles[0].id);
  });

  it("ツモのたびに残り枚数が減る", () => {
    const wall = Wall.create();
    const initialRemaining = wall.remainingDrawCount;
    wall.drawTile();
    expect(wall.remainingDrawCount).toBe(initialRemaining - 1);
  });

  it("牌山が空になるとエラー", () => {
    const wall = Wall.create();
    // 配牌(52枚) + 残り70枚 = 122枚ツモ可能
    wall.dealInitialHands();
    for (let i = 0; i < 70; i++) {
      wall.drawTile();
    }
    expect(() => wall.drawTile()).toThrow("ツモ牌がありません");
  });
});

// ===== 嶺上牌 =====

describe("drawRinshanTile", () => {
  it("嶺上牌が4枚引ける", () => {
    const wall = Wall.create();
    for (let i = 0; i < 4; i++) {
      const tile = wall.drawRinshanTile();
      expect(tile).toBeDefined();
    }
  });

  it("嶺上牌を引くと残りツモ数が減る", () => {
    const wall = Wall.create();
    const initialRemaining = wall.remainingDrawCount;
    wall.drawRinshanTile();
    expect(wall.remainingDrawCount).toBe(initialRemaining - 1);
  });

  it("5枚目を引こうとするとエラー", () => {
    const wall = Wall.create();
    for (let i = 0; i < 4; i++) {
      wall.drawRinshanTile();
    }
    expect(() => wall.drawRinshanTile()).toThrow("嶺上牌がありません");
  });
});

// ===== ドラ表示牌 =====

describe("getDoraIndicators", () => {
  it("初期状態では1枚のドラ表示牌", () => {
    const wall = Wall.create();
    const indicators = wall.getDoraIndicators();
    expect(indicators).toHaveLength(1);
  });

  it("槓ドラを開くと表示牌が増える", () => {
    const wall = Wall.create();
    wall.openKanDora();
    expect(wall.getDoraIndicators()).toHaveLength(2);

    wall.openKanDora();
    expect(wall.getDoraIndicators()).toHaveLength(3);
  });

  it("槓ドラは最大4回まで開ける", () => {
    const wall = Wall.create();
    for (let i = 0; i < 4; i++) {
      wall.openKanDora();
    }
    expect(wall.getDoraIndicators()).toHaveLength(5);
    expect(() => wall.openKanDora()).toThrow("これ以上開けません");
  });
});

describe("getUraDoraIndicators", () => {
  it("裏ドラ表示牌の枚数はドラ表示牌と同数", () => {
    const wall = Wall.create();
    expect(wall.getUraDoraIndicators()).toHaveLength(1);

    wall.openKanDora();
    expect(wall.getUraDoraIndicators()).toHaveLength(2);
  });
});

// ===== ドラ表示牌の位置が正しいこと（固定牌山で検証） =====

describe("ドラ表示牌のインデックス", () => {
  it("初期ドラ表示牌はインデックス130の牌", () => {
    const tiles = createAllTiles("none");
    const wall = Wall.fromTiles(tiles);
    const indicators = wall.getDoraIndicators();
    expect(indicators[0]).toEqual(tiles[130]);
  });

  it("槓ドラ1はインデックス132の牌", () => {
    const tiles = createAllTiles("none");
    const wall = Wall.fromTiles(tiles);
    wall.openKanDora();
    const indicators = wall.getDoraIndicators();
    expect(indicators[1]).toEqual(tiles[132]);
  });

  it("裏ドラ表示牌はインデックス131の牌", () => {
    const tiles = createAllTiles("none");
    const wall = Wall.fromTiles(tiles);
    const uraIndicators = wall.getUraDoraIndicators();
    expect(uraIndicators[0]).toEqual(tiles[131]);
  });
});
