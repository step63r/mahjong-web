import type { Tile, TileType } from "../tile/index.js";
import { isSameTile } from "../tile/index.js";
import type { Hand } from "../hand/index.js";
import { getTenpaiTiles } from "../hand/index.js";
import type { Meld } from "../meld/index.js";
import {
  findChiCandidates,
  findPonCandidates,
  findMinkanCandidate,
  findAnkanCandidates,
  findKakanCandidates,
} from "../meld/index.js";
import { isKyuushuKyuuhai } from "../hand/tenpai.js";
import type { RuleConfig } from "../rule/index.js";
import type { WinContext } from "../yaku/index.js";
import { judgeWin, checkAtozukeAllowed } from "../yaku/index.js";
import type { PlayerAction } from "./types.js";
import { ActionType } from "./types.js";

// ===== ツモ後に取りうるアクション =====

/**
 * ツモ直後にそのプレイヤーが実行可能なアクションを列挙する。
 *
 * 返されるアクションは優先度の高い順:
 * ツモ和了 > 暗槓 > 加槓 > リーチ+打牌 > 打牌 > 九種九牌
 */
export function getActionsAfterDraw(params: {
  playerIndex: number;
  hand: Hand;
  melds: readonly Meld[];
  drawnTile: Tile;
  ruleConfig: RuleConfig;
  seatWind: TileType;
  roundWind: TileType;
  isFirstDraw: boolean;
  isRiichi: boolean;
  isDoubleRiichi: boolean;
  isIppatsu: boolean;
  isHaitei: boolean;
  doraCount: number;
  uraDoraCount: number;
  redDoraCount: number;
  canKyuushuKyuuhai: boolean;
}): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const {
    playerIndex,
    hand,
    melds,
    drawnTile,
    ruleConfig,
    seatWind,
    roundWind,
    isRiichi,
    isDoubleRiichi,
    isIppatsu,
    isHaitei,
    doraCount,
    uraDoraCount,
    redDoraCount,
    canKyuushuKyuuhai,
  } = params;

  const handTiles = hand.getTiles();

  // --- ツモ和了 ---
  const winCtx: WinContext = {
    handTiles: handTiles as Tile[],
    melds,
    winTile: drawnTile,
    isTsumo: true,
    seatWind,
    roundWind,
    isRiichi,
    isDoubleRiichi,
    isIppatsu,
    isHaitei,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    isTenhou: false,
    isChiihou: false,
    isRenhou: false,
    doraCount,
    uraDoraCount,
    redDoraCount,
    ruleConfig,
  };
  const tsumoResult = judgeWin(winCtx);
  if (tsumoResult && checkAtozukeAllowed(winCtx, tsumoResult)) {
    actions.push({ type: ActionType.Tsumo, playerIndex });
  }

  // リーチ中は打牌のみ（ツモ切り）可能 — ただし暗槓は条件付きで可能
  if (isRiichi) {
    // 暗槓: リーチ後も待ちが変わらない場合のみ可能
    const ankanCandidates = findAnkanCandidates(handTiles as Tile[]);
    for (const c of ankanCandidates) {
      // リーチ後の暗槓は「ツモった牌で暗槓する」かつ「待ちが変わらない」場合のみ
      if (c.tileType === drawnTile.type) {
        const beforeTenpai = getTenpaiTiles(
          handTiles.map((t) => t.type),
          melds,
        );
        // 暗槓後の手牌を仮計算
        const afterHand = handTiles.filter((t) => t.type !== c.tileType).map((t) => t.type);
        const afterMelds: Meld[] = [...melds, { type: "ankan" as const, tiles: c.tiles }];
        const afterTenpai = getTenpaiTiles(afterHand, afterMelds);
        // 待ちが変わらない場合のみ
        if (
          beforeTenpai.length === afterTenpai.length &&
          beforeTenpai.every((t) => afterTenpai.includes(t))
        ) {
          actions.push({ type: ActionType.Ankan, playerIndex, tileType: c.tileType });
        }
      }
    }

    // ツモ切り
    actions.push({
      type: ActionType.Discard,
      playerIndex,
      tile: drawnTile,
      isTsumogiri: true,
    });
    return actions;
  }

  // --- 暗槓 ---
  const ankanCandidates = findAnkanCandidates(handTiles as Tile[]);
  for (const c of ankanCandidates) {
    actions.push({ type: ActionType.Ankan, playerIndex, tileType: c.tileType });
  }

  // --- 加槓 ---
  const kakanCandidates = findKakanCandidates(handTiles as Tile[], melds);
  for (const c of kakanCandidates) {
    actions.push({ type: ActionType.Kakan, playerIndex, tile: c.addTile });
  }

  // --- リーチ ---
  const isMenzen = melds.every((m) => m.type === "ankan");
  if (isMenzen) {
    // 各牌を捨てた時にテンパイになるか
    for (const tile of handTiles) {
      const remaining = handTiles.filter((t) => !isSameTile(t, tile)).map((t) => t.type);
      const tenpai = getTenpaiTiles(remaining, melds);
      if (tenpai.length > 0) {
        // 重複排除（同じ type の牌がすでにリーチ候補にある場合はスキップ）
        const alreadyHas = actions.some(
          (a) => a.type === ActionType.Riichi && a.tile.type === tile.type,
        );
        if (!alreadyHas) {
          actions.push({ type: ActionType.Riichi, playerIndex, tile });
        }
      }
    }
  }

  // --- 打牌（全手牌 + ツモ牌） ---
  const discardTypes = new Set<TileType>();
  for (const tile of handTiles) {
    if (!discardTypes.has(tile.type)) {
      discardTypes.add(tile.type);
      const isTsumogiri = isSameTile(tile, drawnTile);
      actions.push({ type: ActionType.Discard, playerIndex, tile, isTsumogiri });
    }
  }

  // --- 九種九牌 ---
  if (canKyuushuKyuuhai && isKyuushuKyuuhai(handTiles.map((t) => t.type))) {
    actions.push({ type: ActionType.KyuushuKyuuhai, playerIndex });
  }

  return actions;
}

