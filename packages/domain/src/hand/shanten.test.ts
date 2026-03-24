import { describe, it, expect } from "vitest";
import { TileType as TT } from "../tile/index.js";
import {
  calculateShanten,
  calculateShantenForEachDiscard,
  calculateAcceptanceCount,
} from "./shanten.js";

// ===== calculateShanten =====

describe("calculateShanten", () => {
  describe("通常手（4面子1雀頭）", () => {
    it("和了形（0面子 + 副露4）は -1", () => {
      // 雀頭のみ（副露4面子あり）
      const hand = [TT.Man1, TT.Man1];
      expect(calculateShanten(hand, 4)).toBe(-1);
    });

    it("テンパイ = 0", () => {
      // 萬子 1-2-3, 4-5-6, 7-8-9, 索子 1-2-3, 筒子 1 → 筒子1待ち
      const hand = [
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou1,
        TT.Sou2,
        TT.Sou3,
        TT.Pin1,
      ];
      expect(calculateShanten(hand, 0)).toBe(0);
    });

    it("1向聴", () => {
      // 2面子 + 2ターツ + 雀頭 + 孤立1枚
      const hand = [
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Sou1,
        TT.Sou2,
        TT.Sou5,
        TT.Sou6,
        TT.Ton,
        TT.Ton,
        TT.Haku,
      ];
      expect(calculateShanten(hand, 0)).toBe(1);
    });

    it("2向聴", () => {
      // 2面子 + 1ターツ + 雀頭 + 孤立3枚
      const hand = [
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Sou1,
        TT.Sou2,
        TT.Pin1,
        TT.Pin1,
        TT.Ton,
        TT.Nan,
        TT.Haku,
      ];
      expect(calculateShanten(hand, 0)).toBe(2);
    });

    it("バラバラの配牌は高い向聴数", () => {
      const hand = [
        TT.Man1,
        TT.Man3,
        TT.Man5,
        TT.Sou2,
        TT.Sou4,
        TT.Sou6,
        TT.Pin1,
        TT.Pin9,
        TT.Ton,
        TT.Nan,
        TT.Sha,
        TT.Haku,
        TT.Chun,
      ];
      const sh = calculateShanten(hand, 0);
      expect(sh).toBeGreaterThanOrEqual(3);
      expect(sh).toBeLessThanOrEqual(8);
    });

    it("副露ありの場合、向聴数が正しく下がる", () => {
      // 副露2 + 手牌7枚で 0面子+2ターツ+雀頭+孤立1 = 1向聴
      const hand = [TT.Sou1, TT.Sou2, TT.Pin1, TT.Pin2, TT.Ton, TT.Ton, TT.Haku];
      const sh = calculateShanten(hand, 2);
      expect(sh).toBe(1);
    });

    it("副露ありでテンパイ", () => {
      // 副露3 + 手牌4枚で1面子+雀頭待ち
      const hand = [TT.Man1, TT.Man2, TT.Man3, TT.Pin1];
      expect(calculateShanten(hand, 3)).toBe(0);
    });
  });

  describe("七対子", () => {
    it("七対子テンパイ = 0", () => {
      const hand = [
        TT.Man1,
        TT.Man1,
        TT.Man2,
        TT.Man2,
        TT.Man3,
        TT.Man3,
        TT.Sou1,
        TT.Sou1,
        TT.Sou2,
        TT.Sou2,
        TT.Pin1,
        TT.Pin1,
        TT.Ton,
      ];
      expect(calculateShanten(hand, 0)).toBe(0);
    });

    it("七対子の和了形 = -1", () => {
      const hand = [
        TT.Man1,
        TT.Man1,
        TT.Man2,
        TT.Man2,
        TT.Man3,
        TT.Man3,
        TT.Sou1,
        TT.Sou1,
        TT.Sou2,
        TT.Sou2,
        TT.Pin1,
        TT.Pin1,
        TT.Ton,
        TT.Ton,
      ];
      expect(calculateShanten(hand, 0)).toBe(-1);
    });

    it("七対子の2向聴", () => {
      // 4対子 + 孤立5枚 = 七対子2向聴
      const hand = [
        TT.Man1,
        TT.Man1,
        TT.Man2,
        TT.Man2,
        TT.Sou1,
        TT.Sou1,
        TT.Sou2,
        TT.Sou2,
        TT.Pin1,
        TT.Pin3,
        TT.Ton,
        TT.Nan,
        TT.Haku,
      ];
      expect(calculateShanten(hand, 0)).toBe(2);
    });
  });

  describe("国士無双", () => {
    it("国士テンパイ = 0", () => {
      const hand = [
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
      ];
      expect(calculateShanten(hand, 0)).toBeLessThanOrEqual(0);
    });

    it("国士無双 13面待ちテンパイ = 0", () => {
      const hand = [
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
        TT.Man1, // ダブリ
      ];
      // 中がないので13面ではないが、テンパイ
      expect(calculateShanten(hand, 0)).toBe(0);
    });

    it("国士の和了形 = -1", () => {
      const hand = [
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
        TT.Man1, // ダブリ
      ];
      expect(calculateShanten(hand, 0)).toBe(-1);
    });
  });

  describe("特殊ケース", () => {
    it("14枚の和了形", () => {
      const hand = [
        TT.Man1,
        TT.Man2,
        TT.Man3,
        TT.Man4,
        TT.Man5,
        TT.Man6,
        TT.Man7,
        TT.Man8,
        TT.Man9,
        TT.Sou1,
        TT.Sou2,
        TT.Sou3,
        TT.Pin1,
        TT.Pin1,
      ];
      expect(calculateShanten(hand, 0)).toBe(-1);
    });
  });
});

// ===== calculateShantenForEachDiscard =====

describe("calculateShantenForEachDiscard", () => {
  it("14枚手牌で各打牌候補の向聴数を返す", () => {
    const hand = [
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou2,
      TT.Sou3,
      TT.Pin1,
      TT.Pin1,
    ];
    const map = calculateShantenForEachDiscard(hand, 0);

    // Pin1 を切ると和了形が崩れる → テンパイ(0) になるはず
    expect(map.get(TT.Pin1)).toBe(0);
    // 各エントリが存在する
    expect(map.size).toBeGreaterThan(0);
  });

  it("同じ TileType は重複しない", () => {
    const hand = [
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
      TT.Ton,
      TT.Haku,
    ];
    const map = calculateShantenForEachDiscard(hand, 0);
    // Man1 は1回だけ計算される
    const keys = [...map.keys()];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ===== calculateAcceptanceCount =====

describe("calculateAcceptanceCount", () => {
  it("テンパイの手牌は待ち牌分の受け入れがある", () => {
    const hand = [
      TT.Man1,
      TT.Man2,
      TT.Man3,
      TT.Man4,
      TT.Man5,
      TT.Man6,
      TT.Man7,
      TT.Man8,
      TT.Man9,
      TT.Sou1,
      TT.Sou2,
      TT.Sou3,
      TT.Pin1,
      TT.Pin1,
    ];
    // 14枚 → テンパイ前に1枚切る必要がある
    // Pin1を切ると3面子+1面子のテンパイで、Pin1待ち
    const acceptance = calculateAcceptanceCount(hand, []);
    expect(acceptance.size).toBeGreaterThan(0);
  });
});
