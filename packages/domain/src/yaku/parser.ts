import { type TileType, getNumberTileInfo } from "../tile/index.js";
import { type Meld, MeldType } from "../meld/index.js";
import { type ParsedGroup, type ParsedHand, GroupType } from "./types.js";

// ===== 手牌の面子分解パーサー =====

/**
 * TileType ごとの枚数カウンタ
 * キー: TileType の文字列、値: 残り枚数
 */
type TileCounts = Map<TileType, number>;

/**
 * 手牌（TileType配列）から枚数カウンタを構築する
 */
function buildCounts(tileTypes: readonly TileType[]): TileCounts {
  const counts: TileCounts = new Map();
  for (const t of tileTypes) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * カウンタから指定数を引く。0 になったらキーを削除
 */
function decrement(counts: TileCounts, type: TileType, amount: number): boolean {
  const current = counts.get(type) ?? 0;
  if (current < amount) return false;
  const next = current - amount;
  if (next === 0) {
    counts.delete(type);
  } else {
    counts.set(type, next);
  }
  return true;
}

/**
 * カウンタに指定数を足す
 */
function increment(counts: TileCounts, type: TileType, amount: number): void {
  counts.set(type, (counts.get(type) ?? 0) + amount);
}

// --- 数牌の順序テーブル ---

const SUIT_NUMBER_TILES: ReadonlyMap<string, readonly TileType[]> = (() => {
  const map = new Map<string, TileType[]>();
  const allTypes: TileType[] = [
    "man1",
    "man2",
    "man3",
    "man4",
    "man5",
    "man6",
    "man7",
    "man8",
    "man9",
    "sou1",
    "sou2",
    "sou3",
    "sou4",
    "sou5",
    "sou6",
    "sou7",
    "sou8",
    "sou9",
    "pin1",
    "pin2",
    "pin3",
    "pin4",
    "pin5",
    "pin6",
    "pin7",
    "pin8",
    "pin9",
  ] as TileType[];
  for (const t of allTypes) {
    const info = getNumberTileInfo({ type: t, id: 0, isRedDora: false });
    if (info) {
      let arr = map.get(info.suit);
      if (!arr) {
        arr = [];
        map.set(info.suit, arr);
      }
      arr.push(t);
    }
  }
  return map;
})();

/**
 * TileType の次の数牌を返す (e.g. man1 → man2, man9 → undefined)
 */
function nextNumberType(tileType: TileType): TileType | undefined {
  const info = getNumberTileInfo({ type: tileType, id: 0, isRedDora: false });
  if (!info || info.number >= 9) return undefined;
  const suitTiles = SUIT_NUMBER_TILES.get(info.suit);
  if (!suitTiles) return undefined;
  return suitTiles[info.number]; // 0-indexed: number=1 → index 0, next is index 1 = number 2
}

// ===== 4面子1雀頭の分解 =====

/**
 * 閉じた手牌 + 副露を、4面子1雀頭のすべてのパターンに分解する
 *
 * @param closedTileTypes 閉じた手牌の TileType 配列
 * @param melds 副露一覧
 * @returns 分解結果の配列（該当なしなら空配列）
 */
export function parseMentsu(
  closedTileTypes: readonly TileType[],
  melds: readonly Meld[],
): ParsedHand[] {
  // 副露由来のグループ
  const meldGroups: ParsedGroup[] = melds.map((m) => {
    if (m.type === MeldType.Chi) {
      // 順子: 最小の TileType を代表とする
      const sorted = [...m.tiles].sort((a, b) => a.type.localeCompare(b.type));
      return { type: GroupType.Shuntsu, tileType: sorted[0].type, isOpen: true };
    }
    if (m.type === MeldType.Ankan) {
      return { type: GroupType.Kantsu, tileType: m.tiles[0].type, isOpen: false };
    }
    // Pon, Minkan, Kakan → 刻子/槓子（open）
    const gType = m.type === MeldType.Pon ? GroupType.Koutsu : GroupType.Kantsu;
    return { type: gType, tileType: m.tiles[0].type, isOpen: true };
  });

  const closedGroupsNeeded = 4 - melds.length;
  const counts = buildCounts(closedTileTypes);
  const results: ParsedHand[] = [];

  // 雀頭を決めて残りを面子に分解
  const pairCandidates = [...counts.entries()].filter(([_, c]) => c >= 2);

  for (const [pairType] of pairCandidates) {
    decrement(counts, pairType, 2);
    const closedGroups: ParsedGroup[] = [];
    extractMentsu(counts, closedGroupsNeeded, closedGroups, meldGroups, pairType, results);
    increment(counts, pairType, 2);
  }

  return results;
}

/**
 * 再帰的に面子を抽出する
 */
function extractMentsu(
  counts: TileCounts,
  remaining: number,
  currentGroups: ParsedGroup[],
  meldGroups: ParsedGroup[],
  pair: TileType,
  results: ParsedHand[],
): void {
  if (remaining === 0) {
    // カウンタが空なら成功
    if (counts.size === 0) {
      results.push({
        groups: [...meldGroups, ...currentGroups],
        pair,
      });
    }
    return;
  }

  // 最小の TileType から順にグリーディに抽出（重複排除のため）
  const firstType = getSmallestType(counts);
  if (firstType === undefined) return;

  const count = counts.get(firstType) ?? 0;

  // 刻子を試す (3枚以上あるとき)
  if (count >= 3) {
    decrement(counts, firstType, 3);
    currentGroups.push({ type: GroupType.Koutsu, tileType: firstType, isOpen: false });
    extractMentsu(counts, remaining - 1, currentGroups, meldGroups, pair, results);
    currentGroups.pop();
    increment(counts, firstType, 3);
  }

  // 順子を試す (数牌のみ)
  const next1 = nextNumberType(firstType);
  const next2 = next1 ? nextNumberType(next1) : undefined;
  if (next1 && next2) {
    const hasAll = count >= 1 && (counts.get(next1) ?? 0) >= 1 && (counts.get(next2) ?? 0) >= 1;
    if (hasAll) {
      decrement(counts, firstType, 1);
      decrement(counts, next1, 1);
      decrement(counts, next2, 1);
      currentGroups.push({ type: GroupType.Shuntsu, tileType: firstType, isOpen: false });
      extractMentsu(counts, remaining - 1, currentGroups, meldGroups, pair, results);
      currentGroups.pop();
      increment(counts, next2, 1);
      increment(counts, next1, 1);
      increment(counts, firstType, 1);
    }
  }
}

/**
 * カウンタ内の最小 TileType を取得
 */
function getSmallestType(counts: TileCounts): TileType | undefined {
  let smallest: TileType | undefined;
  for (const key of counts.keys()) {
    if (smallest === undefined || key < smallest) {
      smallest = key;
    }
  }
  return smallest;
}

// ===== 七対子の判定 =====

/**
 * 七対子として有効かチェックし、ParsedHand (特殊) を返す
 * 七対子は 7組の対子で構成される
 */
export function parseChiitoitsu(closedTileTypes: readonly TileType[]): boolean {
  if (closedTileTypes.length !== 14) return false;
  const counts = buildCounts(closedTileTypes);
  if (counts.size !== 7) return false;
  for (const c of counts.values()) {
    if (c !== 2) return false;
  }
  return true;
}

// ===== 国士無双の判定 =====

/** 国士無双に必要な13種の幺九牌 */
const KOKUSHI_TYPES: readonly TileType[] = [
  "man1" as TileType,
  "man9" as TileType,
  "sou1" as TileType,
  "sou9" as TileType,
  "pin1" as TileType,
  "pin9" as TileType,
  "ton" as TileType,
  "nan" as TileType,
  "sha" as TileType,
  "pei" as TileType,
  "haku" as TileType,
  "hatsu" as TileType,
  "chun" as TileType,
];

/**
 * 国士無双の判定
 * @returns "kokushi" | "kokushi-13" | null
 *   - "kokushi": 通常の国士無双（雀頭が特定の1種）
 *   - "kokushi-13": 十三面待ち（和了牌が13種すべてに該当）
 */
export function parseKokushi(
  closedTileTypes: readonly TileType[],
  winTileType: TileType,
): "kokushi" | "kokushi-13" | null {
  if (closedTileTypes.length !== 14) return null;
  const counts = buildCounts(closedTileTypes);

  // 13種すべてが少なくとも1枚あるか
  for (const t of KOKUSHI_TYPES) {
    if ((counts.get(t) ?? 0) < 1) return null;
  }

  // 合計14枚であることを確認（13種 + 雀頭の1枚＝14枚）
  // → 1枚だけ2枚ある種類がある
  let pairType: TileType | undefined;
  for (const t of KOKUSHI_TYPES) {
    if ((counts.get(t) ?? 0) === 2) {
      pairType = t;
    }
  }
  if (pairType === undefined) return null;

  // 幺九牌以外が含まれていないか
  for (const [t] of counts) {
    if (!KOKUSHI_TYPES.includes(t)) return null;
  }

  // 十三面待ち: 和了牌で待っている=雀頭がまだ確定していない状態
  // → 和了牌を除いた13枚が13種すべて1枚ずつ ⟹ 十三面
  const countsWithout = buildCounts(closedTileTypes);
  decrement(countsWithout, winTileType, 1);
  let isThirteenWait = true;
  for (const t of KOKUSHI_TYPES) {
    if ((countsWithout.get(t) ?? 0) !== 1) {
      isThirteenWait = false;
      break;
    }
  }

  return isThirteenWait ? "kokushi-13" : "kokushi";
}
