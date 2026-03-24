import type { TileType, Tile } from "../tile/index.js";
import { ALL_TILE_TYPES, isTerminalOrHonor, isWindTile, isDragonTile } from "../tile/index.js";
import type { Meld } from "../meld/index.js";
import type { PlayerAction } from "../action/index.js";
import { ActionType } from "../action/index.js";
import { getActionsAfterDraw, getActionsAfterDiscard } from "../action/action.js";
import type { RoundState } from "../round/index.js";
import { RoundPhase } from "../round/index.js";
import {
  startRound,
  applyAction,
  resolveAfterDiscard,
  resolveAfterKan,
  isFuriten,
} from "../round/round.js";
import { calculateShanten, calculateShantenForEachDiscard } from "../hand/shanten.js";
import { getTenpaiTiles } from "../hand/tenpai.js";
import type { AiPlayer } from "./types.js";

// ===== 基本AI実装 =====

/**
 * 基本的なCPU思考ロジックを持つAIプレイヤー。
 *
 * 戦略:
 * 1. 和了可能なら常に和了する（ツモ/ロン）
 * 2. リーチ可能ならリーチする
 * 3. 打牌は向聴数を基準に選択（同じ向聴数なら受け入れ枚数で判断）
 * 4. 他家リーチ時、自分のテンパイが遠ければベタオリ
 * 5. 鳴きは1向聴以下の場合のみ検討
 */
export class BasicAiPlayer implements AiPlayer {
  chooseAction(
    actions: readonly PlayerAction[],
    state: RoundState,
    playerIndex: number,
  ): PlayerAction {
    if (actions.length === 0) {
      throw new Error("選択可能なアクションがありません");
    }
    if (actions.length === 1) {
      return actions[0];
    }

    // 1. ツモ和了 → 常に和了する
    const tsumo = actions.find((a) => a.type === ActionType.Tsumo);
    if (tsumo) return tsumo;

    // 2. ロン和了 → 常に和了する
    const ron = actions.find((a) => a.type === ActionType.Ron);
    if (ron) return ron;

    // 3. 九種九牌 → 宣言する
    const kyuushu = actions.find((a) => a.type === ActionType.KyuushuKyuuhai);
    if (kyuushu) return kyuushu;

    const player = state.players[playerIndex];
    const closedTypes = player.hand.getTiles().map((t) => t.type);
    const melds = player.melds;

    // 他家のリーチ状態をチェック
    const anyoneRiichi = state.players.some((p, i) => i !== playerIndex && p.isRiichi);
    const myShanten = calculateShanten(closedTypes, melds.length);

    // DrawPhase のアクション（打牌系）
    const hasDiscard = actions.some(
      (a) => a.type === ActionType.Discard || a.type === ActionType.Riichi,
    );

    if (hasDiscard) {
      return chooseDrawAction(
        actions,
        state,
        playerIndex,
        closedTypes,
        melds,
        myShanten,
        anyoneRiichi,
      );
    }

    // AfterDiscard のアクション（鳴き系）
    return chooseCallAction(actions, state, playerIndex, closedTypes, melds, myShanten);
  }
}

// ===== DrawPhase: 打牌選択 =====

function chooseDrawAction(
  actions: readonly PlayerAction[],
  state: RoundState,
  playerIndex: number,
  closedTypes: TileType[],
  melds: readonly Meld[],
  myShanten: number,
  anyoneRiichi: boolean,
): PlayerAction {
  // リーチ可能ならリーチする（テンパイ状態）
  const riichiActions = actions.filter((a) => a.type === ActionType.Riichi);
  if (riichiActions.length > 0) {
    // 最適なリーチ宣言牌を選択（待ちが多い牌で切る）
    return chooseBestRiichi(riichiActions, closedTypes, melds);
  }

  // 暗槓: テンパイ維持ならする（リーチ中含む）
  const ankanActions = actions.filter((a) => a.type === ActionType.Ankan);
  for (const ankan of ankanActions) {
    if (ankan.type === ActionType.Ankan) {
      // 暗槓後に向聴数が悪化しないなら実行
      const afterTypes = closedTypes.filter((t) => t !== ankan.tileType);
      const afterMelds = melds.length + 1;
      const afterSh = calculateShanten(afterTypes, afterMelds);
      if (afterSh <= myShanten) {
        return ankan;
      }
    }
  }

  // 加槓: テンパイ維持ならする
  const kakanActions = actions.filter((a) => a.type === ActionType.Kakan);
  for (const kakan of kakanActions) {
    if (kakan.type === ActionType.Kakan) {
      const afterTypes = closedTypes.filter((t) => t !== kakan.tile.type);
      // 加槓は meldCount は変わらない（ポン→加槓）
      const afterSh = calculateShanten(afterTypes, melds.length);
      if (afterSh <= myShanten) {
        return kakan;
      }
    }
  }

  // 打牌選択
  const discardActions = actions.filter((a) => a.type === ActionType.Discard);
  if (discardActions.length === 0) {
    return actions[0]; // フォールバック
  }

  // ベタオリ: 他家リーチ中 かつ 自分が2向聴以上 → 安全牌を優先
  if (anyoneRiichi && myShanten >= 2) {
    return chooseSafeDiscard(discardActions, state, playerIndex);
  }

  // 攻め: 向聴数が最も低くなる牌を選ぶ
  return chooseBestDiscard(discardActions, closedTypes, melds);
}

