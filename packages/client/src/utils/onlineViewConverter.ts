/**
 * サーバーから受信した PlayerGameView (DTO) を
 * 既存 GameBoard が受け取る PlayerViewState[] に変換するユーティリティ。
 *
 * CPU対局用の viewConverter.ts はドメインオブジェクトを直接参照するが、
 * こちらは JSON 互換の DTO のみを扱う。
 */
import type {
  PlayerGameView,
  SelfPlayerView,
  OpponentPlayerView,
  MeldDto,
  TileDto,
  DiscardEntryDto,
  ActionDto,
} from "@mahjong-web/shared";
import type { TileData, DiscardEntryData, MeldViewData, PlayerViewState } from "@/types";
import { sortTiles, getTenpaiTiles } from "@mahjong-web/domain";
import type { Tile, TileType, Meld } from "@mahjong-web/domain";

// ===== 基本変換 =====

function dtoToTileData(dto: TileDto): TileData {
  return { type: dto.type, id: dto.id, isRedDora: dto.isRedDora };
}

function dtoToDiscardEntry(dto: DiscardEntryDto): DiscardEntryData {
  return {
    tile: dtoToTileData(dto.tile),
    isRiichi: dto.isRiichiDeclare,
    isTsumogiri: dto.isTsumogiri,
  };
}

/**
 * 捨て牌 DTO 配列を表示用に変換する。
 * - 鳴かれた牌（calledByPlayerIndex あり）を除外して可視牌のみにする
 * - リーチ宣言牌が鳴かれた場合、次の可視牌を横向き表示にする
 */
function convertDiscards(dtos: readonly DiscardEntryDto[]): DiscardEntryData[] {
  // リーチ宣言牌が鳴かれたか判定
  let riichiCalledNextVisible = false;
  for (const dto of dtos) {
    if (dto.isRiichiDeclare && dto.calledByPlayerIndex !== undefined) {
      riichiCalledNextVisible = true;
    }
  }

  // 可視牌（鳴かれていない牌）のみフィルタ
  const visible = dtos.filter((d) => d.calledByPlayerIndex === undefined);

  return visible.map((dto, idx) => {
    let isRiichiRotated = false;
    if (riichiCalledNextVisible && !dto.isRiichiDeclare) {
      const prevVisibles = visible.slice(0, idx);
      const hasRiichiVisible = prevVisibles.some((e) => e.isRiichiDeclare);
      if (!hasRiichiVisible) {
        isRiichiRotated = true;
        riichiCalledNextVisible = false;
      }
    }
    return {
      tile: dtoToTileData(dto.tile),
      isRiichi: dto.isRiichiDeclare,
      isRiichiRotated,
      isTsumogiri: dto.isTsumogiri,
    };
  });
}

/**
 * MeldDto → MeldViewData
 * 鳴き元の相対位置に基づいて横倒し牌の位置を決める。
 */
function dtoToMeldView(dto: MeldDto, playerSeatIndex: number): MeldViewData {
  const meldType = dto.type;

  if (meldType === "ankan") {
    return { tiles: dto.tiles.map(dtoToTileData), meldType };
  }

  const fromIndex = dto.fromPlayerIndex;
  if (fromIndex === undefined || !dto.calledTile) {
    return { tiles: dto.tiles.map(dtoToTileData), meldType };
  }

  const relative = (fromIndex - playerSeatIndex + 4) % 4;
  const calledTileData = dtoToTileData(dto.calledTile);
  const ownTileData = dto.tiles
    .filter((t) => !(t.type === dto.calledTile!.type && t.id === dto.calledTile!.id))
    .map(dtoToTileData);

  let tiles: TileData[];
  let calledTileIndex: number;

  if (relative === 3) {
    // 上家: 左端
    tiles = [calledTileData, ...ownTileData];
    calledTileIndex = 0;
  } else if (relative === 2) {
    // 対面: 真ん中
    if (meldType === "minkan" || meldType === "kakan") {
      tiles = [ownTileData[0], calledTileData, ownTileData[1], ownTileData[2]];
      calledTileIndex = 1;
    } else {
      tiles = [ownTileData[0], calledTileData, ownTileData[1]];
      calledTileIndex = 1;
    }
  } else {
    // 下家: 右端
    tiles = [...ownTileData, calledTileData];
    calledTileIndex = tiles.length - 1;
  }

  return { tiles, calledTileIndex, meldType };
}

// ===== Self → PlayerViewState =====

function selfToViewState(self: SelfPlayerView): PlayerViewState {
  const tiles = self.handTiles.map(dtoToTileData);
  const hasDraw = tiles.length % 3 === 2; // 14, 11, 8, 5, 2...

  let hand: TileData[];
  let drawnTile: TileData | undefined;

  if (hasDraw) {
    drawnTile = tiles[tiles.length - 1];
    hand = sortTiles(tiles.slice(0, -1) as unknown as Tile[]).map(dtoToTileData);
  } else {
    hand = sortTiles([...tiles] as unknown as Tile[]).map(dtoToTileData);
    drawnTile = undefined;
  }

  return {
    hand,
    drawnTile,
    discards: convertDiscards(self.discards),
    melds: self.melds.map((m) => dtoToMeldView(m, self.seatIndex)),
    score: self.score,
  };
}

