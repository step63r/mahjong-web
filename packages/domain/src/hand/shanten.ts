import { type TileType, ALL_TILE_TYPES } from "../tile/index.js";
import type { Meld } from "../meld/index.js";

// ===== 向聴数計算 =====

/**
 * TileType → 内部インデックス（0-33）の変換マップ
 */
const TYPE_TO_INDEX = new Map<TileType, number>(ALL_TILE_TYPES.map((t, i) => [t, i]));

/**
 * 数牌スートの範囲（開始インデックス, 長さ9）
 * 0-8: 萬子, 9-17: 索子, 18-26: 筒子
 */
const NUMBER_SUIT_RANGES: readonly [number, number][] = [
  [0, 9],
  [9, 9],
  [18, 9],
];

/** 字牌のインデックス: 27-33 */
const HONOR_START = 27;
const HONOR_END = 34;

/** 幺九牌のインデックス（国士無双判定用） */
const YAOCHUU_INDICES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

/**
 * 手牌の向聴数を計算する。
 *
 * 向聴数は和了に必要な最小の牌交換回数 - 1。
 * - テンパイ = 0
 * - 和了済み = -1
 *
 * @param closedTileTypes 門前手牌の TileType 配列（副露分を除く）
 * @param meldCount 副露の数（暗槓を含む）
 * @returns 向聴数（-1 = 和了形、0 = テンパイ、1以上 = 向聴数）
 */
export function calculateShanten(closedTileTypes: readonly TileType[], meldCount: number): number {
  const counts = buildCounts(closedTileTypes);

  let minShanten = shantenRegular(counts, meldCount);

  // 七対子・国士無双は門前のみ
  if (meldCount === 0) {
    minShanten = Math.min(minShanten, shantenChiitoitsu(counts));
    minShanten = Math.min(minShanten, shantenKokushi(counts));
  }

  return minShanten;
}

/**
 * 手牌から各打牌候補の向聴数を一括計算する。
 * 14枚の手牌を想定し、1枚除去した13枚での向聴数を返す。
 *
 * @returns Map<TileType, number> 各打牌候補 → 切った後の向聴数
 */
export function calculateShantenForEachDiscard(
  closedTileTypes: readonly TileType[],
  meldCount: number,
): Map<TileType, number> {
  const result = new Map<TileType, number>();
  const seen = new Set<TileType>();

  for (let i = 0; i < closedTileTypes.length; i++) {
    const t = closedTileTypes[i];
    if (seen.has(t)) continue;
    seen.add(t);

    // 1枚除去して向聴数を計算
    const remaining = [...closedTileTypes.slice(0, i), ...closedTileTypes.slice(i + 1)];
    result.set(t, calculateShanten(remaining, meldCount));
  }

  return result;
}

/**
 * 手牌から各打牌候補について、有効牌（受け入れ）の種類数を計算する。
 * 有効牌 = その牌を加えると向聴数が下がる牌。
 *
 * @param closedTileTypes 門前手牌（13枚）
 * @param melds 副露一覧
 * @returns Map<TileType, number> 各打牌候補 → 受け入れ種類数
 */
export function calculateAcceptanceCount(
  closedTileTypes: readonly TileType[],
  melds: readonly Meld[],
): Map<TileType, number> {
  const result = new Map<TileType, number>();
  const seen = new Set<TileType>();
  const meldCount = melds.length;
  const meldTileTypes = melds.flatMap((m) => m.tiles.map((t) => t.type));

  for (let i = 0; i < closedTileTypes.length; i++) {
    const t = closedTileTypes[i];
    if (seen.has(t)) continue;
    seen.add(t);

    // 1枚除去
    const remaining = [...closedTileTypes.slice(0, i), ...closedTileTypes.slice(i + 1)];
    const baseSh = calculateShanten(remaining, meldCount);

    let acceptCount = 0;
    for (const candidate of ALL_TILE_TYPES) {
      // 場に出ている枚数チェック（4枚使い切りならスキップ）
      const used =
        remaining.filter((tt) => tt === candidate).length +
        meldTileTypes.filter((tt) => tt === candidate).length;
      if (used >= 4) continue;

      const testHand = [...remaining, candidate];
      const newSh = calculateShanten(testHand, meldCount);
      if (newSh < baseSh) {
        acceptCount++;
      }
    }
    result.set(t, acceptCount);
  }

  return result;
}

// ===== 内部関数 =====

function buildCounts(tileTypes: readonly TileType[]): number[] {
  const counts = new Array(34).fill(0) as number[];
  for (const t of tileTypes) {
    const idx = TYPE_TO_INDEX.get(t);
    if (idx !== undefined) counts[idx]++;
  }
  return counts;
}

/**
 * 通常手（4面子1雀頭）の向聴数
 */
