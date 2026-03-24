import { describe, it, expect } from "vitest";
import { type Tile, TileType } from "../tile/index.js";
import { MeldType } from "./types.js";
import {
  findChiCandidates,
  findPonCandidates,
  findMinkanCandidate,
  findAnkanCandidates,
  findKakanCandidates,
  getKuikaeConstraint,
  createChiMeld,
  createPonMeld,
  createAnkanMeld,
  createKakanMeld,
} from "./meld.js";
import type { Meld } from "./types.js";

// ヘルパー
function tile(type: TileType, id: number = 0, isRedDora: boolean = false): Tile {
  return { type, id, isRedDora };
}

// ===== findChiCandidates =====

describe("findChiCandidates", () => {
  it("手牌に順子構成牌があればチー候補が見つかる", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man2, 0), tile(TileType.Sou5, 0)];
    const called = tile(TileType.Man3, 1);
    const candidates = findChiCandidates(hand, called);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    // 1,2 で 3 をチー
    const c = candidates[0];
    expect(c.resultTiles.map((t) => t.type)).toEqual([TileType.Man1, TileType.Man2, TileType.Man3]);
  });

  it("字牌はチーできない", () => {
    const hand = [tile(TileType.Ton, 0), tile(TileType.Nan, 0)];
    const called = tile(TileType.Sha, 0);
    expect(findChiCandidates(hand, called)).toHaveLength(0);
  });

  it("異なるスートではチーできない", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man2, 0)];
    const called = tile(TileType.Sou3, 0);
    expect(findChiCandidates(hand, called)).toHaveLength(0);
  });

  it("複数のチー候補がある場合すべて列挙される", () => {
    // 手牌: 萬子4, 萬子5, 萬子6 → 捨て牌が萬子5 なら 4-5-6 の候補
    // 手牌: 萬子3, 萬子4, 萬子5, 萬子6 → 捨て牌が萬子5 なら 3-4-5 と 4-5-6
    const hand = [tile(TileType.Man3, 0), tile(TileType.Man4, 0), tile(TileType.Man6, 0)];
    const called = tile(TileType.Man5, 1);
    const candidates = findChiCandidates(hand, called);
    expect(candidates.length).toBe(2);
  });

  it("左端チー: 1,2 で 3 をチー", () => {
    const hand = [tile(TileType.Sou1, 0), tile(TileType.Sou2, 0)];
    const called = tile(TileType.Sou3, 1);
    const candidates = findChiCandidates(hand, called);
    expect(candidates).toHaveLength(1);
  });

  it("右端チー: 8,9 で 7 をチー", () => {
    const hand = [tile(TileType.Pin8, 0), tile(TileType.Pin9, 0)];
    const called = tile(TileType.Pin7, 1);
    const candidates = findChiCandidates(hand, called);
    expect(candidates).toHaveLength(1);
  });

  it("中央チー: 4,6 で 5 をチー", () => {
    const hand = [tile(TileType.Man4, 0), tile(TileType.Man6, 0)];
    const called = tile(TileType.Man5, 1);
    const candidates = findChiCandidates(hand, called);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].resultTiles.map((t) => t.type)).toEqual([
      TileType.Man4,
      TileType.Man5,
      TileType.Man6,
    ]);
  });
});

// ===== findPonCandidates =====

describe("findPonCandidates", () => {
  it("手牌に同種2枚があればポン候補が見つかる", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Sou5, 0)];
    const called = tile(TileType.Man1, 2);
    const candidates = findPonCandidates(hand, called);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toHaveLength(2);
  });

  it("手牌に同種3枚あれば3通りのポン候補", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)];
    const called = tile(TileType.Man1, 3);
    const candidates = findPonCandidates(hand, called);
    expect(candidates).toHaveLength(3); // C(3,2) = 3
  });

  it("同種牌が1枚しかなければポン不可", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Sou5, 0)];
    const called = tile(TileType.Man1, 2);
    expect(findPonCandidates(hand, called)).toHaveLength(0);
  });
});

// ===== findMinkanCandidate =====

describe("findMinkanCandidate", () => {
  it("手牌に同種3枚あれば明槓可能", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)];
    const called = tile(TileType.Man1, 3);
    const result = findMinkanCandidate(hand, called);
    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
  });

  it("手牌に同種2枚以下なら明槓不可", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man1, 1)];
    const called = tile(TileType.Man1, 2);
    expect(findMinkanCandidate(hand, called)).toBeUndefined();
  });
});

