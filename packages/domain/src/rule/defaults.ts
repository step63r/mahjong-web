import {
  type RuleConfig,
  GameLength,
  KanDoraRule,
  ChiitoitsuCalc,
  DoubleWindFu,
  RenhouRule,
  DoubleRonRule,
  TripleRonRule,
  AbortiveDraw,
  RenchanCondition,
  TobiRule,
  UmaRule,
  RoundingRule,
} from "./types.js";

/**
 * 東風/半荘で異ならない共通のデフォルトルール設定
 */
const COMMON_DEFAULTS = {
  // 役
  kuitan: true,
  atozuke: true,
  ippatsu: true,
  nagashiMangan: true,
  kokushiAnkanRon: true,
  chuurenManzuOnly: false, // 萬子・索子・筒子いずれも可
  ryuuiisouWithoutHatsu: true,

  // ドラ
  kanDora: KanDoraRule.AfterDiscard,
  uraDora: true,
  kanUraDora: true,
  redDora: "two-pinzu" as const,

  // アガリ点
  chiitoitsuCalc: ChiitoitsuCalc.Fu25Han2,
  doubleWindFu: DoubleWindFu.Fu4,
  kiriage: true,
  renhou: RenhouRule.Yakuman,

  // 鳴き/リーチ/アガリ
  kuikae: false,
  doubleRon: DoubleRonRule.Allowed,
  tripleRon: TripleRonRule.Draw,
  sekininBarai: true,

  // ゲーム進行（途中流局）
  kyuushuKyuuhai: AbortiveDraw.DealerKeep,
  suufonsuRenda: AbortiveDraw.DealerRotate,
  suukaikan: AbortiveDraw.DealerRotate,
  suuchaRiichi: AbortiveDraw.Disabled,
  tobi: TobiRule.BelowZero,
  agariyame: false,

  // 順位
  uma: UmaRule.Uma10_30,
  rounding: RoundingRule.Round5Down6Up,

  // 持ち点
  startingPoints: 25000,
  returnPoints: 30000,
} as const;

/**
 * 東風戦のデフォルトルール設定を生成する
 */
export function createTonpuDefaults(): RuleConfig {
  return {
    ...COMMON_DEFAULTS,
    gameLength: GameLength.Tonpu,
    renchanCondition: RenchanCondition.WinOnly,
  };
}

/**
 * 半荘戦のデフォルトルール設定を生成する
 */
export function createHanchanDefaults(): RuleConfig {
  return {
    ...COMMON_DEFAULTS,
    gameLength: GameLength.Hanchan,
    renchanCondition: RenchanCondition.Tenpai,
  };
}

/**
 * 対局の長さに応じたデフォルトルール設定を生成する
 */
export function createDefaultRuleConfig(gameLength: GameLength = GameLength.Hanchan): RuleConfig {
  return gameLength === GameLength.Tonpu ? createTonpuDefaults() : createHanchanDefaults();
}
