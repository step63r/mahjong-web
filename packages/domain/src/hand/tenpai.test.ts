import { describe, it, expect } from "vitest";
import { getTenpaiTiles, isKyuushuKyuuhai } from "./tenpai.js";
import { TileType as TT } from "../tile/index.js";
import type { Meld } from "../meld/index.js";

// ===== getTenpaiTiles =====

describe("getTenpaiTiles", () => {
  it("両面待ち: 1m2m3m4m5m6m7m8m 1s2s3s 1p1p → 9m 待ちなど", () => {
    // 123m 456m 78m 123s 11p → 6m9m 待ち
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Sou1,
      TT.Sou2,
      TT.Sou3,
      TT.Pin1,
      TT.Pin1,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toContain(TT.Man6);
    expect(waiting).toContain(TT.Man9);
  });

  it("単騎待ち: 111m222m333m444m 5m → 5m 待ち", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man2,
      TT.Man2,
      TT.Man2,
      TT.Man3,
      TT.Man3,
      TT.Man3,
      TT.Man4,
      TT.Man4,
      TT.Man4,
      TT.Man5,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toContain(TT.Man5);
  });

  it("シャンポン待ち: 123m 456m 789m 11p 22s → 1p 2s", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Pin1,
      TT.Pin1,
      TT.Sou2,
      TT.Sou2,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toContain(TT.Pin1);
    expect(waiting).toContain(TT.Sou2);
  });

  it("七対子テンパイ: 11m22m33m44m55m66m7m → 7m 待ち", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man1,
      TT.Man2,
      TT.Man2,
      TT.Man3,
      TT.Man3,
      TT.Man4,
      TT.Man4,
      TT.Man5,
      TT.Man5,
      TT.Man6,
      TT.Man6,
      TT.Man7,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toContain(TT.Man7);
  });

  it("国士無双テンパイ: 1m9m1s9s1p9p東南西北白發 → 中待ち", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Man1, // 雀頭用ダミー
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toContain(TT.Chun);
  });

  it("テンパイでない場合は空配列", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man3,
      TT.Man5,
      TT.Man7,
      TT.Man9,
      TT.Sou1,
      TT.Sou3,
      TT.Sou5,
      TT.Pin2,
      TT.Pin4,
      TT.Pin6,
      TT.Pin8,
      TT.Ton,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    expect(waiting).toHaveLength(0);
  });

  it("副露ありの場合でもテンパイ判定ができる", () => {
    // 78m + ポン(111s) + チー(456p) → 6m9m 待ち
    const closedTiles: TT[] = [TT.Man7, TT.Man8, TT.Ton, TT.Ton, TT.Ton, TT.Nan, TT.Nan];
    const melds: Meld[] = [
      {
        type: "pon",
        tiles: [
          { type: TT.Sou1, id: 0, isRedDora: false },
          { type: TT.Sou1, id: 1, isRedDora: false },
          { type: TT.Sou1, id: 2, isRedDora: false },
        ],
        fromPlayerIndex: 0,
      },
      {
        type: "chi",
        tiles: [
          { type: TT.Pin4, id: 0, isRedDora: false },
          { type: TT.Pin5, id: 0, isRedDora: false },
          { type: TT.Pin6, id: 0, isRedDora: false },
        ],
        fromPlayerIndex: 3,
      },
    ];
    const waiting = getTenpaiTiles(closedTiles, melds);
    expect(waiting).toContain(TT.Man6);
    expect(waiting).toContain(TT.Man9);
  });

  it("同一牌が4枚使用済みだと待ち牌に含まれない", () => {
    // 手牌13枚で4枚使い切り → その牌は待ちに含まれない
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Sou1,
      TT.Sou2,
      TT.Sou3,
      TT.Pin1,
      TT.Pin2,
      TT.Pin3,
      TT.Ton,
    ];
    const waiting = getTenpaiTiles(closedTiles, []);
    // man1 はもう4枚使っているので待ちに含まれない
    expect(waiting).not.toContain(TT.Man1);
  });
});

// ===== isKyuushuKyuuhai =====

describe("isKyuushuKyuuhai", () => {
  it("幺九牌が9種以上なら true", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
    ];
    expect(isKyuushuKyuuhai(closedTiles)).toBe(true);
  });

  it("幺九牌が9種ちょうどなら true", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Man2,
      TT.Man2,
      TT.Man3,
      TT.Man3,
      TT.Man4,
    ];
    expect(isKyuushuKyuuhai(closedTiles)).toBe(true);
  });

  it("幺九牌が8種以下なら false", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
    ];
    expect(isKyuushuKyuuhai(closedTiles)).toBe(false);
  });

  it("13種全て揃っていたら true", () => {
    const closedTiles: TT[] = [
      TT.Man1,
      TT.Man9,
      TT.Sou1,
      TT.Sou9,
      TT.Pin1,
      TT.Pin9,
      TT.Ton,
      TT.Nan,
      TT.Sha,
      TT.Pei,
      TT.Haku,
      TT.Hatsu,
      TT.Chun,
      TT.Man1, // 14枚目
    ];
    expect(isKyuushuKyuuhai(closedTiles)).toBe(true);
  });

  it("中張牌だけでは false", () => {
    const closedTiles: TT[] = [
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Sou2,
      TT.Sou3,
      TT.Sou4,
      TT.Sou5,
      TT.Sou6,
      TT.Sou7,
      TT.Sou8,
    ];
    expect(isKyuushuKyuuhai(closedTiles)).toBe(false);
  });
});
