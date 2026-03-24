import type { Tile, TileType } from "../tile/index.js";
import type { ChiCandidate } from "../meld/index.js";

// ===== アクションタイプ =====

/**
 * プレイヤーが実行できるアクションの種別
 */
export const ActionType = {
  /** ツモ和了 */
  Tsumo: "tsumo",
  /** ロン和了 */
  Ron: "ron",
  /** リーチ宣言 + 打牌 */
  Riichi: "riichi",
  /** 打牌（手出し or ツモ切り） */
  Discard: "discard",
  /** 暗槓 */
  Ankan: "ankan",
  /** 加槓 */
  Kakan: "kakan",
  /** 大明槓 */
  Minkan: "minkan",
  /** ポン */
  Pon: "pon",
  /** チー */
  Chi: "chi",
  /** 九種九牌（途中流局宣言） */
  KyuushuKyuuhai: "kyuushu-kyuuhai",
  /** アクションをスキップ（鳴きやロンを見送る） */
  Skip: "skip",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

// ===== アクション定義（判別共用体） =====

export interface TsumoAction {
  readonly type: typeof ActionType.Tsumo;
  readonly playerIndex: number;
}

export interface RonAction {
  readonly type: typeof ActionType.Ron;
  readonly playerIndex: number;
}

export interface RiichiAction {
  readonly type: typeof ActionType.Riichi;
  readonly playerIndex: number;
  /** リーチ宣言時に捨てる牌 */
  readonly tile: Tile;
}

export interface DiscardAction {
  readonly type: typeof ActionType.Discard;
  readonly playerIndex: number;
  readonly tile: Tile;
  readonly isTsumogiri: boolean;
}

export interface AnkanAction {
  readonly type: typeof ActionType.Ankan;
  readonly playerIndex: number;
  readonly tileType: TileType;
}

export interface KakanAction {
  readonly type: typeof ActionType.Kakan;
  readonly playerIndex: number;
  readonly tile: Tile;
}

export interface MinkanAction {
  readonly type: typeof ActionType.Minkan;
  readonly playerIndex: number;
}

export interface PonAction {
  readonly type: typeof ActionType.Pon;
  readonly playerIndex: number;
}

export interface ChiAction {
  readonly type: typeof ActionType.Chi;
  readonly playerIndex: number;
  readonly candidate: ChiCandidate;
}

export interface KyuushuKyuuhaiAction {
  readonly type: typeof ActionType.KyuushuKyuuhai;
  readonly playerIndex: number;
}

export interface SkipAction {
  readonly type: typeof ActionType.Skip;
  readonly playerIndex: number;
}

/**
 * プレイヤーが実行できるアクション（判別共用体）
 */
export type PlayerAction =
  | TsumoAction
  | RonAction
  | RiichiAction
  | DiscardAction
  | AnkanAction
  | KakanAction
  | MinkanAction
  | PonAction
  | ChiAction
  | KyuushuKyuuhaiAction
  | SkipAction;
