/**
 * RoundEventDataDto → ReplaySnapshot[] 変換ユーティリティ
 *
 * 牌譜再生に必要なスナップショット配列を構築する。
 * 各スナップショットはイベント適用後の盤面状態を表す。
 */
import type { RoundEventDataDto, ReplayEventDto, TileDto } from "@mahjong-web/shared";
import { ALL_TILE_TYPES } from "@mahjong-web/domain";
import type { TileData, DiscardEntryData, MeldViewData, PlayerViewState } from "@/types";

// ===== 公開型定義 =====

/** 牌譜再生の局結果情報 */
export interface ReplayRoundResult {
  reason: string;
  scoreChanges: [number, number, number, number];
  dealerKeeps: boolean;
  tenpaiPlayers: boolean[];
}

/** 1イベントに対応する盤面スナップショット */
export interface ReplaySnapshot {
  players: readonly PlayerViewState[];
  doraIndicators: readonly TileData[];
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  dealerIndex: number;
  remainingTiles: number;
  activePlayerIndex: number;
  /** -1 = 初期状態（配牌後）、0以上 = events[] のインデックス */
  eventIndex: number;
  /** イベント種別文字列（表示用） */
  eventType: string;
  /** round_result イベント時のみ設定 */
  roundResult?: ReplayRoundResult;
}

// ===== 内部型 =====

interface MutablePlayerState {
  /** ソート済み手牌（ドロー牌は含まない） */
  hand: TileData[];
  /** 直近のドロー牌（draw イベントで設定）*/
  drawnTile?: TileData;
  discards: DiscardEntryData[];
  melds: MeldViewData[];
  score: number;
  isRiichi: boolean;
}

// ===== ヘルパー =====

function dtoToTileData(tile: TileDto): TileData {
  return { type: tile.type, id: tile.id, isRedDora: tile.isRedDora };
}

const BACK_TILE: TileData = { type: "back", id: -1, isRedDora: false };

/** ドメインの ALL_TILE_TYPES 順序に基づくインデックスマップ */
const TILE_TYPE_ORDER: ReadonlyMap<string, number> = new Map(
  ALL_TILE_TYPES.map((t, i) => [t, i]),
);

/** 牌種の並び順（ドメインの sortTiles と同じ順序） */
function tileOrder(type: string): number {
  return TILE_TYPE_ORDER.get(type) ?? 999;
}

function sortTileData(tiles: TileData[]): TileData[] {
  return [...tiles].sort((a, b) => {
    const diff = tileOrder(a.type) - tileOrder(b.type);
    if (diff !== 0) return diff;
    // 同種内: 赤ドラを先に
    return (a.isRedDora ? 0 : 1) - (b.isRedDora ? 0 : 1);
  });
}

/** 手牌から指定牌を1枚除去（ID一致 → 型一致の順で試みる） */
function removeTileExact(hand: TileData[], tile: TileDto): TileData {
  const byId = hand.findIndex((t) => t.id === tile.id && t.type === tile.type);
  if (byId !== -1) return hand.splice(byId, 1)[0];
  const byType = hand.findIndex((t) => t.type === tile.type && !t.isRedDora);
  if (byType !== -1) return hand.splice(byType, 1)[0];
  const any = hand.findIndex((t) => t.type === tile.type);
  if (any !== -1) return hand.splice(any, 1)[0];
  return dtoToTileData(tile);
}

/** 手牌から指定型を1枚除去 */
function removeTileByType(hand: TileData[], tileType: string): TileData {
  const nonRed = hand.findIndex((t) => t.type === tileType && !t.isRedDora);
  if (nonRed !== -1) return hand.splice(nonRed, 1)[0];
  const any = hand.findIndex((t) => t.type === tileType);
  if (any !== -1) return hand.splice(any, 1)[0];
  return { type: tileType, id: -1, isRedDora: false };
}

/**
 * チーに使われた2枚の手牌の型を推定する。
 * 呼び牌型を含む順子を形成できる手牌の組み合わせを返す。
 */