// ===== findAnkanCandidates =====

describe("findAnkanCandidates", () => {
  it("手牌に同種4枚あれば暗槓可能", () => {
    const hand = [
      tile(TileType.Man1, 0),
      tile(TileType.Man1, 1),
      tile(TileType.Man1, 2),
      tile(TileType.Man1, 3),
      tile(TileType.Sou5, 0),
    ];
    const candidates = findAnkanCandidates(hand);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tileType).toBe(TileType.Man1);
    expect(candidates[0].tiles).toHaveLength(4);
  });

  it("同種4枚が2組あれば2候補", () => {
    const hand = [
      tile(TileType.Man1, 0),
      tile(TileType.Man1, 1),
      tile(TileType.Man1, 2),
      tile(TileType.Man1, 3),
      tile(TileType.Sou1, 0),
      tile(TileType.Sou1, 1),
      tile(TileType.Sou1, 2),
      tile(TileType.Sou1, 3),
    ];
    const candidates = findAnkanCandidates(hand);
    expect(candidates).toHaveLength(2);
  });

  it("3枚以下なら暗槓不可", () => {
    const hand = [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)];
    expect(findAnkanCandidates(hand)).toHaveLength(0);
  });
});

// ===== findKakanCandidates =====

describe("findKakanCandidates", () => {
  it("ポンした副露と同種牌が手牌にあれば加槓可能", () => {
    const ponMeld: Meld = {
      type: MeldType.Pon,
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)],
      calledTile: tile(TileType.Man1, 2),
      fromPlayerIndex: 1,
    };
    const hand = [tile(TileType.Man1, 3), tile(TileType.Sou5, 0)];
    const candidates = findKakanCandidates(hand, [ponMeld]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].addTile.type).toBe(TileType.Man1);
  });

  it("ポン以外の副露は加槓対象にならない", () => {
    const ankanMeld: Meld = {
      type: MeldType.Ankan,
      tiles: [
        tile(TileType.Man1, 0),
        tile(TileType.Man1, 1),
        tile(TileType.Man1, 2),
        tile(TileType.Man1, 3),
      ],
    };
    const hand = [tile(TileType.Sou5, 0)];
    expect(findKakanCandidates(hand, [ankanMeld])).toHaveLength(0);
  });

  it("手牌に対応する牌がなければ加槓不可", () => {
    const ponMeld: Meld = {
      type: MeldType.Pon,
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)],
      calledTile: tile(TileType.Man1, 2),
      fromPlayerIndex: 1,
    };
    const hand = [tile(TileType.Sou5, 0)];
    expect(findKakanCandidates(hand, [ponMeld])).toHaveLength(0);
  });
});

// ===== getKuikaeConstraint =====

