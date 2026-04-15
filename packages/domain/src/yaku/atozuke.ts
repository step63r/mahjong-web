/**
 * 後付けナシ判定
 *
 * 「後付けナシ」ルールでは、以下のいずれかに該当する場合アガれない:
 *
 * ① 鳴いている場合、第一副露が役に絡んでいるか、
 *    副露していない面子のみで役が確定していなければアガれない
 * ② 片和了り（テンパイの待ち牌が複数ある場合、
 *    すべての待ち牌で共通の役が成立しなければアガれない）
 */

import type { TileType, Tile } from "../tile/index.js";
import { getNumberTileInfo } from "../tile/index.js";
import { MeldType, type Meld } from "../meld/index.js";
import { getTenpaiTiles } from "../hand/index.js";
import type { WinContext, JudgeResult, Yaku, ParsedHand } from "./types.js";
import { GroupType, isMenzen } from "./types.js";
import { judgeWin } from "./judge.js";

/** ダミー Tile オブジェクト（TileType のみ使用） */
function dummyTile(type: TileType): Tile {
  return { type, id: 0, isRedDora: false };
}

// ===== 上位役テーブル =====

/**
 * 上位役 → 下位役のマッピング
 * 上位役が成立しているとき、下位役も「包含されている」とみなす。
 */
const UPPER_YAKU_MAP: ReadonlyMap<Yaku, Yaku> = new Map([
  ["suuankou", "sanankou"],
  ["suuankou-tanki", "sanankou"],
  ["ryanpeiko", "iipeiko"],
  ["junchan", "chanta"],
  ["chinitsu", "honitsu"],
  ["daisangen", "shousangen"],
  ["daisuushii", "shousuushii"],
]);

// ===== メイン関数 =====

/**
 * 後付けナシルールで和了が許可されるかどうかを判定する。
 *
 * @param winCtx 和了コンテキスト（和了牌を含む手牌14枚）
 * @param judgeResult 和了時の判定結果（すでにjudgeWinで取得済み）
 * @returns 和了が許可される場合 true
 */
export function checkAtozukeAllowed(
  winCtx: WinContext,
  judgeResult: JudgeResult,
): boolean {
  // 後付けアリなら常にOK
  if (winCtx.ruleConfig.atozuke) return true;

  const { melds } = winCtx;

  // 門前なら①はスキップ、②のみチェック
  if (!isMenzen(melds)) {
    // ① 第一副露チェック
    if (!checkFirstMeldRule(winCtx, judgeResult)) return false;
  }

  // ② 片和了りチェック
  if (!checkKataagariRule(winCtx, judgeResult)) return false;

  return true;
}

// ===== ① 第一副露チェック =====

/**
 * 第一副露が役に絡んでいるか、または副露していない面子で役が確定しているか。
 *
 * 以下のいずれかを満たせば OK:
 * - 全面子型の役（タンヤオ、混一色等）があれば第一副露も自動的に絡む
 * - 副露していない閉じた面子のみで確定する役がある
 * - 第一副露が直接特定の役に参加している
 */
function checkFirstMeldRule(
  winCtx: WinContext,
  judgeResult: JudgeResult,
): boolean {
  const yakuSet = extractYakuNames(judgeResult);

  // 役満の場合は常に許可
  if (judgeResult.totalYakumanTimes > 0) return true;

  // --- 全面子型の役（タンヤオ、チャンタ等）があれば第一副露も自動的に絡む ---
  if (hasWholeHandYaku(yakuSet)) return true;

  // --- 副露していない面子（閉じたグループ）で役が確定しているか ---
  if (hasClosedGroupYaku(yakuSet, judgeResult.parsedHand, winCtx)) return true;

  // --- 第一副露が特定の役に参加しているか ---
  if (firstMeldParticipatesInYaku(winCtx, judgeResult)) return true;

  return false;
}

/** 全面子が自動的に関与する手牌全体型の役 */
const WHOLE_HAND_YAKU: ReadonlySet<Yaku> = new Set([
  "tanyao",      // 断么九
  "chanta",      // 混全帯么九
  "junchan",     // 純全帯么九
  "honitsu",     // 混一色
  "chinitsu",    // 清一色
  "honroutou",   // 混老頭
  "toitoi",      // 対々和
  "chinroutou",  // 清老頭
  "tsuuiisou",   // 字一色
]);