// ===== Opponent → PlayerViewState =====

function opponentToViewState(opp: OpponentPlayerView): PlayerViewState {
  const hand: TileData[] = Array.from({ length: opp.handCount }, (_, i) => ({
    type: "back",
    id: i,
    isRedDora: false,
  }));

  return {
    hand,
    drawnTile: undefined,
    discards: convertDiscards(opp.discards),
    melds: opp.melds.map((m) => dtoToMeldView(m, opp.seatIndex)),
    score: opp.score,
  };
}

// ===== メイン変換 =====

/**
 * PlayerGameView を GameBoard 用の PlayerViewState[4] に変換する。
 * 配列順: [0]=self, [1]=下家, [2]=対面, [3]=上家
 */
export function gameViewToPlayerViews(view: PlayerGameView): PlayerViewState[] {
  const mySeat = view.mySeatIndex;
  const result: PlayerViewState[] = new Array(4);

  // 自分
  result[0] = selfToViewState(view.self);

  // 他家を相対位置で配置
  for (const opp of view.opponents) {
    const rel = (opp.seatIndex - mySeat + 4) % 4; // 1=下家, 2=対面, 3=上家
    result[rel] = opponentToViewState(opp);
  }

  return result;
}

/**
 * ActionDto[] を ActionButtons 用の { type, label } に変換する。
 * 打牌(discard)はタイルクリックで処理するため除外する。
 */
const ACTION_LABELS: Record<string, string> = {
  tsumo: "ツモ",
  ron: "ロン",
  riichi: "リーチ",
  discard: "打牌",
  ankan: "暗槓",
  kakan: "加槓",
  minkan: "大明槓",
  pon: "ポン",
  chi: "チー",
  kyuushu_kyuuhai: "九種九牌",
  skip: "スキップ",
};

export interface OnlineActionOption {
  type: string;
  label: string;
  dto: ActionDto;
}

export function buildOnlineActionOptions(actions: ActionDto[]): OnlineActionOption[] {
  const options: OnlineActionOption[] = [];
  const seen = new Set<string>();

  for (const dto of actions) {
    if (dto.type === "discard") continue;

    const key = dto.type === "riichi" ? "riichi" : dto.type === "ankan" ? "ankan" : dto.type;
    if (!seen.has(key)) {
      seen.add(key);
      options.push({
        type: dto.type,
        label: ACTION_LABELS[dto.type] ?? dto.type,
        dto,
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
export function getOnlineRiichiCandidateTileTypes(actions: ActionDto[]): Set<string> {
  const types = new Set<string>();
  for (const a of actions) {
    if (a.type === "riichi" && a.tile) {
      types.add(a.tile.type);
    }
  }
  return types;
}

// ===== Riichi waiting tile info =====

export interface OnlineWaitingTileInfo {
  type: string;
  remaining: number;
}

/**
 * リーチ候補牌を捨てた場合の待ち牌リストと推定残り枚数を計算する。
 * 対人戦では自分の可視情報（手牌・全河・ドラ表示牌・全副露）のみで概算する。
 */
export function computeOnlineWaitingTiles(
  view: PlayerGameView,
  discardTileType: string,
): OnlineWaitingTileInfo[] {
  const handTiles = view.self.handTiles;

  // 捨てる牌を1枚除いた手牌で聴牌判定
  let removed = false;
  const remaining = handTiles.filter((t) => {
    if (!removed && t.type === discardTileType) {
      removed = true;
      return false;
    }
    return true;
  });
  const closedTypes = remaining.map((t) => t.type) as TileType[];
  const melds = view.self.melds as unknown as Meld[];
  const waitTypes = getTenpaiTiles(closedTypes, melds);
  if (waitTypes.length === 0) return [];

  // 可視牌のtype別カウント
  const visibleCount = new Map<string, number>();
  const inc = (type: string) => visibleCount.set(type, (visibleCount.get(type) ?? 0) + 1);

  // 自分の手牌（捨てる牌を除いた残り）
  for (const t of remaining) inc(t.type);

  // 全プレイヤーの河（鳴かれた牌は副露で数えるので除外）
  for (const d of view.self.discards) {
    if (d.calledByPlayerIndex === undefined) inc(d.tile.type);
  }
  for (const opp of view.opponents) {
    for (const d of opp.discards) {
      if (d.calledByPlayerIndex === undefined) inc(d.tile.type);
    }
  }

  // ドラ表示牌
  for (const t of view.doraIndicators) inc(t.type);

  // 全プレイヤーの副露
  for (const m of view.self.melds) {
    for (const t of m.tiles) inc(t.type);
  }
  for (const opp of view.opponents) {
    for (const m of opp.melds) {
      for (const t of m.tiles) inc(t.type);
    }
  }

  return waitTypes.map((type) => ({
    type,
    remaining: 4 - (visibleCount.get(type) ?? 0),
  }));
}
