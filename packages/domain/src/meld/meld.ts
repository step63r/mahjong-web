import {
  type Tile,
  type TileType,
  TileSuit,
  getNumberTileInfo,
  getTileSuit,
  isNumberTile,
  isSameTile,
} from "../tile/index.js";
import { type ChiCandidate, type KuikaeConstraint, type Meld, MeldType } from "./types.js";

// ===== チー判定 =====

/**
 * チー可能な候補を列挙する
 *
 * チーは上家の捨て牌に対して、手牌から2枚を出して順子を構成する。
 * 数牌のみ可能。
 *
 * @param handTiles 手牌の配列
 * @param calledTile 上家の捨て牌
 * @returns チーの候補リスト
 */
export function findChiCandidates(handTiles: readonly Tile[], calledTile: Tile): ChiCandidate[] {
  if (!isNumberTile(calledTile)) return [];

  const info = getNumberTileInfo(calledTile);
  if (!info) return [];

  const suit = getTileSuit(calledTile);
  const num = info.number;

  // 同じスートの手牌を集める（calledTile と同一牌は除く）
  const sameSuitTiles = handTiles.filter(
    (t) => getTileSuit(t) === suit && !isSameTile(t, calledTile),
  );

  // 手牌内で指定スート・数字の牌を取得するヘルパー
  const findByNumber = (n: number): Tile[] =>
    sameSuitTiles.filter((t) => {
      const tInfo = getNumberTileInfo(t);
      return tInfo !== undefined && tInfo.number === n;
    });

  const candidates: ChiCandidate[] = [];

  // パターン1: [num-2, num-1, num] (例: 捨て牌が5なら 3,4,5)
  if (num >= 3) {
    for (const t1 of findByNumber(num - 2)) {
      for (const t2 of findByNumber(num - 1)) {
        if (isSameTile(t1, t2)) continue;
        candidates.push(buildChiCandidate(t1, t2, calledTile));
      }
    }
  }

  // パターン2: [num-1, num, num+1] (例: 捨て牌が5なら 4,5,6)
  if (num >= 2 && num <= 8) {
    for (const t1 of findByNumber(num - 1)) {
      for (const t2 of findByNumber(num + 1)) {
        if (isSameTile(t1, t2)) continue;
        candidates.push(buildChiCandidate(t1, t2, calledTile));
      }
    }
  }

  // パターン3: [num, num+1, num+2] (例: 捨て牌が5なら 5,6,7)
  if (num <= 7) {
    for (const t1 of findByNumber(num + 1)) {
      for (const t2 of findByNumber(num + 2)) {
        if (isSameTile(t1, t2)) continue;
        candidates.push(buildChiCandidate(t1, t2, calledTile));
      }
    }
  }

  return candidates;
}

function buildChiCandidate(t1: Tile, t2: Tile, calledTile: Tile): ChiCandidate {
  const allThree = [t1, t2, calledTile];
  allThree.sort((a, b) => {
    const aInfo = getNumberTileInfo(a)!;
    const bInfo = getNumberTileInfo(b)!;
    return aInfo.number - bInfo.number;
  });
  return {
    tiles: [t1, t2],
    calledTile,
    resultTiles: allThree as [Tile, Tile, Tile],
  };
}

// ===== ポン判定 =====

/**
 * ポン可能かどうかを判定する
 *
 * 手牌に捨て牌と同じ type の牌が2枚以上あればポン可能
 *
 * @param handTiles 手牌の配列
 * @param calledTile 捨て牌
 * @returns ポンに使用可能な手牌の組み合わせ（2枚ずつの配列）
 */
export function findPonCandidates(handTiles: readonly Tile[], calledTile: Tile): [Tile, Tile][] {
  const matching = handTiles.filter(
    (t) => t.type === calledTile.type && !isSameTile(t, calledTile),
  );

  if (matching.length < 2) return [];

  // 2枚の組み合わせを列挙
  const candidates: [Tile, Tile][] = [];
  for (let i = 0; i < matching.length; i++) {
    for (let j = i + 1; j < matching.length; j++) {
      candidates.push([matching[i], matching[j]]);
    }
  }
  return candidates;
}

// ===== 明槓判定 =====

/**
 * 明槓（大明槓）可能かどうかを判定する
 *
 * 手牌に捨て牌と同じ type の牌が3枚あれば明槓可能
 *
 * @param handTiles 手牌の配列
 * @param calledTile 捨て牌
 * @returns 明槓に使用可能な手牌の3枚。不可能な場合は undefined
 */
export function findMinkanCandidate(
  handTiles: readonly Tile[],
  calledTile: Tile,
): [Tile, Tile, Tile] | undefined {
  const matching = handTiles.filter(
    (t) => t.type === calledTile.type && !isSameTile(t, calledTile),
  );

  if (matching.length < 3) return undefined;
  return [matching[0], matching[1], matching[2]];
}

// ===== 暗槓判定 =====

/**
 * 暗槓可能な TileType を列挙する
 *
 * 手牌に同種牌が4枚ある場合に暗槓可能
 *
 * @param handTiles 手牌の配列
 * @returns 暗槓可能な TileType とそれに使用する4枚の牌
 */
export function findAnkanCandidates(
  handTiles: readonly Tile[],
): { tileType: TileType; tiles: [Tile, Tile, Tile, Tile] }[] {
  const countMap = new Map<TileType, Tile[]>();
  for (const tile of handTiles) {
    const arr = countMap.get(tile.type) ?? [];
    arr.push(tile);
    countMap.set(tile.type, arr);
  }

  const candidates: { tileType: TileType; tiles: [Tile, Tile, Tile, Tile] }[] = [];
  for (const [tileType, tiles] of countMap) {
    if (tiles.length === 4) {
      candidates.push({ tileType, tiles: tiles as [Tile, Tile, Tile, Tile] });
    }
  }
  return candidates;
}