function hasWholeHandYaku(yakuSet: Set<Yaku>): boolean {
  for (const y of WHOLE_HAND_YAKU) {
    if (yakuSet.has(y)) return true;
  }
  return false;
}

/**
 * 副露していない面子（parsedHand の isOpen=false グループ）で役が確定しているか。
 *
 * parsedHand のグループ情報を使い、閉じたグループだけで成立する役を検出する。
 * 例: 手牌内に白の暗刻がある、閉じた順子で一気通貫が成立する等。
 */
function hasClosedGroupYaku(
  yakuSet: Set<Yaku>,
  parsedHand: ParsedHand | undefined,
  winCtx: WinContext,
): boolean {
  if (!parsedHand) return false;

  const closedGroups = parsedHand.groups.filter((g) => !g.isOpen);

  // 1. 役牌の暗刻が閉じたグループにあるか
  const yakuhaiChecks: [Yaku, TileType][] = [
    ["yakuhai-haku", "haku"],
    ["yakuhai-hatsu", "hatsu"],
    ["yakuhai-chun", "chun"],
    ["yakuhai-round-wind", winCtx.roundWind],
    ["yakuhai-seat-wind", winCtx.seatWind],
  ];
  for (const [yaku, tileType] of yakuhaiChecks) {
    if (yakuSet.has(yaku)) {
      const hasClosedKoutsu = closedGroups.some(
        (g) =>
          (g.type === GroupType.Koutsu || g.type === GroupType.Kantsu) &&
          g.tileType === tileType,
      );
      if (hasClosedKoutsu) return true;
    }
  }

  // 2. 一気通貫が閉じたグループのみで成立するか
  if (yakuSet.has("ikkitsuukan")) {
    const closedShuntsu = closedGroups.filter(
      (g) => g.type === GroupType.Shuntsu,
    );
    const suitNums = new Map<string, Set<number>>();
    for (const g of closedShuntsu) {
      const info = getNumberTileInfo(dummyTile(g.tileType));
      if (!info) continue;
      let nums = suitNums.get(info.suit);
      if (!nums) {
        nums = new Set();
        suitNums.set(info.suit, nums);
      }
      nums.add(info.number);
    }
    for (const nums of suitNums.values()) {
      if (nums.has(1) && nums.has(4) && nums.has(7)) return true;
    }
  }

  // 3. 三色同順が閉じたグループのみで成立するか
  if (yakuSet.has("sanshoku-doujun")) {
    const closedShuntsu = closedGroups.filter(
      (g) => g.type === GroupType.Shuntsu,
    );
    const numSuits = new Map<number, Set<string>>();
    for (const g of closedShuntsu) {
      const info = getNumberTileInfo(dummyTile(g.tileType));
      if (!info) continue;
      let suits = numSuits.get(info.number);
      if (!suits) {
        suits = new Set();
        numSuits.set(info.number, suits);
      }
      suits.add(info.suit);
    }
    for (const suits of numSuits.values()) {
      if (suits.size >= 3) return true;
    }
  }

  // 4. 三色同刻が閉じたグループのみで成立するか
  if (yakuSet.has("sanshoku-doukou")) {
    const closedKoutsu = closedGroups.filter(
      (g) => g.type === GroupType.Koutsu || g.type === GroupType.Kantsu,
    );
    const numSuits = new Map<number, Set<string>>();
    for (const g of closedKoutsu) {
      const info = getNumberTileInfo(dummyTile(g.tileType));
      if (!info) continue;
      let suits = numSuits.get(info.number);
      if (!suits) {
        suits = new Set();
        numSuits.set(info.number, suits);
      }
      suits.add(info.suit);
    }
    for (const suits of numSuits.values()) {
      if (suits.size >= 3) return true;
    }
  }

  return false;
}

/**
 * 第一副露が特定の役に直接参加しているか。
 *
 * parsedHand のグループ情報と第一副露の牌構成を比較して、
 * 第一副露がどの役に貢献しているかを判定する。
 */