describe("getKuikaeConstraint", () => {
  it("辺張チー (1,2 で 3 をチー): 3 のみ食い替え禁止（スジは範囲外）", () => {
    const candidate = {
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Man3, 1),
      resultTiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0), tile(TileType.Man3, 1)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const constraint = getKuikaeConstraint(candidate);
    expect(constraint.forbiddenTypes).toContain(TileType.Man3);
    // 1-1=0 は範囲外なのでスジ食い替えなし
    expect(constraint.forbiddenTypes).toHaveLength(1);
  });

  it("辺張チー (8,9 で 7 をチー): 7 のみ食い替え禁止（スジは範囲外）", () => {
    const candidate = {
      tiles: [tile(TileType.Pin8, 0), tile(TileType.Pin9, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Pin7, 1),
      resultTiles: [tile(TileType.Pin7, 1), tile(TileType.Pin8, 0), tile(TileType.Pin9, 0)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const constraint = getKuikaeConstraint(candidate);
    expect(constraint.forbiddenTypes).toContain(TileType.Pin7);
    // 9+1=10 は範囲外なのでスジ食い替えなし
    expect(constraint.forbiddenTypes).toHaveLength(1);
  });

  it("中央チー (4,6 で 5 をチー): 5 のみ食い替え禁止（スジなし）", () => {
    const candidate = {
      tiles: [tile(TileType.Sou4, 0), tile(TileType.Sou6, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Sou5, 1),
      resultTiles: [tile(TileType.Sou4, 0), tile(TileType.Sou5, 1), tile(TileType.Sou6, 0)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const constraint = getKuikaeConstraint(candidate);
    expect(constraint.forbiddenTypes).toContain(TileType.Sou5);
    expect(constraint.forbiddenTypes).toHaveLength(1);
  });

  it("端牌チー (7,8 で 9 をチー): 9 と 6 が食い替え禁止", () => {
    const candidate = {
      tiles: [tile(TileType.Man7, 0), tile(TileType.Man8, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Man9, 1),
      resultTiles: [tile(TileType.Man7, 0), tile(TileType.Man8, 0), tile(TileType.Man9, 1)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const constraint = getKuikaeConstraint(candidate);
    expect(constraint.forbiddenTypes).toContain(TileType.Man9);
    expect(constraint.forbiddenTypes).toContain(TileType.Man6);
    expect(constraint.forbiddenTypes).toHaveLength(2);
  });

  it("1,2 で 3 をチー → スジは 6 だが、7,8 で 9 をチー → スジは 6, 範囲外 (10) はなし", () => {
    const candidate = {
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Man3, 1),
      resultTiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0), tile(TileType.Man3, 1)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const constraint = getKuikaeConstraint(candidate);
    // 3 + 6（1→2→3で3が左端、右端+1=4... wait, 3がcalledで左端、右端は3(=resultNumbers[2]=3? No)
    // resultTiles は [man1, man2, man3], calledNum=3, resultNumbers[2]=3 → calledNum === resultNumbers[2] → 右端
    // 右端: sujiNum = resultNumbers[0] - 1 = 1 - 1 = 0 → 範囲外
    // 実際は calledTile が man3、result が [man1,man2,man3] → man3 は右端
    // なので禁止は man3 のみ（スジの 0 は範囲外）
    expect(constraint.forbiddenTypes).toContain(TileType.Man3);
    // man1-1=0 は範囲外なのでスジ食い替えなし
    expect(constraint.forbiddenTypes).toHaveLength(1);
  });
});

// ===== Meld構築ヘルパー =====

describe("createChiMeld", () => {
  it("チーの Meld が正しく構築される", () => {
    const candidate = {
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0)] as [Tile, Tile],
      calledTile: tile(TileType.Man3, 1),
      resultTiles: [tile(TileType.Man1, 0), tile(TileType.Man2, 0), tile(TileType.Man3, 1)] as [
        Tile,
        Tile,
        Tile,
      ],
    };
    const meld = createChiMeld(candidate, 3);
    expect(meld.type).toBe(MeldType.Chi);
    expect(meld.tiles).toHaveLength(3);
    expect(meld.fromPlayerIndex).toBe(3);
  });
});

describe("createPonMeld", () => {
  it("ポンの Meld が正しく構築される", () => {
    const meld = createPonMeld(
      [tile(TileType.Man1, 0), tile(TileType.Man1, 1)],
      tile(TileType.Man1, 2),
      2,
    );
    expect(meld.type).toBe(MeldType.Pon);
    expect(meld.tiles).toHaveLength(3);
    expect(meld.calledTile?.type).toBe(TileType.Man1);
  });
});

describe("createAnkanMeld", () => {
  it("暗槓の Meld が正しく構築される", () => {
    const meld = createAnkanMeld([
      tile(TileType.Man1, 0),
      tile(TileType.Man1, 1),
      tile(TileType.Man1, 2),
      tile(TileType.Man1, 3),
    ]);
    expect(meld.type).toBe(MeldType.Ankan);
    expect(meld.tiles).toHaveLength(4);
    expect(meld.calledTile).toBeUndefined();
    expect(meld.fromPlayerIndex).toBeUndefined();
  });
});

describe("createKakanMeld", () => {
  it("加槓の Meld が正しく構築される", () => {
    const ponMeld: Meld = {
      type: MeldType.Pon,
      tiles: [tile(TileType.Man1, 0), tile(TileType.Man1, 1), tile(TileType.Man1, 2)],
      calledTile: tile(TileType.Man1, 2),
      fromPlayerIndex: 1,
    };
    const meld = createKakanMeld(ponMeld, tile(TileType.Man1, 3));
    expect(meld.type).toBe(MeldType.Kakan);
    expect(meld.tiles).toHaveLength(4);
    expect(meld.fromPlayerIndex).toBe(1);
  });
});