// ===== リーチ宣言牌の選択 =====

function chooseBestRiichi(
  riichiActions: readonly PlayerAction[],
  closedTypes: TileType[],
  melds: readonly Meld[],
): PlayerAction {
  if (riichiActions.length === 1) return riichiActions[0];

  let bestAction = riichiActions[0];
  let bestWaitCount = 0;

  for (const action of riichiActions) {
    if (action.type !== ActionType.Riichi) continue;
    // getTenpaiTiles で待ち牌数をカウント
    const remaining13 = removeOne(closedTypes, action.tile.type);
    const waitTiles = getTenpaiTiles(remaining13, melds);
    if (waitTiles.length > bestWaitCount) {
      bestWaitCount = waitTiles.length;
      bestAction = action;
    }
  }

  return bestAction;
}

// ===== 攻め: 最適打牌選択 =====

function chooseBestDiscard(
  discardActions: readonly PlayerAction[],
  closedTypes: TileType[],
  melds: readonly Meld[],
): PlayerAction {
  if (discardActions.length === 1) return discardActions[0];

  const shantenMap = calculateShantenForEachDiscard(closedTypes, melds.length);

  let bestAction = discardActions[0];
  let bestShanten = Infinity;
  let bestAcceptance = -1;

  for (const action of discardActions) {
    if (action.type !== ActionType.Discard) continue;
    const sh = shantenMap.get(action.tile.type) ?? Infinity;

    if (sh < bestShanten) {
      bestShanten = sh;
      bestAcceptance = -1; // リセット
      bestAction = action;
    } else if (sh === bestShanten) {
      // 同じ向聴数なら受け入れ枚数で比較（遅延計算）
      if (bestAcceptance < 0) {
        bestAcceptance = countAcceptance(
          closedTypes,
          melds,
          (bestAction as { tile: Tile }).tile.type,
        );
      }
      const acceptance = countAcceptance(closedTypes, melds, action.tile.type);
      if (acceptance > bestAcceptance) {
        bestAcceptance = acceptance;
        bestAction = action;
      } else if (acceptance === bestAcceptance) {
        // 受け入れも同じなら幺九牌・字牌を優先的に切る
        if (isLessValuable(action.tile, (bestAction as { tile: Tile }).tile)) {
          bestAction = action;
        }
      }
    }
  }

  return bestAction;
}

/**
 * 特定の牌を切った後の受け入れ枚数（有効牌の種類数）を計算
 */
function countAcceptance(
  closedTypes: TileType[],
  melds: readonly Meld[],
  discardType: TileType,
): number {
  const remaining = removeOne(closedTypes, discardType);
  const baseSh = calculateShanten(remaining, melds.length);
  const meldTileTypes = melds.flatMap((m) => m.tiles.map((t) => t.type));

  let count = 0;

  for (const candidate of ALL_TILE_TYPES) {
    const used =
      remaining.filter((tt) => tt === candidate).length +
      meldTileTypes.filter((tt) => tt === candidate).length;
    if (used >= 4) continue;

    const testHand = [...remaining, candidate];
    const newSh = calculateShanten(testHand, melds.length);
    if (newSh < baseSh) count++;
  }

  return count;
}

// ===== ベタオリ: 安全牌選択 =====