function firstMeldParticipatesInYaku(
  winCtx: WinContext,
  judgeResult: JudgeResult,
): boolean {
  // 第一副露（暗槓以外の最初の副露）を取得
  const firstOpenMeld = winCtx.melds.find((m) => m.type !== MeldType.Ankan);
  if (!firstOpenMeld) return true; // 暗槓のみ → 門前扱い

  const yakuSet = extractYakuNames(judgeResult);
  const parsedHand = judgeResult.parsedHand;
  if (!parsedHand) return false;

  // --- 役牌の副露が第一副露の場合 ---
  if (
    firstOpenMeld.type === MeldType.Pon ||
    firstOpenMeld.type === MeldType.Minkan ||
    firstOpenMeld.type === MeldType.Kakan
  ) {
    const firstMeldTileType = firstOpenMeld.tiles[0].type;
    const yakuhaiMap: [Yaku, TileType][] = [
      ["yakuhai-haku", "haku"],
      ["yakuhai-hatsu", "hatsu"],
      ["yakuhai-chun", "chun"],
      ["yakuhai-round-wind", winCtx.roundWind],
      ["yakuhai-seat-wind", winCtx.seatWind],
    ];
    for (const [yaku, tileType] of yakuhaiMap) {
      if (yakuSet.has(yaku) && firstMeldTileType === tileType) {
        return true;
      }
    }
  }

  // --- チー副露の場合: 順子系の役に参加しているかチェック ---
  if (firstOpenMeld.type === MeldType.Chi) {
    const startType = getChiStartTileType(firstOpenMeld);
    if (!startType) return false;
    const startInfo = getNumberTileInfo(dummyTile(startType));
    if (!startInfo) return false;

    // 一気通貫: 第一副露が同スートの1/4/7から始まる順子か
    if (yakuSet.has("ikkitsuukan")) {
      const allShuntsu = parsedHand.groups.filter(
        (g) => g.type === GroupType.Shuntsu,
      );
      const suitNums = new Map<string, Set<number>>();
      for (const g of allShuntsu) {
        const info = getNumberTileInfo(dummyTile(g.tileType));
        if (!info) continue;
        let nums = suitNums.get(info.suit);
        if (!nums) {
          nums = new Set();
          suitNums.set(info.suit, nums);
        }
        nums.add(info.number);
      }
      for (const [suit, nums] of suitNums) {
        if (
          nums.has(1) &&
          nums.has(4) &&
          nums.has(7) &&
          suit === startInfo.suit &&
          (startInfo.number === 1 ||
            startInfo.number === 4 ||
            startInfo.number === 7)
        ) {
          return true;
        }
      }
    }

    // 三色同順: 第一副露の数字が三色の数字と一致するか
    if (yakuSet.has("sanshoku-doujun")) {
      const allShuntsu = parsedHand.groups.filter(
        (g) => g.type === GroupType.Shuntsu,
      );
      const numSuits = new Map<number, Set<string>>();
      for (const g of allShuntsu) {
        const info = getNumberTileInfo(dummyTile(g.tileType));
        if (!info) continue;
        let suits = numSuits.get(info.number);
        if (!suits) {
          suits = new Set();
          numSuits.set(info.number, suits);
        }
        suits.add(info.suit);
      }
      for (const [num, suits] of numSuits) {
        if (suits.size >= 3 && num === startInfo.number) {
          return true;
        }
      }
    }
  }

  // --- ポン/明槓の場合: 刻子系の役に参加しているかチェック ---
  if (
    firstOpenMeld.type === MeldType.Pon ||
    firstOpenMeld.type === MeldType.Minkan ||
    firstOpenMeld.type === MeldType.Kakan
  ) {
    const meldTileType = firstOpenMeld.tiles[0].type;
    const meldInfo = getNumberTileInfo(dummyTile(meldTileType));

    // 三色同刻
    if (yakuSet.has("sanshoku-doukou") && meldInfo) {
      const allKoutsu = parsedHand.groups.filter(
        (g) => g.type === GroupType.Koutsu || g.type === GroupType.Kantsu,
      );
      const numSuits = new Map<number, Set<string>>();
      for (const g of allKoutsu) {
        const info = getNumberTileInfo(dummyTile(g.tileType));
        if (!info) continue;
        let suits = numSuits.get(info.number);
        if (!suits) {
          suits = new Set();
          numSuits.set(info.number, suits);
        }
        suits.add(info.suit);
      }
      for (const [num, suits] of numSuits) {
        if (suits.size >= 3 && num === meldInfo.number) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * チー副露の最小番号の牌タイプを取得する（順子の先頭）
 */
function getChiStartTileType(meld: Meld): TileType | undefined {
  let lowestNum = Infinity;
  let lowestType: TileType | undefined;
  for (const t of meld.tiles) {
    const info = getNumberTileInfo(dummyTile(t.type));
    if (info && info.number < lowestNum) {
      lowestNum = info.number;
      lowestType = t.type;
    }
  }
  return lowestType;
}

// ===== ② 片和了りチェック =====

/**
 * 全ての待ち牌で共通する役が存在するかを判定する。
 * 待ち牌が1種類のみの場合は常に OK。
 */
function checkKataagariRule(
  winCtx: WinContext,
  _judgeResult: JudgeResult,
): boolean {
  // 和了牌を除いた手牌（13枚）
  const closedTilesWithoutWin = removeOneTile(winCtx.handTiles, winCtx.winTile);
  const closedTypes = closedTilesWithoutWin.map((t) => t.type);

  // 全待ち牌を取得
  const allWaits = getTenpaiTiles(closedTypes, winCtx.melds);
  if (allWaits.length <= 1) return true;

  // 各待ち牌で judgeWin を呼び、役セットを取得
  const yakuSetsPerWait: Set<Yaku>[] = [];
  for (const waitType of allWaits) {
    const testCtx: WinContext = {
      ...winCtx,
      handTiles: [...closedTilesWithoutWin, dummyTile(waitType)],
      winTile: dummyTile(waitType),
      // 状況役を除外（ドラ等は片和了り判定に関係しない）
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    };
    const result = judgeWin(testCtx);
    if (!result || result.yakuList.length === 0) {
      // この待ち牌では役なし → 片和了り
      return false;
    }
    yakuSetsPerWait.push(expandYakuSet(extractYakuNames(result)));
  }

  // 全待ち牌の役セットの交差集合を求める
  const intersection = intersectYakuSets(yakuSetsPerWait);

  // 共通役が1つ以上あれば OK
  return intersection.size > 0;
}

// ===== ユーティリティ =====

/** JudgeResult から役名のセットを抽出（状況役は除外） */
function extractYakuNames(result: JudgeResult): Set<Yaku> {
  const set = new Set<Yaku>();
  for (const yr of result.yakuList) {
    if (!SITUATIONAL_YAKU.has(yr.yaku)) {
      set.add(yr.yaku);
    }
  }
  return set;
}

/** 状況役（手牌の形に依存しない役） */
const SITUATIONAL_YAKU: ReadonlySet<Yaku> = new Set([
  "riichi",
  "double-riichi",
  "ippatsu",
  "menzen-tsumo",
  "haitei",
  "houtei",
  "rinshan",
  "chankan",
  "tenhou",
  "chiihou",
  "renhou",
]);

/**
 * 上位役を展開して下位役も含むセットにする。
 * 例: { "suuankou" } → { "suuankou", "sanankou" }
 */
function expandYakuSet(yakuSet: Set<Yaku>): Set<Yaku> {
  const expanded = new Set(yakuSet);
  for (const [upper, lower] of UPPER_YAKU_MAP) {
    if (expanded.has(upper)) {
      expanded.add(lower);
    }
  }
  return expanded;
}

/** 複数の役セットの交差集合 */
function intersectYakuSets(sets: Set<Yaku>[]): Set<Yaku> {
  if (sets.length === 0) return new Set();
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    const next = new Set<Yaku>();
    for (const y of result) {
      if (sets[i].has(y)) {
        next.add(y);
      }
    }
    result = next;
  }
  return result;
}

/** 手牌から指定の牌を1枚除外する */
function removeOneTile(tiles: readonly Tile[], target: Tile): Tile[] {
  const result = [...tiles];
  const idx = result.findIndex(
    (t) => t.type === target.type && t.id === target.id,
  );
  if (idx >= 0) {
    result.splice(idx, 1);
  } else {
    // id が一致しない場合は type で除外
    const typeIdx = result.findIndex((t) => t.type === target.type);
    if (typeIdx >= 0) result.splice(typeIdx, 1);
  }
  return result;
}
