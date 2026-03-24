import { describe, it, expect } from "vitest";
import { TileType } from "../tile/index.js";
import { Discard } from "./discard.js";

// ヘルパー
function tile(type: TileType, id: number = 0) {
  return { type, id, isRedDora: false };
}

describe("Discard", () => {
  // ===== addDiscard =====

  it("捨て牌を追加できる", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    expect(discard.count).toBe(1);
  });

  it("ツモ切りフラグが正しく設定される", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), true);
    const entry = discard.getLastDiscard();
    expect(entry?.isTsumogiri).toBe(true);
  });

  it("リーチ宣言牌フラグが正しく設定される", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false, true);
    const entry = discard.getLastDiscard();
    expect(entry?.isRiichiDeclare).toBe(true);
  });

  // ===== markLastAsCalled =====

  it("直前の捨て牌を鳴かれた状態にできる", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    discard.markLastAsCalled(2);
    const entry = discard.getLastDiscard();
    expect(entry?.calledBy).toBe(2);
  });

  it("捨て牌がない状態で markLastAsCalled するとエラー", () => {
    const discard = new Discard();
    expect(() => discard.markLastAsCalled(0)).toThrow("捨て牌がありません");
  });

  // ===== getVisibleDiscards =====

  it("鳴かれた牌は河に表示されない", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    discard.addDiscard(tile(TileType.Man2), false);
    discard.markLastAsCalled(1);
    discard.addDiscard(tile(TileType.Man3), false);

    const visible = discard.getVisibleDiscards();
    expect(visible).toHaveLength(2);
    expect(visible[0].tile.type).toBe(TileType.Man1);
    expect(visible[1].tile.type).toBe(TileType.Man3);
  });

  // ===== getAllDiscards =====

  it("全捨て牌（鳴かれた牌含む）が取得できる", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    discard.addDiscard(tile(TileType.Man2), false);
    discard.markLastAsCalled(1);

    const all = discard.getAllDiscards();
    expect(all).toHaveLength(2);
  });

  // ===== hasDiscardedType =====

  it("捨てた牌の TileType を検索できる（フリテン判定用）", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    discard.addDiscard(tile(TileType.Sou5), false);
    discard.markLastAsCalled(0); // 鳴かれても判定対象

    expect(discard.hasDiscardedType(TileType.Man1)).toBe(true);
    expect(discard.hasDiscardedType(TileType.Sou5)).toBe(true);
    expect(discard.hasDiscardedType(TileType.Pin1)).toBe(false);
  });

  // ===== visibleCount =====

  it("visibleCount は鳴かれていない牌の数を返す", () => {
    const discard = new Discard();
    discard.addDiscard(tile(TileType.Man1), false);
    discard.addDiscard(tile(TileType.Man2), false);
    discard.markLastAsCalled(1);

    expect(discard.count).toBe(2);
    expect(discard.visibleCount).toBe(1);
  });

  // ===== getLastDiscard =====

  it("捨て牌がない場合 getLastDiscard は undefined", () => {
    const discard = new Discard();
    expect(discard.getLastDiscard()).toBeUndefined();
  });
});