function chooseSafeDiscard(
  discardActions: readonly PlayerAction[],
  state: RoundState,
  playerIndex: number,
): PlayerAction {
  // リーチ者の河にある牌（現物）を収集
  const safeTileTypes = new Set<TileType>();
  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;
    if (!state.players[i].isRiichi) continue;
    for (const entry of state.players[i].discard.getAllDiscards()) {
      safeTileTypes.add(entry.tile.type);
    }
  }

  // 全プレイヤーの河にある牌（比較的安全）
  const allDiscardedTypes = new Set<TileType>();
  for (let i = 0; i < 4; i++) {
    for (const entry of state.players[i].discard.getAllDiscards()) {
      allDiscardedTypes.add(entry.tile.type);
    }
  }

  // 壁牌チェック（見えている枚数が多い牌は安全）
  const visibleCounts = new Map<TileType, number>();
  for (let i = 0; i < 4; i++) {
    for (const entry of state.players[i].discard.getAllDiscards()) {
      visibleCounts.set(entry.tile.type, (visibleCounts.get(entry.tile.type) ?? 0) + 1);
    }
    for (const meld of state.players[i].melds) {
      for (const t of meld.tiles) {
        visibleCounts.set(t.type, (visibleCounts.get(t.type) ?? 0) + 1);
      }
    }
  }

  // 安全度スコア計算
  let bestAction = discardActions[0];
  let bestSafety = -Infinity;

  for (const action of discardActions) {
    if (action.type !== ActionType.Discard) continue;
    const tType = action.tile.type;
    let safety = 0;

    // 現物 → 最高の安全度
    if (safeTileTypes.has(tType)) {
      safety += 100;
    }

    // 場に3枚見えている → 壁（ほぼ安全）
    const visible = visibleCounts.get(tType) ?? 0;
    safety += visible * 10;

    // 字牌は比較的安全（ただし役牌は危険な場合もあるがシンプルに）
    const dummyTile = { type: tType, id: 0, isRedDora: false };
    if (isTerminalOrHonor(dummyTile)) {
      safety += 5;
    }

    // 全員の河に出ている牌は中程度に安全
    if (allDiscardedTypes.has(tType)) {
      safety += 3;
    }

    if (safety > bestSafety) {
      bestSafety = safety;
      bestAction = action;
    }
  }

  return bestAction;
}

// ===== AfterDiscard: 鳴き判断 =====

function chooseCallAction(
  actions: readonly PlayerAction[],
  _state: RoundState,
  _playerIndex: number,
  closedTypes: TileType[],
  melds: readonly Meld[],
  myShanten: number,
): PlayerAction {
  // ロン → 既に上で処理済みだがフォールバック
  const ron = actions.find((a) => a.type === ActionType.Ron);
  if (ron) return ron;

  // 鳴き判断: 1向聴以下の場合のみ検討
  if (myShanten <= 1) {
    // ポン
    const pon = actions.find((a) => a.type === ActionType.Pon);
    if (pon && shouldCall(closedTypes, melds, myShanten, "pon")) {
      return pon;
    }

    // チー
    const chiActions = actions.filter((a) => a.type === ActionType.Chi);
    if (chiActions.length > 0 && shouldCall(closedTypes, melds, myShanten, "chi")) {
      return chiActions[0];
    }

    // 大明槓
    const minkan = actions.find((a) => a.type === ActionType.Minkan);
    if (minkan && shouldCall(closedTypes, melds, myShanten, "minkan")) {
      return minkan;
    }
  }

  // スキップ
  const skip = actions.find((a) => a.type === ActionType.Skip);
  return skip ?? actions[actions.length - 1];
}

/**
 * 鳴くべきかどうかの判断
 * - テンパイ（0向聴）なら鳴いて和了に近づくなら鳴く
 * - 1向聴なら鳴いて向聴数が下がるなら鳴く
 * - 門前を崩すデメリット（リーチ不可）を勘案
 */
function shouldCall(
  _closedTypes: TileType[],
  melds: readonly Meld[],
  myShanten: number,
  _callType: string,
): boolean {
  // 既に副露している場合は門前崩しのデメリットなし
  const isMenzen = melds.every((m) => m.type === "ankan");

  // テンパイ時: 鳴いて和了できる可能性が高いので鳴く
  if (myShanten === 0) return true;

  // 1向聴で既に鳴いている場合: 鳴いてテンパイに近づくなら鳴く
  if (myShanten === 1 && !isMenzen) return true;

  // 門前の場合: 1向聴でも基本的に門前を保つ（リーチの価値が高い）
  return false;
}

// ===== ユーティリティ =====

/** 配列から指定TileTypeの最初の1枚を除去したコピーを返す */
function removeOne(types: readonly TileType[], target: TileType): TileType[] {
  const result = [...types];
  const idx = result.indexOf(target);
  if (idx >= 0) result.splice(idx, 1);
  return result;
}

/** 牌Aが牌Bより「切りやすい」（価値が低い）か */
function isLessValuable(a: Tile, b: Tile): boolean {
  const dA = { type: a.type, id: 0, isRedDora: false };
  const dB = { type: b.type, id: 0, isRedDora: false };

  // 字牌 > 1,9 > 2,8 > ... > 5 の順で切りやすい
  const aIsHonor = isWindTile(dA) || isDragonTile(dA);
  const bIsHonor = isWindTile(dB) || isDragonTile(dB);
  if (aIsHonor && !bIsHonor) return true;
  if (!aIsHonor && bIsHonor) return false;

  const aIsTerminal = isTerminalOrHonor(dA) && !aIsHonor;
  const bIsTerminal = isTerminalOrHonor(dB) && !bIsHonor;
  if (aIsTerminal && !bIsTerminal) return true;
  if (!aIsTerminal && bIsTerminal) return false;

  return false;
}

