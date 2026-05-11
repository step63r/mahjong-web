/**
 * ドメインの RoundState / GameState から UI 表示用データに変換するユーティリティ
 */
import type { RoundState, Tile, Meld, PlayerAction, GameState } from "@mahjong-web/domain";
import { ActionType, sortTiles, getTenpaiTiles } from "@mahjong-web/domain";
import type { TileData, DiscardEntryData, MeldViewData, PlayerViewState } from "@/types";

// ===== Tile conversion =====

export function toTileData(tile: Tile): TileData {
  return { type: tile.type, id: tile.id, isRedDora: tile.isRedDora };
}

// ===== Meld conversion =====

/**
 * 鳴き元の相対位置を求める
 * - 上家(kamicha): 左 → calledTileIndex = 0
 * - 対面(toimen):  中 → calledTileIndex = 1（明槓は1）
 * - 下家(shimocha): 右 → calledTileIndex = 末尾
 */
export function toMeldView(meld: Meld, playerIndex: number): MeldViewData {
  const meldType = meld.type;

  // 暗槓: 横倒し牌なし
  if (meldType === "ankan") {
    return { tiles: meld.tiles.map(toTileData), meldType };
  }

  // 加槓: ポン時の並びを維持（fromPlayerIndex はポン時のもの）
  // ここでは鳴き元を使って並べ替え

  const fromIndex = meld.fromPlayerIndex;
  if (fromIndex === undefined || !meld.calledTile) {
    return { tiles: meld.tiles.map(toTileData), meldType };
  }

  // 相対位置: (from - player + 4) % 4 → 3=上家, 2=対面, 1=下家
  const relative = (fromIndex - playerIndex + 4) % 4;

  // 自牌（鳴いた牌以外）
  const ownTiles = meld.tiles.filter(
    (t) => !(t.type === meld.calledTile!.type && t.id === meld.calledTile!.id),
  );
  const calledTileData = toTileData(meld.calledTile);
  const ownTileData = ownTiles.map(toTileData);

  let tiles: TileData[];
  let calledTileIndex: number;

  if (relative === 3) {
    // 上家: 鳴いた牌を左（先頭）
    tiles = [calledTileData, ...ownTileData];
    calledTileIndex = 0;
  } else if (relative === 2) {
    // 対面: 鳴いた牌を真ん中（明槓は右から2番目=index 1）
    if (meldType === "minkan" || meldType === "kakan") {
      tiles = [ownTileData[0], calledTileData, ownTileData[1], ownTileData[2]];
      calledTileIndex = 1;
    } else {
      tiles = [ownTileData[0], calledTileData, ownTileData[1]];
      calledTileIndex = 1;
    }
  } else {
    // 下家 (relative === 1): 鳴いた牌を右（末尾）
    tiles = [...ownTileData, calledTileData];
    calledTileIndex = tiles.length - 1;
  }

  return { tiles, calledTileIndex, meldType };
}

// ===== Player view conversion =====

/**
 * 局の状態からプレイヤー表示用データを生成する。
 * humanIndex のプレイヤーは手牌を公開し、それ以外は伏せ牌にする。
 * debugMode が true の場合は全員の手牌を公開する。
 * revealedPlayerIndices が指定された場合、該当プレイヤーの手牌も公開する。
 * sorted が false の場合、自家の手牌をソートせず挿入順（配牌順）で返す。
 */
export function buildPlayerViews(
  round: RoundState,
  humanIndex: number,
  debugMode: boolean,
  revealedPlayerIndices?: ReadonlySet<number>,
  sorted = true,
  isPostMeldTurn = false,
): PlayerViewState[] {
  return round.players.map((player, i) => {
    const showHand = i === humanIndex || debugMode || (revealedPlayerIndices?.has(i) ?? false);
    const handTiles = player.hand.getTiles();

    // 手牌: ツモ牌は最後の1枚を分離して drawnTile にする（14枚の場合）
    // isPostMeldTurn=true の場合は副露直後でドロー牌はなく、全牌を hand に含める
    const hasDraw = handTiles.length === 14 - player.melds.length * 3;
    const effectiveHasDraw = hasDraw && !(i === humanIndex && isPostMeldTurn);
    const isFullHand = handTiles.length % 3 === 2; // 14, 11, 8, 5, 2...

    let hand: TileData[];
    let drawnTile: TileData | undefined;

    if (showHand) {
      if (isFullHand && effectiveHasDraw) {
        const drawnTileRaw = handTiles[handTiles.length - 1];
        hand = (sorted ? sortTiles(handTiles.slice(0, -1)) : [...handTiles.slice(0, -1)]).map(toTileData);
        drawnTile = toTileData(drawnTileRaw);
      } else {
        hand = (sorted ? sortTiles([...handTiles]) : [...handTiles]).map(toTileData);
        drawnTile = undefined;
      }
    } else {
      // 伏せ牌（見えないが内部的にはソート済み）
      hand = handTiles.map((_, idx) => ({
        type: "back",
        id: idx,
        isRedDora: false,
      }));
      drawnTile = undefined;
    }

    // 河
    // リーチ宣言牌が鳴かれた場合、次の可視牌を横向きにする
    const allDiscards = player.discard.getAllDiscards();
    let riichiCalledNextVisible = false;
    for (const entry of allDiscards) {
      if (entry.isRiichiDeclare && entry.calledBy !== undefined) {
        riichiCalledNextVisible = true;
      }
    }
    const visibleDiscards = player.discard.getVisibleDiscards();
    const discards: DiscardEntryData[] = visibleDiscards.map((entry, idx) => {
      // リーチ宣言牌が鳴かれた場合: リーチ宣言牌直後の最初の可視牌を横向きにする
      let isRiichiRotated = false;
      if (riichiCalledNextVisible && !entry.isRiichiDeclare) {
        // リーチ宣言牌の後の最初の可視牌かどうかを判定
        const prevVisibles = visibleDiscards.slice(0, idx);
        const hasRiichiVisible = prevVisibles.some((e) => e.isRiichiDeclare);
        if (!hasRiichiVisible) {
          // リーチ宣言牌が可視牌に無い = 鳴かれた → この牌が鳴かれ後最初の可視牌
          isRiichiRotated = true;
          riichiCalledNextVisible = false; // 一度だけ
        }
      }
      return {
        tile: toTileData(entry.tile),
        isRiichi: entry.isRiichiDeclare,
        isRiichiRotated,
        isTsumogiri: entry.isTsumogiri,
      };
    });

    // 副露
    const melds: MeldViewData[] = player.melds.map((m) => toMeldView(m, i));

    return { hand, drawnTile, discards, melds, score: player.score };
  });
}

