import {
  type Tile,
  type TileType,
  TileType as TT,
  isSameTile,
  getDoraFromIndicator,
  isWindTile,
  getNumberTileInfo,
} from "../tile/index.js";
import { Hand } from "../hand/index.js";
import { getTenpaiTiles } from "../hand/index.js";
import { Discard } from "../discard/index.js";
import type { Meld } from "../meld/index.js";
import {
  findPonCandidates,
  findMinkanCandidate,
  createChiMeld,
  createPonMeld,
  createMinkanMeld,
  createAnkanMeld,
  createKakanMeld,
} from "../meld/index.js";
import { Wall } from "../wall/index.js";
import type { RuleConfig } from "../rule/index.js";
import { AbortiveDraw, RenchanCondition } from "../rule/index.js";
import type { WinContext } from "../yaku/index.js";
import { judgeWin } from "../yaku/index.js";
import type { ScoreContext } from "../score/index.js";
import { calculateScore } from "../score/index.js";
import type { PlayerAction } from "../action/index.js";
import { ActionType } from "../action/index.js";
import type { RoundState, PlayerState, RoundResult, WinEntry } from "./types.js";
import { RoundPhase, RoundEndReason } from "./types.js";

// ===== 局の作成 =====

const SEAT_WINDS: readonly TileType[] = [TT.Ton, TT.Nan, TT.Sha, TT.Pei];

/**
 * 新しい局を作成する
 */
export function createRound(params: {
  ruleConfig: RuleConfig;
  wall: Wall;
  dealerIndex: number;
  roundWind: TileType;
  honba: number;
  riichiSticks: number;
  playerScores: readonly [number, number, number, number];
}): RoundState {
  const { ruleConfig, wall, dealerIndex, roundWind, honba, riichiSticks, playerScores } = params;

  // 配牌
  const initialHands = wall.dealInitialHands();

  const players = [0, 1, 2, 3].map((i) => {
    const seatIndex = (i - dealerIndex + 4) % 4;
    return {
      hand: new Hand(initialHands[i]),
      melds: [] as Meld[],
      discard: new Discard(),
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      seatWind: SEAT_WINDS[seatIndex],
      riichiTurnIndex: -1,
      isFirstTurn: true,
      score: playerScores[i],
    } satisfies PlayerState;
  }) as unknown as [PlayerState, PlayerState, PlayerState, PlayerState];

  return {
    phase: RoundPhase.NotStarted,
    ruleConfig,
    wall,
    players,
    activePlayerIndex: dealerIndex,
    dealerIndex,
    roundWind,
    honba,
    riichiSticks,
    turnCount: 0,
    lastDiscardTile: undefined,
    lastDiscardPlayerIndex: undefined,
    result: undefined,
    riichiPlayerCount: 0,
    firstTurnDiscardWinds: [],
    totalKanCount: 0,
    playerKanCounts: [0, 0, 0, 0],
    isRinshanDraw: false,
    chankanTile: undefined,
    pendingActions: new Map(),
  };
}

// ===== 局の開始（親のツモ） =====

/**
 * 局を開始する（親が最初のツモを行う）
 */
export function startRound(state: RoundState): RoundState {
  if (state.phase !== RoundPhase.NotStarted) {
    throw new Error(`不正なフェーズです: ${state.phase}`);
  }

  // 親のツモ
  const tile = state.wall.drawTile();
  state.players[state.activePlayerIndex].hand.addTile(tile);
  state.phase = RoundPhase.DrawPhase;
  state.turnCount = 1;

  return state;
}

// ===== アクション適用 =====

/**
 * プレイヤーアクションを局の状態に適用する。
 * 状態を直接変更して返す（immutable ではない）。
 */
export function applyAction(state: RoundState, action: PlayerAction): RoundState {
  switch (action.type) {
    case ActionType.Tsumo:
      return handleTsumo(state, action.playerIndex);
    case ActionType.Ron:
      return handleRon(state, action.playerIndex);
    case ActionType.Riichi:
      return handleRiichi(state, action.playerIndex, action.tile);
    case ActionType.Discard:
      return handleDiscard(state, action.playerIndex, action.tile, action.isTsumogiri);
    case ActionType.Ankan:
      return handleAnkan(state, action.playerIndex, action.tileType);
    case ActionType.Kakan:
      return handleKakan(state, action.playerIndex, action.tile);
    case ActionType.Minkan:
      return handleMinkan(state, action.playerIndex);
    case ActionType.Pon:
      return handlePon(state, action.playerIndex);
    case ActionType.Chi:
      return handleChi(state, action.playerIndex, action.candidate);
    case ActionType.KyuushuKyuuhai:
      return handleKyuushuKyuuhai(state, action.playerIndex);
    case ActionType.Skip:
      return handleSkip(state, action.playerIndex);
    default:
      throw new Error(`未知のアクション: ${(action as PlayerAction).type}`);
  }
}