/**
 * AI が1局をプレイするためのゲームループヘルパー。
 * 4人のAIプレイヤーで1局を最初から最後まで自動進行する。
 */
export function playRoundWithAi(
  state: RoundState,
  aiPlayers: readonly [AiPlayer, AiPlayer, AiPlayer, AiPlayer],
): RoundState {
  // 局開始
  if (state.phase === "not-started") {
    startRound(state);
  }

  let iteration = 0;
  const MAX_ITERATIONS = 1000; // 無限ループ防止

  while (state.phase !== RoundPhase.Completed && iteration < MAX_ITERATIONS) {
    iteration++;

    if (state.phase === RoundPhase.DrawPhase) {
      const pIdx = state.activePlayerIndex;
      const player = state.players[pIdx];
      const handTiles = player.hand.getTiles();
      const drawnTile = handTiles[handTiles.length - 1];

      const actions = getActionsAfterDraw({
        playerIndex: pIdx,
        hand: player.hand,
        melds: player.melds,
        drawnTile,
        ruleConfig: state.ruleConfig,
        seatWind: player.seatWind,
        roundWind: state.roundWind,
        isFirstDraw: player.isFirstTurn,
        isRiichi: player.isRiichi,
        isDoubleRiichi: player.isDoubleRiichi,
        isIppatsu: player.isIppatsu,
        isHaitei: state.wall.remainingDrawCount === 0,
        doraCount: 0,
        uraDoraCount: 0,
        redDoraCount: 0,
        canKyuushuKyuuhai: player.isFirstTurn && pIdx === state.activePlayerIndex,
      });

      if (actions.length === 0) {
        throw new Error(`DrawPhase でアクションがありません (player ${pIdx})`);
      }

      const chosen = aiPlayers[pIdx].chooseAction(actions, state, pIdx);
      applyAction(state, chosen);
    } else if (state.phase === RoundPhase.AfterDiscard) {
      const discardPlayer = state.lastDiscardPlayerIndex!;
      const discardTile = state.lastDiscardTile!;
      const playerActions = new Map<number, PlayerAction>();

      for (let i = 0; i < 4; i++) {
        if (i === discardPlayer) continue;
        const player = state.players[i];

        const actions = getActionsAfterDiscard({
          playerIndex: i,
          hand: player.hand,
          melds: player.melds,
          discardTile,
          discardPlayerIndex: discardPlayer,
          ruleConfig: state.ruleConfig,
          seatWind: player.seatWind,
          roundWind: state.roundWind,
          isRiichi: player.isRiichi,
          isDoubleRiichi: player.isDoubleRiichi,
          isIppatsu: player.isIppatsu,
          isHoutei: state.wall.remainingDrawCount === 0,
          isFuriten: isFuriten(state, i),
          doraCount: 0,
          uraDoraCount: 0,
          redDoraCount: 0,
        });

        if (actions.length === 0) {
          playerActions.set(i, { type: ActionType.Skip, playerIndex: i });
        } else {
          const chosen = aiPlayers[i].chooseAction(actions, state, i);
          playerActions.set(i, chosen);
        }
      }

      resolveAfterDiscard(state, playerActions);
    } else if (state.phase === RoundPhase.AfterKan) {
      const kanPlayer = state.activePlayerIndex;
      const chankanTile = state.chankanTile;
      const playerActions = new Map<number, PlayerAction>();

      if (chankanTile) {
        for (let i = 0; i < 4; i++) {
          if (i === kanPlayer) continue;
          const player = state.players[i];

          const actions = getActionsAfterDiscard({
            playerIndex: i,
            hand: player.hand,
            melds: player.melds,
            discardTile: chankanTile,
            discardPlayerIndex: kanPlayer,
            ruleConfig: state.ruleConfig,
            seatWind: player.seatWind,
            roundWind: state.roundWind,
            isRiichi: player.isRiichi,
            isDoubleRiichi: player.isDoubleRiichi,
            isIppatsu: player.isIppatsu,
            isHoutei: false,
            isFuriten: isFuriten(state, i),
            doraCount: 0,
            uraDoraCount: 0,
            redDoraCount: 0,
          });

          const ronOrSkip = actions.filter(
            (a) => a.type === ActionType.Ron || a.type === ActionType.Skip,
          );
          if (ronOrSkip.length > 0) {
            const chosen = aiPlayers[i].chooseAction(ronOrSkip, state, i);
            playerActions.set(i, chosen);
          } else {
            playerActions.set(i, { type: ActionType.Skip, playerIndex: i });
          }
        }
      }

      resolveAfterKan(state, playerActions);
    }
  }

  if (iteration >= MAX_ITERATIONS) {
    throw new Error("局の進行が最大反復回数を超えました（無限ループの可能性）");
  }

  return state;
}