function shantenRegular(counts: number[], meldCount: number): number {
  let minShanten = 8 - 2 * meldCount;

  // 雀頭なしパターン
  {
    const { mentsu, taatsu } = scanAllSuits(counts);
    const maxBlocks = 4 - meldCount;
    const effectiveTaatsu = Math.min(taatsu, maxBlocks - mentsu);
    const s = 8 - 2 * meldCount - 2 * mentsu - effectiveTaatsu;
    minShanten = Math.min(minShanten, s);
  }

  // 雀頭ありパターン（各TileTypeでペアを試す）
  for (let i = 0; i < 34; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;

    const { mentsu, taatsu } = scanAllSuits(counts);
    const maxBlocks = 4 - meldCount;
    const effectiveTaatsu = Math.min(taatsu, maxBlocks - mentsu);
    const s = 8 - 2 * meldCount - 2 * mentsu - effectiveTaatsu - 1;
    minShanten = Math.min(minShanten, s);

    counts[i] += 2;
  }

  return minShanten;
}

/**
 * 全スートを走査して mentsu + taatsu の合計を返す
 */
function scanAllSuits(counts: number[]): { mentsu: number; taatsu: number } {
  let totalMentsu = 0;
  let totalTaatsu = 0;

  // 数牌スート
  for (const [start, len] of NUMBER_SUIT_RANGES) {
    const suitCounts = counts.slice(start, start + len);
    const best = { score: 0, mentsu: 0, taatsu: 0 };
    scanNumberSuit(suitCounts, 0, 0, 0, best);
    totalMentsu += best.mentsu;
    totalTaatsu += best.taatsu;

    // 元に戻す必要なし（sliceなのでコピー）
  }

  // 字牌（各タイル独立）
  for (let i = HONOR_START; i < HONOR_END; i++) {
    if (counts[i] >= 3) {
      totalMentsu++;
    } else if (counts[i] >= 2) {
      totalTaatsu++;
    }
  }

  return { mentsu: totalMentsu, taatsu: totalTaatsu };
}

/**
 * 数牌1スートの再帰走査。最適な mentsu/taatsu の組み合わせを探索する。
 */
function scanNumberSuit(
  counts: number[],
  pos: number,
  mentsu: number,
  taatsu: number,
  best: { score: number; mentsu: number; taatsu: number },
): void {
  // 次の非ゼロ位置へ
  while (pos < 9 && counts[pos] === 0) pos++;

  if (pos >= 9) {
    const score = mentsu * 2 + taatsu;
    if (score > best.score) {
      best.score = score;
      best.mentsu = mentsu;
      best.taatsu = taatsu;
    }
    return;
  }

  // 刻子（同種3枚）
  if (counts[pos] >= 3) {
    counts[pos] -= 3;
    scanNumberSuit(counts, pos, mentsu + 1, taatsu, best);
    counts[pos] += 3;
  }

  // 順子（連続3枚）
  if (pos + 2 < 9 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
    counts[pos]--;
    counts[pos + 1]--;
    counts[pos + 2]--;
    scanNumberSuit(counts, pos, mentsu + 1, taatsu, best);
    counts[pos]++;
    counts[pos + 1]++;
    counts[pos + 2]++;
  }

  // 対子（ターツ: 同種2枚）
  if (counts[pos] >= 2) {
    counts[pos] -= 2;
    scanNumberSuit(counts, pos, mentsu, taatsu + 1, best);
    counts[pos] += 2;
  }

  // 両面/辺張（連続2枚）
  if (pos + 1 < 9 && counts[pos + 1] > 0) {
    counts[pos]--;
    counts[pos + 1]--;
    scanNumberSuit(counts, pos, mentsu, taatsu + 1, best);
    counts[pos]++;
    counts[pos + 1]++;
  }

  // 嵌張（1つ飛ばし2枚）
  if (pos + 2 < 9 && counts[pos + 2] > 0) {
    counts[pos]--;
    counts[pos + 2]--;
    scanNumberSuit(counts, pos + 1, mentsu, taatsu + 1, best);
    counts[pos]++;
    counts[pos + 2]++;
  }

  // この牌を使わない（スキップ）
  counts[pos]--;
  scanNumberSuit(counts, pos, mentsu, taatsu, best);
  counts[pos]++;
}

/**
 * 七対子の向聴数
 */
function shantenChiitoitsu(counts: number[]): number {
  let pairs = 0;
  let uniqueTypes = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 2) pairs++;
    if (counts[i] >= 1) uniqueTypes++;
  }
  // 七対子は7種のペアが必要。種類数が足りない場合は補正
  const needed = 7 - pairs;
  const available = uniqueTypes - pairs;
  if (available < needed) {
    // 手牌の種類が足りないので余分に交換が要る
    return 6 - pairs + (needed - available);
  }
  return 6 - pairs;
}

/**
 * 国士無双の向聴数
 */
function shantenKokushi(counts: number[]): number {
  let yaochuuKinds = 0;
  let hasDouble = false;
  for (const idx of YAOCHUU_INDICES) {
    if (counts[idx] >= 1) {
      yaochuuKinds++;
      if (counts[idx] >= 2) hasDouble = true;
    }
  }
  return 13 - yaochuuKinds - (hasDouble ? 1 : 0);
}