function findChiOwnTypes(hand: TileData[], calledType: string): [string, string] | undefined {
  const suit = calledType.slice(-1);
  const num = parseInt(calledType.slice(0, -1), 10);
  if (isNaN(num) || suit === "z") return undefined;

  const candidates: [string, string][] = [];
  if (num >= 3) candidates.push([`${num - 2}${suit}`, `${num - 1}${suit}`]);
  if (num >= 2 && num <= 8) candidates.push([`${num - 1}${suit}`, `${num + 1}${suit}`]);
  if (num <= 7) candidates.push([`${num + 1}${suit}`, `${num + 2}${suit}`]);

  for (const [t1, t2] of candidates) {
    const idx1 = hand.findIndex((t) => t.type === t1);
    if (idx1 === -1) continue;
    const rest = [...hand];
    rest.splice(idx1, 1);
    const idx2 = rest.findIndex((t) => t.type === t2);
    if (idx2 !== -1) return [t1, t2];
  }
  return undefined;
}

function buildMeldView(
  meldType: string,
  tiles: TileData[],
  calledTileIndex: number | undefined,
): MeldViewData {
  return { tiles, calledTileIndex, meldType };
}

function buildPlayerViewStates(states: MutablePlayerState[]): readonly PlayerViewState[] {
  return states.map((s) => ({
    hand: sortTileData([...s.hand]),
    drawnTile: s.drawnTile,
    discards: [...s.discards],
    melds: [...s.melds],
    score: s.score,
  }));
}

function buildSnapshot(
  states: MutablePlayerState[],
  doraIndicators: TileData[],
  data: RoundEventDataDto,
  riichiSticks: number,
  remainingTiles: number,
  activePlayerIndex: number,
  eventIndex: number,
  eventType: string,
  roundResult?: ReplayRoundResult,
): ReplaySnapshot {
  return {
    players: buildPlayerViewStates(states),
    doraIndicators: [...doraIndicators],
    roundWind: String(data.roundWind),
    roundNumber: data.roundNumber,
    honba: data.honba,
    riichiSticks,
    dealerIndex: data.dealerIndex,
    remainingTiles,
    activePlayerIndex,
    eventIndex,
    eventType,
    roundResult,
  };
}

// ===== メイン関数 =====

/**
 * RoundEventDataDto → ReplaySnapshot[] に変換する。
 *
 * @param data 局牌譜データ
 * @param initialScores 局開始時の点数（省略時は25000点均等）
 */