// ===== 他家の打牌に対して取りうるアクション =====

/**
 * 他家の捨て牌に対して実行可能なアクションを列挙する。
 *
 * 返されるアクションは優先度の高い順:
 * ロン > 大明槓 > ポン > チー > スキップ
 */
export function getActionsAfterDiscard(params: {
  playerIndex: number;
  hand: Hand;
  melds: readonly Meld[];
  discardTile: Tile;
  discardPlayerIndex: number;
  ruleConfig: RuleConfig;
  seatWind: TileType;
  roundWind: TileType;
  isRiichi: boolean;
  isDoubleRiichi: boolean;
  isIppatsu: boolean;
  isHoutei: boolean;
  isFuriten: boolean;
  doraCount: number;
  uraDoraCount: number;
  redDoraCount: number;
}): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const {
    playerIndex,
    hand,
    melds,
    discardTile,
    discardPlayerIndex,
    ruleConfig,
    seatWind,
    roundWind,
    isRiichi,
    isDoubleRiichi,
    isIppatsu,
    isHoutei,
    isFuriten,
    doraCount,
    uraDoraCount,
    redDoraCount,
  } = params;

  const handTiles = hand.getTiles();

  // --- ロン ---
  if (!isFuriten) {
    // judgeWin は閉じた手牌 14 枚を前提とするため、ロン牌を追加
    const winCtx: WinContext = {
      handTiles: [...handTiles, discardTile] as Tile[],
      melds,
      winTile: discardTile,
      isTsumo: false,
      seatWind,
      roundWind,
      isRiichi,
      isDoubleRiichi,
      isIppatsu,
      isHaitei: false,
      isHoutei,
      isRinshan: false,
      isChankan: false,
      isTenhou: false,
      isChiihou: false,
      isRenhou: false,
      doraCount,
      uraDoraCount,
      redDoraCount,
      ruleConfig,
    };
    const ronResult = judgeWin(winCtx);
    if (ronResult && checkAtozukeAllowed(winCtx, ronResult)) {
      actions.push({ type: ActionType.Ron, playerIndex });
    }
  }

  // リーチ中は鳴きアクション不可（ロンとスキップのみ）
  if (isRiichi) {
    actions.push({ type: ActionType.Skip, playerIndex });
    return actions;
  }

  // --- 大明槓 ---
  const minkanCandidate = findMinkanCandidate(handTiles as Tile[], discardTile);
  if (minkanCandidate) {
    actions.push({ type: ActionType.Minkan, playerIndex });
  }

  // --- ポン ---
  const ponCandidates = findPonCandidates(handTiles as Tile[], discardTile);
  if (ponCandidates.length > 0) {
    actions.push({ type: ActionType.Pon, playerIndex });
  }

  // --- チー（上家からのみ） ---
  const isKamicha = (discardPlayerIndex + 1) % 4 === playerIndex;
  if (isKamicha) {
    const chiCandidates = findChiCandidates(handTiles as Tile[], discardTile);
    for (const candidate of chiCandidates) {
      actions.push({ type: ActionType.Chi, playerIndex, candidate });
    }
  }

  // スキップは常に可能
  actions.push({ type: ActionType.Skip, playerIndex });

  return actions;
}