// ===== 次のプレイヤーのツモを実行 =====

/**
 * 次のプレイヤーのツモを行い、DrawPhase に遷移する。
 * 牌山が尽きた場合は荒牌流局を処理する。
 */
export function advanceToNextDraw(state: RoundState): RoundState {
  // 一巡目フラグの管理
  if (state.activePlayerIndex === (state.dealerIndex + 3) % 4) {
    // 一巡完了
    for (const p of state.players) {
      p.isFirstTurn = false;
    }
  }

  // 次のプレイヤー
  state.activePlayerIndex = (state.activePlayerIndex + 1) % 4;

  // 牌山チェック
  if (state.wall.remainingDrawCount <= 0) {
    return handleExhaustiveDraw(state);
  }

  // ツモ
  const tile = state.wall.drawTile();
  state.players[state.activePlayerIndex].hand.addTile(tile);
  state.phase = RoundPhase.DrawPhase;
  state.isRinshanDraw = false;
  state.turnCount++;

  return state;
}

// ===== 個別アクションハンドラー =====

function handleTsumo(state: RoundState, playerIndex: number): RoundState {
  const player = state.players[playerIndex];
  const handTiles = player.hand.getTiles();
  const drawnTile = handTiles[handTiles.length - 1]; // 最後に追加された牌がツモ牌

  const winCtx = buildWinContext(state, playerIndex, drawnTile, true);
  const judgeResult = judgeWin(winCtx);
  if (!judgeResult) {
    throw new Error("ツモ和了が成立しません");
  }

  const scoreCtx: ScoreContext = {
    judgeResult,
    winContext: winCtx,
    isDealer: playerIndex === state.dealerIndex,
    honba: state.honba,
    riichiSticks: state.riichiSticks,
  };
  const scoreResult = calculateScore(scoreCtx);

  // 得点変動
  const changes: [number, number, number, number] = [0, 0, 0, 0];
  changes[playerIndex] = scoreResult.payment.totalWinnerGain;
  if (playerIndex === state.dealerIndex) {
    // 親ツモ: 各子が支払う
    for (let i = 0; i < 4; i++) {
      if (i !== playerIndex) {
        changes[i] = -scoreResult.payment.tsumoPaymentChild;
      }
    }
  } else {
    // 子ツモ: 親と子で異なる
    for (let i = 0; i < 4; i++) {
      if (i === playerIndex) continue;
      if (i === state.dealerIndex) {
        changes[i] = -scoreResult.payment.tsumoPaymentDealer;
      } else {
        changes[i] = -scoreResult.payment.tsumoPaymentChild;
      }
    }
  }

  const result: RoundResult = {
    reason: RoundEndReason.Win,
    wins: [{ winnerIndex: playerIndex, loserIndex: undefined, scoreResult }],
    scoreChanges: changes,
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: playerIndex === state.dealerIndex,
    incrementHonba: playerIndex === state.dealerIndex,
  };

  applyScoreChanges(state, changes);
  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

function handleRon(state: RoundState, playerIndex: number): RoundState {
  // ロンは pendingActions に蓄積 → resolveAfterDiscard で一括処理
  // ここでは単体ロンを処理
  const discardTile = state.lastDiscardTile;
  const discardPlayer = state.lastDiscardPlayerIndex;
  if (!discardTile || discardPlayer === undefined) {
    throw new Error("ロン対象の捨て牌がありません");
  }

  return processRon(state, [playerIndex], discardTile, discardPlayer);
}

function handleRiichi(state: RoundState, playerIndex: number, tile: Tile): RoundState {
  const player = state.players[playerIndex];

  // ダブルリーチ判定（一巡目）
  if (player.isFirstTurn) {
    player.isDoubleRiichi = true;
  }
  player.isRiichi = true;
  player.isIppatsu = true;
  player.riichiTurnIndex = state.turnCount;

  // リーチ棒の供託（1000点）
  player.score -= 1000;
  state.riichiSticks++;
  state.riichiPlayerCount++;

  // 打牌処理
  return handleDiscard(state, playerIndex, tile, false);
}

function handleDiscard(
  state: RoundState,
  playerIndex: number,
  tile: Tile,
  isTsumogiri: boolean,
): RoundState {
  const player = state.players[playerIndex];

  // 手牌から除去
  player.hand.removeTile(tile);

  // リーチ宣言牌か判定
  const isRiichiDeclare = player.riichiTurnIndex === state.turnCount;

  // 河に追加
  player.discard.addDiscard(tile, isTsumogiri, isRiichiDeclare);

  // 打牌後の状態
  state.lastDiscardTile = tile;
  state.lastDiscardPlayerIndex = playerIndex;
  state.phase = RoundPhase.AfterDiscard;

  // 四風子連打チェック
  if (checkSuufonsuRenda(state, playerIndex, tile)) {
    return state;
  }

  // 四人リーチチェック
  if (checkSuuchaRiichi(state)) {
    return state;
  }

  // 一発の権利を消す（自分以外）
  for (let i = 0; i < 4; i++) {
    if (i !== playerIndex && state.players[i].isIppatsu) {
      // 他家の鳴きで一発が消える処理は鳴きハンドラで行うが、
      // ここでは巡目が進んだプレイヤーの一発を消す
    }
  }

  // isFirstTurn: 鳴きが入らず自分の最初の打牌が完了
  // (一巡目フラグは advanceToNextDraw で全員まとめて消す)

  return state;
}

function handleAnkan(state: RoundState, playerIndex: number, tileType: TileType): RoundState {
  const player = state.players[playerIndex];

  // 手牌から4枚除去
  const tiles = player.hand.removeTilesByType(tileType, 4) as [Tile, Tile, Tile, Tile];
  const meld = createAnkanMeld(tiles);
  player.melds.push(meld);

  state.totalKanCount++;
  state.playerKanCounts[playerIndex]++;

  // 四開槓チェック
  if (checkSuukaikan(state)) {
    return state;
  }

  // 槓ドラ（暗槓は即乗り）
  state.wall.openKanDora();

  // 嶺上牌ツモ
  const rinshanTile = state.wall.drawRinshanTile();
  player.hand.addTile(rinshanTile);
  state.isRinshanDraw = true;
  state.phase = RoundPhase.DrawPhase;

  return state;
}

function handleKakan(state: RoundState, playerIndex: number, tile: Tile): RoundState {
  const player = state.players[playerIndex];

  // 対象のポンを探す
  const ponIndex = player.melds.findIndex((m) => m.type === "pon" && m.tiles[0].type === tile.type);
  if (ponIndex === -1) {
    throw new Error("加槓対象のポンが見つかりません");
  }

  // 手牌から除去
  player.hand.removeTile(tile);

  // ポンを加槓に変換
  const ponMeld = player.melds[ponIndex];
  player.melds[ponIndex] = createKakanMeld(ponMeld, tile);

  state.totalKanCount++;
  state.playerKanCounts[playerIndex]++;

  // 槍槓チェック（他家がロンできる）
  state.chankanTile = tile;
  state.phase = RoundPhase.AfterKan;

  // 四開槓チェック
  if (checkSuukaikan(state)) {
    return state;
  }

  return state;
}

function handleMinkan(state: RoundState, playerIndex: number): RoundState {
  const discardTile = state.lastDiscardTile;
  const discardPlayer = state.lastDiscardPlayerIndex;
  if (!discardTile || discardPlayer === undefined) {
    throw new Error("大明槓対象の捨て牌がありません");
  }

  const player = state.players[playerIndex];
  const handTiles = player.hand.getTiles() as Tile[];
  const candidate = findMinkanCandidate(handTiles, discardTile);
  if (!candidate) {
    throw new Error("大明槓の条件を満たしていません");
  }

  // 手牌から3枚除去
  for (const t of candidate) {
    player.hand.removeTile(t);
  }

  // 捨て牌を鳴かれた状態にする
  state.players[discardPlayer].discard.markLastAsCalled(playerIndex);

  // 副露を追加
  const meld = createMinkanMeld(candidate, discardTile, discardPlayer);
  player.melds.push(meld);

  state.totalKanCount++;
  state.playerKanCounts[playerIndex]++;

  // 全員の一発を消す
  clearAllIppatsu(state);

  // 一巡目フラグを消す（鳴き発生）
  clearAllFirstTurn(state);

  // 四開槓チェック
  if (checkSuukaikan(state)) {
    return state;
  }

  // 槓ドラ（明槓は打牌後に乗る場合あり → ルール依存）
  if (state.ruleConfig.kanDora === "immediate") {
    state.wall.openKanDora();
  }
  // after-discard の場合は嶺上ツモ打牌後に開く → advanceToNextDraw 等で管理

  // 嶺上牌ツモ
  const rinshanTile = state.wall.drawRinshanTile();
  player.hand.addTile(rinshanTile);
  state.isRinshanDraw = true;
  state.activePlayerIndex = playerIndex;
  state.phase = RoundPhase.DrawPhase;

  return state;
}

function handlePon(state: RoundState, playerIndex: number): RoundState {
  const discardTile = state.lastDiscardTile;
  const discardPlayer = state.lastDiscardPlayerIndex;
  if (!discardTile || discardPlayer === undefined) {
    throw new Error("ポン対象の捨て牌がありません");
  }

  const player = state.players[playerIndex];
  const handTiles = player.hand.getTiles() as Tile[];
  const candidates = findPonCandidates(handTiles, discardTile);
  if (candidates.length === 0) {
    throw new Error("ポンの条件を満たしていません");
  }

  // 最初の候補を使用
  const ponTiles = candidates[0];

  // 手牌から2枚除去
  player.hand.removeTile(ponTiles[0]);
  player.hand.removeTile(ponTiles[1]);

  // 捨て牌を鳴かれた状態にする
  state.players[discardPlayer].discard.markLastAsCalled(playerIndex);

  // 副露を追加
  const meld = createPonMeld(ponTiles, discardTile, discardPlayer);
  player.melds.push(meld);

  // 全員の一発を消す
  clearAllIppatsu(state);

  // 一巡目フラグを消す（鳴き発生）
  clearAllFirstTurn(state);

  // アクティブプレイヤーを鳴いたプレイヤーに変更（打牌待ち）
  state.activePlayerIndex = playerIndex;
  state.phase = RoundPhase.DrawPhase;
  // ポン後はツモせず打牌のみ（hand は13枚のまま）
  // → DrawPhase だが手牌14枚ではないので、呼び出し側で打牌のみを提示する

  return state;
}

function handleChi(
  state: RoundState,
  playerIndex: number,
  candidate: import("../meld/index.js").ChiCandidate,
): RoundState {
  const discardTile = state.lastDiscardTile;
  const discardPlayer = state.lastDiscardPlayerIndex;
  if (!discardTile || discardPlayer === undefined) {
    throw new Error("チー対象の捨て牌がありません");
  }

  const player = state.players[playerIndex];

  // 手牌から2枚除去
  for (const t of candidate.tiles) {
    player.hand.removeTile(t);
  }

  // 捨て牌を鳴かれた状態にする
  state.players[discardPlayer].discard.markLastAsCalled(playerIndex);

  // 副露を追加
  const meld = createChiMeld(candidate, discardPlayer);
  player.melds.push(meld);

  // 全員の一発を消す
  clearAllIppatsu(state);

  // 一巡目フラグを消す（鳴き発生）
  clearAllFirstTurn(state);

  // アクティブプレイヤーを鳴いたプレイヤーに変更（打牌待ち）
  state.activePlayerIndex = playerIndex;
  state.phase = RoundPhase.DrawPhase;

  return state;
}

function handleKyuushuKyuuhai(state: RoundState, _playerIndex: number): RoundState {
  const abortRule = state.ruleConfig.kyuushuKyuuhai;
  if (abortRule === AbortiveDraw.Disabled) {
    throw new Error("九種九牌は無効設定です");
  }

  const result: RoundResult = {
    reason: RoundEndReason.KyuushuKyuuhai,
    wins: [],
    scoreChanges: [0, 0, 0, 0],
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: abortRule === AbortiveDraw.DealerKeep,
    incrementHonba: true,
  };

  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

function handleSkip(state: RoundState, _playerIndex: number): RoundState {
  // スキップ — 特に何もせず、 resolveAfterDiscard で処理する
  return state;
}

// ===== ロンの一括処理 =====

function processRon(
  state: RoundState,
  ronPlayerIndices: number[],
  discardTile: Tile,
  discardPlayerIndex: number,
): RoundState {
  const wins: WinEntry[] = [];
  const changes: [number, number, number, number] = [0, 0, 0, 0];

  for (const winnerIndex of ronPlayerIndices) {
    const winCtx = buildWinContext(state, winnerIndex, discardTile, false);

    // 槍槓判定
    if (state.chankanTile && isSameTile(discardTile, state.chankanTile)) {
      (winCtx as { isChankan: boolean }).isChankan = true;
    }

    const judgeResult = judgeWin(winCtx);
    if (!judgeResult) continue;

    const scoreCtx: ScoreContext = {
      judgeResult,
      winContext: winCtx,
      isDealer: winnerIndex === state.dealerIndex,
      honba: state.honba,
      riichiSticks: wins.length === 0 ? state.riichiSticks : 0, // 供託は最初の和了者が取る
    };
    const scoreResult = calculateScore(scoreCtx);

    wins.push({ winnerIndex, loserIndex: discardPlayerIndex, scoreResult });

    changes[winnerIndex] += scoreResult.payment.totalWinnerGain;
    changes[discardPlayerIndex] -= scoreResult.payment.ronLoserPayment;
  }

  if (wins.length === 0) {
    throw new Error("ロン和了が成立しません");
  }

  const dealerWins = wins.some((w) => w.winnerIndex === state.dealerIndex);

  const result: RoundResult = {
    reason: RoundEndReason.Win,
    wins,
    scoreChanges: changes,
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: dealerWins,
    incrementHonba: dealerWins,
  };

  applyScoreChanges(state, changes);
  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

// ===== 打牌後の他家アクション解決 =====

/**
 * AfterDiscard フェーズで全プレイヤーのアクションが出揃った後、
 * 優先度に従ってアクションを解決する。
 *
 * 優先度: ロン > ポン/大明槓 > チー > スキップ
 */
export function resolveAfterDiscard(
  state: RoundState,
  playerActions: Map<number, PlayerAction>,
): RoundState {
  if (state.phase !== RoundPhase.AfterDiscard) {
    throw new Error(`不正なフェーズです: ${state.phase}`);
  }

  const discardTile = state.lastDiscardTile!;
  const discardPlayer = state.lastDiscardPlayerIndex!;

  // ロンの収集
  const ronPlayers: number[] = [];
  for (const [pIdx, action] of playerActions) {
    if (action.type === ActionType.Ron) {
      ronPlayers.push(pIdx);
    }
  }

  // ロン処理
  if (ronPlayers.length > 0) {
    // トリロンチェック
    if (ronPlayers.length >= 3) {
      const tripleRonRule = state.ruleConfig.tripleRon;
      if (tripleRonRule === "draw") {
        // トリロン流局
        return handleTripleRonDraw(state);
      }
      if (tripleRonRule === "atamahane") {
        // 頭ハネ（放銃者の次の席順で最初のプレイヤーのみ）
        const winner = getAtamahaneWinner(ronPlayers, discardPlayer);
        return processRon(state, [winner], discardTile, discardPlayer);
      }
      // allowed: 全員のロンを処理
    }

    // ダブロンチェック
    if (ronPlayers.length === 2) {
      const doubleRonRule = state.ruleConfig.doubleRon;
      if (doubleRonRule === "atamahane") {
        const winner = getAtamahaneWinner(ronPlayers, discardPlayer);
        return processRon(state, [winner], discardTile, discardPlayer);
      }
      // allowed: 両者のロンを処理
    }

    // ロン処理実行（ダブロン/トリロン含む）
    // 席順に並べる（放銃者の次から）
    ronPlayers.sort((a, b) => {
      const orderA = (a - discardPlayer + 4) % 4;
      const orderB = (b - discardPlayer + 4) % 4;
      return orderA - orderB;
    });
    return processRon(state, ronPlayers, discardTile, discardPlayer);
  }

  // ポン/大明槓チェック
  for (const [pIdx, action] of playerActions) {
    if (action.type === ActionType.Pon) {
      return handlePon(state, pIdx);
    }
    if (action.type === ActionType.Minkan) {
      return handleMinkan(state, pIdx);
    }
  }

  // チーチェック
  for (const [pIdx, action] of playerActions) {
    if (action.type === ActionType.Chi && "candidate" in action) {
      return handleChi(state, pIdx, action.candidate);
    }
  }

  // 全員スキップ → 次のプレイヤーのツモへ
  return advanceToNextDraw(state);
}

// ===== 加槓後のロン解決 =====

/**
 * AfterKan フェーズ（加槓後）で他家のロン判定を解決する。
 * ロンがなければ嶺上牌をツモして DrawPhase に遷移する。
 */
export function resolveAfterKan(
  state: RoundState,
  playerActions: Map<number, PlayerAction>,
): RoundState {
  if (state.phase !== RoundPhase.AfterKan) {
    throw new Error(`不正なフェーズです: ${state.phase}`);
  }

  const chankanTile = state.chankanTile;
  if (!chankanTile) {
    throw new Error("槍槓対象の牌がありません");
  }

  // ロンの収集
  const ronPlayers: number[] = [];
  for (const [pIdx, action] of playerActions) {
    if (action.type === ActionType.Ron) {
      ronPlayers.push(pIdx);
    }
  }

  if (ronPlayers.length > 0) {
    // 槍槓によるロン
    const discardPlayer = state.activePlayerIndex;
    ronPlayers.sort((a, b) => {
      const orderA = (a - discardPlayer + 4) % 4;
      const orderB = (b - discardPlayer + 4) % 4;
      return orderA - orderB;
    });
    return processRon(state, ronPlayers, chankanTile, discardPlayer);
  }

  // ロンなし → 槓ドラを開いて嶺上牌ツモ
  state.chankanTile = undefined;

  // 槓ドラ
  const kanDoraRule = state.ruleConfig.kanDora;
  if (kanDoraRule === "immediate" || kanDoraRule === "after-discard") {
    state.wall.openKanDora();
  }

  // 嶺上牌ツモ
  const rinshanTile = state.wall.drawRinshanTile();
  state.players[state.activePlayerIndex].hand.addTile(rinshanTile);
  state.isRinshanDraw = true;
  state.phase = RoundPhase.DrawPhase;

  return state;
}

// ===== 荒牌流局 =====

function handleExhaustiveDraw(state: RoundState): RoundState {
  const tenpaiPlayers: boolean[] = [];
  const changes: [number, number, number, number] = [0, 0, 0, 0];

  // 流し満貫チェック (ルール有効時)
  if (state.ruleConfig.nagashiMangan) {
    const nagashiWinners = checkNagashiMangan(state);
    if (nagashiWinners.length > 0) {
      return handleNagashiMangan(state, nagashiWinners);
    }
  }

  // テンパイ判定
  for (let i = 0; i < 4; i++) {
    const p = state.players[i];
    const closedTypes = p.hand.getTiles().map((t) => t.type);
    const tenpai = getTenpaiTiles(closedTypes, p.melds);
    tenpaiPlayers.push(tenpai.length > 0);
  }

  // ノーテン罰符
  const tenpaiCount = tenpaiPlayers.filter(Boolean).length;
  if (tenpaiCount > 0 && tenpaiCount < 4) {
    const penalty = 3000;
    const tenpaiShare = penalty / tenpaiCount;
    const notenShare = penalty / (4 - tenpaiCount);

    for (let i = 0; i < 4; i++) {
      if (tenpaiPlayers[i]) {
        changes[i] = tenpaiShare;
      } else {
        changes[i] = -notenShare;
      }
    }
  }

  // 連荘判定
  const dealerTenpai = tenpaiPlayers[state.dealerIndex];
  const renchanCondition = state.ruleConfig.renchanCondition;

  let dealerKeeps: boolean;
  if (renchanCondition === RenchanCondition.Tenpai) {
    dealerKeeps = dealerTenpai;
  } else {
    // アガリ連荘の場合、荒牌流局では親は流れる
    dealerKeeps = false;
  }

  const result: RoundResult = {
    reason: RoundEndReason.ExhaustiveDraw,
    wins: [],
    scoreChanges: changes,
    tenpaiPlayers: tenpaiPlayers as unknown as readonly boolean[],
    dealerKeeps,
    incrementHonba: true,
  };

  applyScoreChanges(state, changes);
  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

// ===== 途中流局チェック =====

function checkSuufonsuRenda(state: RoundState, playerIndex: number, tile: Tile): boolean {
  const rule = state.ruleConfig.suufonsuRenda;
  if (rule === AbortiveDraw.Disabled) return false;

  // 最初の巡目か
  if (!state.players[playerIndex].isFirstTurn) return false;

  // 風牌か
  const dummyTile = { type: tile.type, id: 0, isRedDora: false };
  if (!isWindTile(dummyTile)) {
    state.firstTurnDiscardWinds = []; // リセット
    return false;
  }

  state.firstTurnDiscardWinds.push(tile.type);

  // 4人全員が同じ風牌を捨てたか
  if (state.firstTurnDiscardWinds.length === 4) {
    const allSame = state.firstTurnDiscardWinds.every((w) => w === state.firstTurnDiscardWinds[0]);
    if (allSame) {
      const result: RoundResult = {
        reason: RoundEndReason.SuufonsuRenda,
        wins: [],
        scoreChanges: [0, 0, 0, 0],
        tenpaiPlayers: [false, false, false, false],
        dealerKeeps: rule === AbortiveDraw.DealerKeep,
        incrementHonba: true,
      };
      state.result = result;
      state.phase = RoundPhase.Completed;
      return true;
    }
  }

  return false;
}

function checkSuukaikan(state: RoundState): boolean {
  const rule = state.ruleConfig.suukaikan;
  if (rule === AbortiveDraw.Disabled) return false;

  if (state.totalKanCount >= 4) {
    // 同一プレイヤーが4回槓した場合は四槓子の可能性があるため流局しない
    const singlePlayer = state.playerKanCounts.some((c) => c >= 4);
    if (singlePlayer) return false;

    const result: RoundResult = {
      reason: RoundEndReason.Suukaikan,
      wins: [],
      scoreChanges: [0, 0, 0, 0],
      tenpaiPlayers: [false, false, false, false],
      dealerKeeps: rule === AbortiveDraw.DealerKeep,
      incrementHonba: true,
    };
    state.result = result;
    state.phase = RoundPhase.Completed;
    return true;
  }
  return false;
}

function checkSuuchaRiichi(state: RoundState): boolean {
  const rule = state.ruleConfig.suuchaRiichi;
  if (rule === AbortiveDraw.Disabled) return false;

  if (state.riichiPlayerCount >= 4) {
    const result: RoundResult = {
      reason: RoundEndReason.SuuchaRiichi,
      wins: [],
      scoreChanges: [0, 0, 0, 0],
      tenpaiPlayers: [true, true, true, true],
      dealerKeeps: rule === AbortiveDraw.DealerKeep,
      incrementHonba: true,
    };
    state.result = result;
    state.phase = RoundPhase.Completed;
    return true;
  }
  return false;
}

function handleTripleRonDraw(state: RoundState): RoundState {
  const result: RoundResult = {
    reason: RoundEndReason.TripleRonDraw,
    wins: [],
    scoreChanges: [0, 0, 0, 0],
    tenpaiPlayers: [false, false, false, false],
    dealerKeeps: true,
    incrementHonba: true,
  };
  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

// ===== 流し満貫 =====

function checkNagashiMangan(state: RoundState): number[] {
  const winners: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = state.players[i];
    const allDiscards = p.discard.getAllDiscards();
    // 全捨て牌が幺九牌、かつ一枚も鳴かれていない
    const allTerminalOrHonor = allDiscards.every((e) => isTerminalOrHonorType(e.tile.type));
    const noneWasCalled = allDiscards.every((e) => e.calledBy === undefined);
    if (allDiscards.length > 0 && allTerminalOrHonor && noneWasCalled) {
      winners.push(i);
    }
  }
  return winners;
}

function isTerminalOrHonorType(type: TileType): boolean {
  const info = getNumberTileInfo({ type, id: 0, isRedDora: false });
  if (!info) return true; // 字牌
  return info.number === 1 || info.number === 9;
}

function handleNagashiMangan(state: RoundState, winnerIndices: number[]): RoundState {
  const changes: [number, number, number, number] = [0, 0, 0, 0];

  for (const winner of winnerIndices) {
    const isDealer = winner === state.dealerIndex;
    if (isDealer) {
      // 親: 各子 4000点
      for (let i = 0; i < 4; i++) {
        if (i !== winner) {
          changes[i] -= 4000;
          changes[winner] += 4000;
        }
      }
    } else {
      // 子: 親 4000点 + 各子 2000点
      for (let i = 0; i < 4; i++) {
        if (i === winner) continue;
        if (i === state.dealerIndex) {
          changes[i] -= 4000;
          changes[winner] += 4000;
        } else {
          changes[i] -= 2000;
          changes[winner] += 2000;
        }
      }
    }
  }

  const dealerKeeps = winnerIndices.includes(state.dealerIndex);

  const tenpaiPlayers = [false, false, false, false];
  for (const w of winnerIndices) {
    tenpaiPlayers[w] = true;
  }

  const result: RoundResult = {
    reason: RoundEndReason.NagashiMangan,
    wins: [],
    scoreChanges: changes,
    tenpaiPlayers,
    dealerKeeps,
    incrementHonba: true,
  };

  applyScoreChanges(state, changes);
  state.result = result;
  state.phase = RoundPhase.Completed;
  return state;
}

// ===== ユーティリティ =====

function buildWinContext(
  state: RoundState,
  playerIndex: number,
  winTile: Tile,
  isTsumo: boolean,
): WinContext {
  const player = state.players[playerIndex];
  const handTiles = player.hand.getTiles().filter((t) => !isSameTile(t, winTile)) as Tile[];

  // ドラ計算
  const doraIndicators = state.wall.getDoraIndicators();
  const doraTypes = doraIndicators.map((t) => getDoraFromIndicator(t.type));
  const allTiles = [...handTiles, winTile, ...player.melds.flatMap((m) => [...m.tiles])];

  let doraCount = 0;
  for (const t of allTiles) {
    if (doraTypes.includes(t.type)) doraCount++;
  }

  let uraDoraCount = 0;
  if (player.isRiichi && state.ruleConfig.uraDora) {
    const uraIndicators = state.wall.getUraDoraIndicators();
    const uraDoraTypes = uraIndicators.map((t) => getDoraFromIndicator(t.type));
    for (const t of allTiles) {
      if (uraDoraTypes.includes(t.type)) uraDoraCount++;
    }
  }

  let redDoraCount = 0;
  for (const t of allTiles) {
    if (t.isRedDora) redDoraCount++;
  }

  // 天和/地和/人和判定
  const isTenhou =
    isTsumo && player.isFirstTurn && playerIndex === state.dealerIndex && player.melds.length === 0;
  const isChiihou =
    isTsumo && player.isFirstTurn && playerIndex !== state.dealerIndex && player.melds.length === 0;
  const isRenhou =
    !isTsumo &&
    player.isFirstTurn &&
    playerIndex !== state.dealerIndex &&
    player.melds.length === 0;

  return {
    handTiles,
    melds: player.melds,
    winTile,
    isTsumo,
    seatWind: player.seatWind,
    roundWind: state.roundWind,
    isRiichi: player.isRiichi,
    isDoubleRiichi: player.isDoubleRiichi,
    isIppatsu: player.isIppatsu,
    isHaitei: isTsumo && state.wall.remainingDrawCount === 0,
    isHoutei: !isTsumo && state.wall.remainingDrawCount === 0,
    isRinshan: isTsumo && state.isRinshanDraw,
    isChankan: false,
    isTenhou,
    isChiihou,
    isRenhou,
    doraCount,
    uraDoraCount,
    redDoraCount,
    ruleConfig: state.ruleConfig,
  };
}

function applyScoreChanges(
  state: RoundState,
  changes: readonly [number, number, number, number],
): void {
  for (let i = 0; i < 4; i++) {
    state.players[i].score += changes[i];
  }
}

function clearAllIppatsu(state: RoundState): void {
  for (const p of state.players) {
    p.isIppatsu = false;
  }
}

function clearAllFirstTurn(state: RoundState): void {
  for (const p of state.players) {
    p.isFirstTurn = false;
  }
}

function getAtamahaneWinner(ronPlayers: number[], discardPlayer: number): number {
  // 放銃者の次の席順で最も近いプレイヤー
  let winner = ronPlayers[0];
  let minDist = 4;
  for (const p of ronPlayers) {
    const dist = (p - discardPlayer + 4) % 4;
    if (dist < minDist) {
      minDist = dist;
      winner = p;
    }
  }
  return winner;
}

/**
 * フリテン判定
 * 自分の捨て牌に和了牌が含まれているか、
 * または同巡フリテン（他家の捨て牌をロンしなかった場合）をチェックする。
 */
export function isFuriten(state: RoundState, playerIndex: number): boolean {
  const player = state.players[playerIndex];
  const closedTypes = player.hand.getTiles().map((t) => t.type);
  const waitingTypes = getTenpaiTiles(closedTypes, player.melds);

  if (waitingTypes.length === 0) return false;

  // 現物フリテン: 自分の捨て牌に待ち牌がある
  for (const w of waitingTypes) {
    if (player.discard.hasDiscardedType(w)) return true;
  }

  // リーチ後フリテン: リーチ後に他家の捨て牌で和了牌をスルーした場合
  if (player.isRiichi) {
    for (let i = 0; i < 4; i++) {
      if (i === playerIndex) continue;
      const otherDiscards = state.players[i].discard.getAllDiscards();
      for (const entry of otherDiscards) {
        if (waitingTypes.includes(entry.tile.type)) {
          // その牌がリーチ後に捨てられたかチェック（簡易判定: turnCountベース）
          // 厳密な実装は巡目情報が必要だが、ここでは捨て牌の位置とリーチ巡目で判定
          return true;
        }
      }
    }
  }

  return false;
}