export function buildReplaySnapshots(
  data: RoundEventDataDto,
  initialScores: [number, number, number, number] = [25000, 25000, 25000, 25000],
): ReplaySnapshot[] {
  const states: MutablePlayerState[] = data.initialHands.map((hand, i) => ({
    hand: sortTileData(hand.map(dtoToTileData)),
    drawnTile: undefined,
    discards: [],
    melds: [],
    score: initialScores[i],
    isRiichi: false,
  }));

  const doraIndicators: TileData[] = [];
  let riichiSticks = data.riichiSticks;
  let remainingTiles = 70; // 近似値

  const snapshots: ReplaySnapshot[] = [];

  // 初期スナップショット（配牌直後）
  snapshots.push(
    buildSnapshot(
      states,
      doraIndicators,
      data,
      riichiSticks,
      remainingTiles,
      data.dealerIndex,
      -1,
      "start",
    ),
  );

  for (let i = 0; i < data.events.length; i++) {
    const event = data.events[i];
    const pi = event.playerIndex;

    switch (event.type) {
      // ===== ドロー =====
      case "draw": {
        if (event.tile) {
          states[pi].drawnTile = dtoToTileData(event.tile);
        }
        break;
      }

      // ===== 打牌 / リーチ =====
      case "discard":
      case "riichi": {
        if (event.tile) {
          let discardedTile: TileData;
          if (event.isTsumogiri) {
            // ツモ切り: ドロー牌を捨てる
            discardedTile = states[pi].drawnTile ?? dtoToTileData(event.tile);
            states[pi].drawnTile = undefined;
          } else {
            // 手出し: 手牌から除去、ドロー牌を手牌に取り込む
            discardedTile = removeTileExact(states[pi].hand, event.tile);
            if (states[pi].drawnTile) {
              states[pi].hand = sortTileData([...states[pi].hand, states[pi].drawnTile!]);
              states[pi].drawnTile = undefined;
            }
          }
          states[pi].discards.push({
            tile: discardedTile,
            isRiichi: event.type === "riichi",
            isTsumogiri: event.isTsumogiri ?? false,
          });
        }
        if (event.type === "riichi") {
          riichiSticks++;
          states[pi].score -= 1000;
          states[pi].isRiichi = true;
        }
        remainingTiles = Math.max(0, remainingTiles - 1);
        break;
      }

      // ===== チー =====
      case "chi": {
        const calledTile = event.tile ? dtoToTileData(event.tile) : BACK_TILE;
        const fromIdx = event.fromPlayerIndex ?? ((pi + 3) % 4);

        // 呼んだ牌の2枚を手牌から除去（推定）
        let own1: TileData = BACK_TILE;
        let own2: TileData = BACK_TILE;
        if (event.tile) {
          const ownTypes = findChiOwnTypes(states[pi].hand, event.tile.type);
          if (ownTypes) {
            own1 = removeTileByType(states[pi].hand, ownTypes[0]);
            own2 = removeTileByType(states[pi].hand, ownTypes[1]);
          }
        }
        states[pi].drawnTile = undefined;

        // 鳴き元に応じたタイル並び
        const relFrom = (fromIdx - pi + 4) % 4;
        let tiles: TileData[];
        let calledIdx: number;
        if (relFrom === 3) {
          // 上家
          tiles = [calledTile, own1, own2];
          calledIdx = 0;
        } else if (relFrom === 2) {
          // 対面
          tiles = [own1, calledTile, own2];
          calledIdx = 1;
        } else {
          // 下家
          tiles = [own1, own2, calledTile];
          calledIdx = 2;
        }
        states[pi].melds.push(buildMeldView("chi", tiles, calledIdx));
        break;
      }

      // ===== ポン =====
      case "pon": {
        const calledTile = event.tile ? dtoToTileData(event.tile) : BACK_TILE;
        const fromIdx = event.fromPlayerIndex ?? 0;
        const own1 = event.tile ? removeTileByType(states[pi].hand, event.tile.type) : BACK_TILE;
        const own2 = event.tile ? removeTileByType(states[pi].hand, event.tile.type) : BACK_TILE;
        states[pi].drawnTile = undefined;

        const relFrom = (fromIdx - pi + 4) % 4;
        let tiles: TileData[];
        let calledIdx: number;
        if (relFrom === 3) {
          tiles = [calledTile, own1, own2];
          calledIdx = 0;
        } else if (relFrom === 2) {
          tiles = [own1, calledTile, own2];
          calledIdx = 1;
        } else {
          tiles = [own1, own2, calledTile];
          calledIdx = 2;
        }
        states[pi].melds.push(buildMeldView("pon", tiles, calledIdx));
        break;
      }

      // ===== 大明槓 =====
      case "minkan": {
        const calledTile = event.tile ? dtoToTileData(event.tile) : BACK_TILE;
        const fromIdx = event.fromPlayerIndex ?? 0;
        const own1 = event.tile ? removeTileByType(states[pi].hand, event.tile.type) : BACK_TILE;
        const own2 = event.tile ? removeTileByType(states[pi].hand, event.tile.type) : BACK_TILE;
        const own3 = event.tile ? removeTileByType(states[pi].hand, event.tile.type) : BACK_TILE;
        states[pi].drawnTile = undefined;

        const relFrom = (fromIdx - pi + 4) % 4;
        let tiles: TileData[];
        let calledIdx: number;
        if (relFrom === 3) {
          tiles = [calledTile, own1, own2, own3];
          calledIdx = 0;
        } else if (relFrom === 2) {
          tiles = [own1, calledTile, own2, own3];
          calledIdx = 1;
        } else {
          tiles = [own1, own2, own3, calledTile];
          calledIdx = 3;
        }
        states[pi].melds.push(buildMeldView("minkan", tiles, calledIdx));
        doraIndicators.push(BACK_TILE);
        break;
      }

      // ===== 暗槓 =====
      case "ankan": {
        if (event.tileType) {
          const t1 = removeTileByType(states[pi].hand, event.tileType);
          const t2 = removeTileByType(states[pi].hand, event.tileType);
          const t3 = removeTileByType(states[pi].hand, event.tileType);
          let t4: TileData;
          if (states[pi].drawnTile?.type === event.tileType) {
            t4 = states[pi].drawnTile!;
            states[pi].drawnTile = undefined;
          } else {
            t4 = removeTileByType(states[pi].hand, event.tileType);
          }
          states[pi].melds.push(buildMeldView("ankan", [t1, t2, t3, t4], undefined));
          doraIndicators.push(BACK_TILE);
        }
        break;
      }

      // ===== 加槓 =====
      case "kakan": {
        if (event.tile) {
          let addedTile: TileData;
          if (states[pi].drawnTile?.type === event.tile.type) {
            addedTile = states[pi].drawnTile!;
            states[pi].drawnTile = undefined;
          } else {
            addedTile = removeTileExact(states[pi].hand, event.tile);
          }
          // 既存ポン面子に追加
          const ponIdx = states[pi].melds.findIndex(
            (m) => m.meldType === "pon" && m.tiles.some((t) => t.type === event.tile!.type),
          );
          if (ponIdx !== -1) {
            const pon = states[pi].melds[ponIdx];
            states[pi].melds[ponIdx] = buildMeldView(
              "kakan",
              [...pon.tiles, addedTile],
              pon.calledTileIndex,
            );
          }
          doraIndicators.push(BACK_TILE);
        }
        break;
      }

      // ===== ツモ和了 =====
      case "tsumo": {
        if (event.ownTiles && event.ownTiles.length > 0) {
          const all = event.ownTiles.map(dtoToTileData);
          // ownTiles の最後がドロー牌（14枚目）
          const drawnIdx = all.length - 1;
          states[pi].hand = sortTileData(all.slice(0, drawnIdx));
          states[pi].drawnTile = all[drawnIdx];
        }
        break;
      }

      // ===== ロン和了 =====
      case "ron": {
        if (event.ownTiles && event.ownTiles.length > 0) {
          // ownTiles は手牌13枚（ロン牌は event.tile）
          states[pi].hand = sortTileData(event.ownTiles.map(dtoToTileData));
          states[pi].drawnTile = event.tile ? dtoToTileData(event.tile) : undefined;
        }
        break;
      }

      // ===== 局結果 =====
      case "round_result": {
        if (event.scoreChanges) {
          for (let j = 0; j < 4; j++) {
            states[j].score += event.scoreChanges[j];
          }
        }
        break;
      }

      case "skip":
      case "kyuushu_kyuuhai":
      default:
        break;
    }

    const roundResult: ReplayRoundResult | undefined =
      event.type === "round_result"
        ? {
            reason: event.reason ?? "unknown",
            scoreChanges: event.scoreChanges ?? [0, 0, 0, 0],
            dealerKeeps: event.dealerKeeps ?? false,
            tenpaiPlayers: event.tenpaiPlayers ?? [false, false, false, false],
          }
        : undefined;

    snapshots.push(
      buildSnapshot(
        states,
        doraIndicators,
        data,
        riichiSticks,
        remainingTiles,
        pi,
        i,
        event.type,
        roundResult,
      ),
    );
  }

  return snapshots;
}

// ===== イベント種別の表示ラベル =====

const EVENT_LABELS: Record<string, string> = {
  start: "配牌",
  draw: "ドロー",
  discard: "打牌",
  riichi: "リーチ",
  chi: "チー",
  pon: "ポン",
  minkan: "大明槓",
  ankan: "暗槓",
  kakan: "加槓",
  tsumo: "ツモ",
  ron: "ロン",
  kyuushu_kyuuhai: "九種九牌",
  round_result: "局結果",
  skip: "スキップ",
};

export function getEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

/** イベントの中でスキップ可能（表示上意味のない）イベントかどうか */
export function isDisplayableEvent(event: ReplayEventDto): boolean {
  return event.type !== "skip";
}