// ===== 加槓判定 =====

/**
 * 加槓可能なポンを列挙する
 *
 * 既にポンしている副露に対して、手牌に同じ type の牌があれば加槓可能
 *
 * @param handTiles 手牌の配列
 * @param melds 既存の副露リスト
 * @returns 加槓可能な候補（元のポン副露と追加する牌）
 */
export function findKakanCandidates(
  handTiles: readonly Tile[],
  melds: readonly Meld[],
): { meld: Meld; addTile: Tile }[] {
  const candidates: { meld: Meld; addTile: Tile }[] = [];

  for (const meld of melds) {
    if (meld.type !== MeldType.Pon) continue;

    const ponType = meld.tiles[0].type;
    const addTile = handTiles.find((t) => t.type === ponType);
    if (addTile) {
      candidates.push({ meld, addTile });
    }
  }

  return candidates;
}

// ===== 食い替え判定 =====

/**
 * チーした後の食い替え制約を取得する
 *
 * 食い替え: チーで鳴いた牌と同じ牌、またはチーした順子のスジの牌を捨てること
 * 例: 4,5 を持っていて 3 をチーした場合、3 と 6 が食い替えになる
 *
 * @param chiCandidate チーの候補
 * @returns 食い替え制約（禁止される TileType のリスト）
 */
export function getKuikaeConstraint(chiCandidate: ChiCandidate): KuikaeConstraint {
  const calledInfo = getNumberTileInfo(chiCandidate.calledTile);
  if (!calledInfo) return { forbiddenTypes: [] };

  const forbidden: TileType[] = [];

  // 鳴いた牌と同種の牌は常に禁止
  forbidden.push(chiCandidate.calledTile.type);

  // スジの食い替え判定
  // チーした順子の端から見て反対側の牌
  const resultNumbers = chiCandidate.resultTiles.map((t) => getNumberTileInfo(t)!.number);
  const calledNum = calledInfo.number;
  const suit = getTileSuit(chiCandidate.calledTile);

  // 鳴いた牌が順子の左端の場合: 右端+1 がスジ食い替え
  // 鳴いた牌が順子の右端の場合: 左端-1 がスジ食い替え
  // 鳴いた牌が順子の中央の場合: スジ食い替えなし
  if (calledNum === resultNumbers[0]) {
    // 左端: 例えば 3,4,5 で 3 を鳴いた → 6 が食い替え
    const sujiNum = resultNumbers[2] + 1;
    if (sujiNum >= 1 && sujiNum <= 9) {
      const sujiType = numberToTileType(suit, sujiNum);
      if (sujiType) forbidden.push(sujiType);
    }
  } else if (calledNum === resultNumbers[2]) {
    // 右端: 例えば 3,4,5 で 5 を鳴いた → 2 が食い替え
    const sujiNum = resultNumbers[0] - 1;
    if (sujiNum >= 1 && sujiNum <= 9) {
      const sujiType = numberToTileType(suit, sujiNum);
      if (sujiType) forbidden.push(sujiType);
    }
  }
  // 中央の場合はスジ食い替えなし（同種牌のみ禁止）

  return { forbiddenTypes: forbidden };
}

// ===== Meld 構築ヘルパー =====

/**
 * チーの Meld を構築する
 */
export function createChiMeld(candidate: ChiCandidate, fromPlayerIndex: number): Meld {
  return {
    type: MeldType.Chi,
    tiles: candidate.resultTiles,
    calledTile: candidate.calledTile,
    fromPlayerIndex,
  };
}

/**
 * ポンの Meld を構築する
 */
export function createPonMeld(
  handTiles: [Tile, Tile],
  calledTile: Tile,
  fromPlayerIndex: number,
): Meld {
  return {
    type: MeldType.Pon,
    tiles: [...handTiles, calledTile],
    calledTile,
    fromPlayerIndex,
  };
}

/**
 * 明槓の Meld を構築する
 */
export function createMinkanMeld(
  handTiles: [Tile, Tile, Tile],
  calledTile: Tile,
  fromPlayerIndex: number,
): Meld {
  return {
    type: MeldType.Minkan,
    tiles: [...handTiles, calledTile],
    calledTile,
    fromPlayerIndex,
  };
}

/**
 * 暗槓の Meld を構築する
 */
export function createAnkanMeld(tiles: [Tile, Tile, Tile, Tile]): Meld {
  return {
    type: MeldType.Ankan,
    tiles,
  };
}

/**
 * 加槓の Meld を構築する（元のポン Meld を拡張）
 */
export function createKakanMeld(ponMeld: Meld, addTile: Tile): Meld {
  return {
    type: MeldType.Kakan,
    tiles: [...ponMeld.tiles, addTile],
    calledTile: ponMeld.calledTile,
    fromPlayerIndex: ponMeld.fromPlayerIndex,
  };
}

// ===== 内部ヘルパー =====

/**
 * スートと数字から TileType を逆引きする
 */
function numberToTileType(suit: TileSuit, num: number): TileType | undefined {
  if (num < 1 || num > 9) return undefined;

  const prefixMap: Record<string, string> = {
    [TileSuit.Manzu]: "man",
    [TileSuit.Souzu]: "sou",
    [TileSuit.Pinzu]: "pin",
  };

  const prefix = prefixMap[suit];
  if (!prefix) return undefined;

  return `${prefix}${num}` as TileType;
}
