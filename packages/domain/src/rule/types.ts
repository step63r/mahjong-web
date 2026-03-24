import type { RedDoraConfig } from "../tile/index.js";

/**
 * 対局の長さ
 */
export const GameLength = {
  /** 東風（親1周） */
  Tonpu: "tonpu",
  /** 半荘（親2周） */
  Hanchan: "hanchan",
} as const;

export type GameLength = (typeof GameLength)[keyof typeof GameLength];

// ===== 各ルール項目の選択肢型 =====

/** 槓ドラの扱い */
export const KanDoraRule = {
  /** 常に即乗り */
  Immediate: "immediate",
  /** 暗槓時は即乗り、明槓時は打牌後に乗る（デフォルト） */
  AfterDiscard: "after-discard",
  /** 無し */
  None: "none",
} as const;
export type KanDoraRule = (typeof KanDoraRule)[keyof typeof KanDoraRule];

/** 七対子の点数計算方式 */
export const ChiitoitsuCalc = {
  /** 25符2飜（デフォルト） */
  Fu25Han2: "25fu-2han",
  /** 50符1飜 */
  Fu50Han1: "50fu-1han",
} as const;
export type ChiitoitsuCalc = (typeof ChiitoitsuCalc)[keyof typeof ChiitoitsuCalc];

/** 連風牌の雀頭の符数 */
export const DoubleWindFu = {
  /** 2符 */
  Fu2: 2,
  /** 4符（デフォルト） */
  Fu4: 4,
} as const;
export type DoubleWindFu = (typeof DoubleWindFu)[keyof typeof DoubleWindFu];

/** 人和の扱い */
export const RenhouRule = {
  /** 役満（デフォルト） */
  Yakuman: "yakuman",
  /** 倍満 */
  Baiman: "baiman",
  /** 跳満 */
  Haneman: "haneman",
  /** 無し */
  None: "none",
} as const;
export type RenhouRule = (typeof RenhouRule)[keyof typeof RenhouRule];

/** ダブロンの扱い */
export const DoubleRonRule = {
  /** ダブロン有り（デフォルト） */
  Allowed: "allowed",
  /** 頭ハネ */
  Atamahane: "atamahane",
} as const;
export type DoubleRonRule = (typeof DoubleRonRule)[keyof typeof DoubleRonRule];

/** トリロンの扱い */
export const TripleRonRule = {
  /** トリロン有り */
  Allowed: "allowed",
  /** 頭ハネ */
  Atamahane: "atamahane",
  /** 流局（デフォルト） */
  Draw: "draw",
} as const;
export type TripleRonRule = (typeof TripleRonRule)[keyof typeof TripleRonRule];

/** 途中流局時の親の扱い */
export const AbortiveDraw = {
  /** 親の連荘 */
  DealerKeep: "dealer-keep",
  /** 親流れ（デフォルト） */
  DealerRotate: "dealer-rotate",
  /** 流局しない */
  Disabled: "disabled",
} as const;
export type AbortiveDraw = (typeof AbortiveDraw)[keyof typeof AbortiveDraw];

/** 連荘の条件 */
export const RenchanCondition = {
  /** アガリ連荘 */
  WinOnly: "win-only",
  /** 聴牌連荘 */
  Tenpai: "tenpai",
} as const;
export type RenchanCondition = (typeof RenchanCondition)[keyof typeof RenchanCondition];

/** トビの条件 */
export const TobiRule = {
  /** 0点未満でトビ（デフォルト） */
  BelowZero: "below-zero",
  /** 0点以下でトビ */
  ZeroOrBelow: "zero-or-below",
  /** トビ無し */
  Disabled: "disabled",
} as const;
export type TobiRule = (typeof TobiRule)[keyof typeof TobiRule];

/** 順位ウマ */
export const UmaRule = {
  /** 5-10 */
  Uma5_10: "5-10",
  /** 10-20 */
  Uma10_20: "10-20",
  /** 10-30（デフォルト） */
  Uma10_30: "10-30",
  /** 20-30 */
  Uma20_30: "20-30",
} as const;
export type UmaRule = (typeof UmaRule)[keyof typeof UmaRule];

/** 端数計算の方法 */
export const RoundingRule = {
  /** 小数第1位まで計算 */
  OneDecimal: "one-decimal",
  /** 五捨六入（デフォルト） */
  Round5Down6Up: "round-5down-6up",
} as const;
export type RoundingRule = (typeof RoundingRule)[keyof typeof RoundingRule];

// ===== ルール設定全体 =====

/**
 * ルール設定
 *
 * CPU戦ではユーザーが、対人戦ではホストユーザーが設定可能
 */
export interface RuleConfig {
  /** 対局の長さ */
  readonly gameLength: GameLength;

  // --- 役 ---
  /** 喰いタン */
  readonly kuitan: boolean;
  /** 後付け */
  readonly atozuke: boolean;
  /** 一発ツモ */
  readonly ippatsu: boolean;
  /** 流し満貫 */
  readonly nagashiMangan: boolean;
  /** 国士無双の暗槓された牌でのロン */
  readonly kokushiAnkanRon: boolean;
  /** 九蓮宝燈の成立条件（true: 萬子のみ、false: 萬索筒いずれも可） */
  readonly chuurenManzuOnly: boolean;
  /** 發なしでの緑一色 */
  readonly ryuuiisouWithoutHatsu: boolean;

  // --- ドラ ---
  /** 槓ドラ */
  readonly kanDora: KanDoraRule;
  /** 裏ドラ */
  readonly uraDora: boolean;
  /** 槓裏ドラ */
  readonly kanUraDora: boolean;
  /** 赤ドラの設定 */
  readonly redDora: RedDoraConfig;

  // --- アガリ点 ---
  /** 七対子の点数計算 */
  readonly chiitoitsuCalc: ChiitoitsuCalc;
  /** 連風牌の雀頭の符数 */
  readonly doubleWindFu: DoubleWindFu;
  /** 切り上げ満貫 */
  readonly kiriage: boolean;
  /** 人和 */
  readonly renhou: RenhouRule;

  // --- 鳴き/リーチ/アガリ ---
  /** 食い替え（true: 有り、false: 無し） */
  readonly kuikae: boolean;
  /** ダブロン */
  readonly doubleRon: DoubleRonRule;
  /** トリロン */
  readonly tripleRon: TripleRonRule;
  /** 大三元・大四喜・四槓子の責任払い */
  readonly sekininBarai: boolean;

  // --- ゲーム進行 ---
  /** 連荘の条件 */
  readonly renchanCondition: RenchanCondition;
  /** 九種九牌の途中流局 */
  readonly kyuushuKyuuhai: AbortiveDraw;
  /** 四風子連打の途中流局 */
  readonly suufonsuRenda: AbortiveDraw;
  /** 四開槓の途中流局 */
  readonly suukaikan: AbortiveDraw;
  /** 四人リーチの途中流局 */
  readonly suuchaRiichi: AbortiveDraw;
  /** トビの条件 */
  readonly tobi: TobiRule;
  /** オーラスのアガリ止め */
  readonly agariyame: boolean;

  // --- 順位 ---
  /** 順位ウマ */
  readonly uma: UmaRule;
  /** 端数計算 */
  readonly rounding: RoundingRule;

  // --- 持ち点 ---
  /** 初期持ち点 */
  readonly startingPoints: number;
  /** 返し（オカ計算用） */
  readonly returnPoints: number;
}