// ===== Action → UI label conversion =====

const ACTION_LABELS: Record<string, string> = {
  [ActionType.Tsumo]: "ツモ",
  [ActionType.Ron]: "ロン",
  [ActionType.Riichi]: "リーチ",
  [ActionType.Discard]: "打牌",
  [ActionType.Ankan]: "暗槓",
  [ActionType.Kakan]: "加槓",
  [ActionType.Minkan]: "大明槓",
  [ActionType.Pon]: "ポン",
  [ActionType.Chi]: "チー",
  [ActionType.KyuushuKyuuhai]: "九種九牌",
  [ActionType.Skip]: "スキップ",
};

export interface ActionOption {
  type: string;
  label: string;
  action: PlayerAction;
}

/**
 * アクション一覧を UI 表示用に変換する。
 * 打牌アクションはタイル選択で個別に処理するため除外する。
 */
export function buildActionOptions(actions: PlayerAction[]): ActionOption[] {
  const options: ActionOption[] = [];
  const seen = new Set<string>();

  for (const action of actions) {
    // 打牌はボタンではなくタイルクリックで処理
    if (action.type === ActionType.Discard) continue;

    // リーチは1つだけ表示（捨て牌選択は後で）
    const key =
      action.type === ActionType.Riichi
        ? "riichi"
        : action.type === ActionType.Ankan
          ? `ankan`
          : action.type === ActionType.Chi
            ? `chi-${(action as { ownTiles?: Tile[] }).ownTiles?.map((t: Tile) => t.type).join(",")}`
            : action.type;

    if (!seen.has(key)) {
      seen.add(key);
      options.push({
        type: action.type,
        label: ACTION_LABELS[action.type] ?? action.type,
        action,
      });
    }
  }

  return options;
}

// ===== Riichi helpers =====

/**
 * リーチアクションの候補牌 type 一覧を返す。
 * UI 側でリーチモード中に候補牌をハイライトするために使用。
 */
export function getRiichiCandidateTileTypes(actions: PlayerAction[]): Set<string> {
  const types = new Set<string>();
  for (const a of actions) {
    if (a.type === ActionType.Riichi) {
      types.add((a as { tile: Tile }).tile.type);
    }
  }
  return types;
}

// ===== Riichi waiting tile info =====

export interface WaitingTileInfo {
  type: string;
  remaining: number;
}

/**
 * リーチ候補牌を捨てた場合の待ち牌リストと推定残り枚数を計算する。
 *
 * 推定残り枚数 = 4 - (自分の手牌 + 全河 + ドラ表示牌 + 全副露に見える枚数)
 */
export function computeWaitingTiles(
  round: RoundState,
  discardTileType: string,
): WaitingTileInfo[] {
  const player = round.players[0];
  const handTiles = player.hand.getTiles();

  // 捨てる牌を1枚除いた手牌で聴牌判定
  let removed = false;
  const remaining = handTiles.filter((t) => {
    if (!removed && t.type === discardTileType) {
      removed = true;
      return false;
    }
    return true;
  });
  const closedTypes = remaining.map((t) => t.type);
  const waitTypes = getTenpaiTiles(closedTypes, player.melds);
  if (waitTypes.length === 0) return [];

  // 可視牌のtype別カウント
  const visibleCount = new Map<string, number>();
  const inc = (type: string) => visibleCount.set(type, (visibleCount.get(type) ?? 0) + 1);

  // 自分の手牌（捨てる牌を除いた残り）
  for (const t of remaining) inc(t.type);

  // 全プレイヤーの河（鳴かれた牌は副露で数えるので除外）
  for (const p of round.players) {
    for (const entry of p.discard.getVisibleDiscards()) {
      inc(entry.tile.type);
    }
  }

  // ドラ表示牌
  for (const t of round.wall.getDoraIndicators()) {
    inc(t.type);
  }

  // 全プレイヤーの副露
  for (const p of round.players) {
    for (const meld of p.melds) {
      for (const t of meld.tiles) inc(t.type);
    }
  }

  return waitTypes.map((type) => ({
    type,
    remaining: 4 - (visibleCount.get(type) ?? 0),
  }));
}

// ===== Round info helpers =====

const WIND_LABELS: Record<string, string> = {
  ton: "東",
  nan: "南",
  sha: "西",
  pei: "北",
};

export function getWindLabel(wind: string): string {
  return WIND_LABELS[wind] ?? wind;
}

export function getRoundLabel(game: GameState): string {
  const wind = getWindLabel(game.currentRound.roundWind);
  return `${wind}${game.currentRound.roundNumber}局`;
}
