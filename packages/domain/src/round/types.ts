import type { Tile, TileType } from "../tile/index.js";
import type { Hand } from "../hand/index.js";
import type { Meld } from "../meld/index.js";
import type { Discard } from "../discard/index.js";
import type { Wall } from "../wall/index.js";
import type { RuleConfig } from "../rule/index.js";
import type { ScoreResult } from "../score/index.js";
import type { PlayerAction } from "../action/index.js";

// ===== 局のフェーズ =====

/**
 * 局のステートマシンにおける現在のフェーズ
 */
export const RoundPhase = {
  /** 未開始（初期状態） */
  NotStarted: "not-started",
  /** プレイヤーがツモしてアクションを選択中 */
  DrawPhase: "draw-phase",
  /** プレイヤーが打牌した直後、他家のアクション待ち */
  AfterDiscard: "after-discard",
  /** 槓の後（嶺上牌をツモ前、他家のロン判定後） */
  AfterKan: "after-kan",
  /** 局が終了 */
  Completed: "completed",
} as const;

export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

// ===== 局終了の理由 =====

export const RoundEndReason = {
  /** 和了（ツモ/ロン） */
  Win: "win",
  /** 荒牌流局（牌山が尽きた） */
  ExhaustiveDraw: "exhaustive-draw",
  /** 九種九牌 */
  KyuushuKyuuhai: "kyuushu-kyuuhai",
  /** 四風子連打 */
  SuufonsuRenda: "suufonsu-renda",
  /** 四開槓 */
  Suukaikan: "suukaikan",
  /** 四人リーチ */
  SuuchaRiichi: "suucha-riichi",
  /** トリロン流局 */
  TripleRonDraw: "triple-ron-draw",
  /** 流し満貫 */
  NagashiMangan: "nagashi-mangan",
} as const;

export type RoundEndReason = (typeof RoundEndReason)[keyof typeof RoundEndReason];

// ===== プレイヤーの局内状態 =====

export interface PlayerState {
  /** 手牌 */
  readonly hand: Hand;
  /** 副露一覧 */
  readonly melds: Meld[];
  /** 河 */
  readonly discard: Discard;
  /** リーチ中か */
  isRiichi: boolean;
  /** ダブルリーチか */
  isDoubleRiichi: boolean;
  /** 一発の権利があるか */
  isIppatsu: boolean;
  /** 現在の自風 */
  readonly seatWind: TileType;
  /** リーチ宣言した巡目（フリテンチェック用） */
  riichiTurnIndex: number;
  /** 一巡目フラグ（九種九牌や天和/地和/人和に使用） */
  isFirstTurn: boolean;
  /** このプレイヤーの得点 */
  score: number;
}

// ===== 和了情報 =====

export interface WinEntry {
  /** 和了したプレイヤー */
  readonly winnerIndex: number;
  /** 放銃したプレイヤー（ツモの場合は undefined） */
  readonly loserIndex: number | undefined;
  /** 点数計算結果 */
  readonly scoreResult: ScoreResult;
}

// ===== 局の結果 =====

export interface RoundResult {
  /** 局終了の理由 */
  readonly reason: RoundEndReason;
  /** 和了情報（複数和了の場合は複数） */
  readonly wins: readonly WinEntry[];
  /** 各プレイヤーの得点変動 */
  readonly scoreChanges: readonly [number, number, number, number];
  /** テンパイしていたプレイヤー（荒牌流局時） */
  readonly tenpaiPlayers: readonly boolean[];
  /** 連荘になるかどうか */
  readonly dealerKeeps: boolean;
  /** 本場が増えるかどうか */
  readonly incrementHonba: boolean;
}

// ===== 局の全体状態 =====

export interface RoundState {
  /** 現在のフェーズ */
  phase: RoundPhase;
  /** ルール設定 */
  readonly ruleConfig: RuleConfig;
  /** 牌山 */
  readonly wall: Wall;
  /** 4人のプレイヤー状態 */
  readonly players: readonly [PlayerState, PlayerState, PlayerState, PlayerState];
  /** 現在のアクティブプレイヤー（ツモ/打牌するプレイヤー） */
  activePlayerIndex: number;
  /** 親のインデックス（0-3） */
  readonly dealerIndex: number;
  /** 場風 */
  readonly roundWind: TileType;
  /** 本場数 */
  readonly honba: number;
  /** 供託リーチ棒の数 */
  riichiSticks: number;
  /** 現在の巡目 */
  turnCount: number;
  /** 直前に捨てられた牌（他家のアクション判定用） */
  lastDiscardTile: Tile | undefined;
  /** 直前に捨てた牌のプレイヤー（他家のアクション判定用） */
  lastDiscardPlayerIndex: number | undefined;
  /** 局の結果（completedフェーズでのみ設定） */
  result: RoundResult | undefined;
  /** リーチ者の数 */
  riichiPlayerCount: number;
  /** 最初の巡で捨てられた風牌（四風子連打判定用） */
  firstTurnDiscardWinds: TileType[];
  /** 場に出ている槓の総数 */
  totalKanCount: number;
  /** 各プレイヤーの槓の数 */
  playerKanCounts: [number, number, number, number];
  /** 嶺上ツモフラグ */
  isRinshanDraw: boolean;
  /** 槓後のロン対象の牌（槍槓） */
  chankanTile: Tile | undefined;
  /** 各プレイヤーの待ちアクション */
  pendingActions: Map<number, PlayerAction[]>;
}
