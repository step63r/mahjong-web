import type { Tile, TileType } from "../tile/index.js";
import type { Meld } from "../meld/index.js";
import type { RuleConfig } from "../rule/index.js";

// ===== 役の列挙 =====

/**
 * 麻雀の全役を列挙する定数オブジェクト
 */
export const Yaku = {
  // --- 1飜 ---
  /** リーチ */
  Riichi: "riichi",
  /** 一発 */
  Ippatsu: "ippatsu",
  /** 門前清自摸和 */
  MenzenTsumo: "menzen-tsumo",
  /** 断么九 */
  Tanyao: "tanyao",
  /** 平和 */
  Pinfu: "pinfu",
  /** 一盃口 */
  Iipeiko: "iipeiko",
  /** 役牌 場風 */
  YakuhaiRoundWind: "yakuhai-round-wind",
  /** 役牌 自風 */
  YakuhaiSeatWind: "yakuhai-seat-wind",
  /** 役牌 白 */
  YakuhaiHaku: "yakuhai-haku",
  /** 役牌 發 */
  YakuhaiHatsu: "yakuhai-hatsu",
  /** 役牌 中 */
  YakuhaiChun: "yakuhai-chun",
  /** 海底摸月 */
  Haitei: "haitei",
  /** 河底撈魚 */
  Houtei: "houtei",
  /** 嶺上開花 */
  Rinshan: "rinshan",
  /** 搶槓 */
  Chankan: "chankan",

  // --- 2飜 ---
  /** ダブルリーチ */
  DoubleRiichi: "double-riichi",
  /** 七対子 */
  Chiitoitsu: "chiitoitsu",
  /** 対々和 */
  Toitoi: "toitoi",
  /** 三暗刻 */
  Sanankou: "sanankou",
  /** 三色同刻 */
  SanshokuDoukou: "sanshoku-doukou",
  /** 三色同順 */
  SanshokuDoujun: "sanshoku-doujun",
  /** 一気通貫 */
  Ikkitsuukan: "ikkitsuukan",
  /** 混全帯么九 */
  Chanta: "chanta",
  /** 三槓子 */
  Sankantsu: "sankantsu",
  /** 小三元 */
  Shousangen: "shousangen",
  /** 混老頭 */
  Honroutou: "honroutou",

  // --- 3飜 ---
  /** 二盃口 */
  Ryanpeiko: "ryanpeiko",
  /** 純全帯么九 */
  Junchan: "junchan",
  /** 混一色 */
  Honitsu: "honitsu",

  // --- 6飜 ---
  /** 清一色 */
  Chinitsu: "chinitsu",

  // --- 役満 ---
  /** 天和 */
  Tenhou: "tenhou",
  /** 地和 */
  Chiihou: "chiihou",
  /** 国士無双 */
  Kokushi: "kokushi",
  /** 国士無双十三面待ち */
  KokushiJuusanmen: "kokushi-juusanmen",
  /** 四暗刻 */
  Suuankou: "suuankou",
  /** 四暗刻単騎待ち */
  SuuankouTanki: "suuankou-tanki",
  /** 大三元 */
  Daisangen: "daisangen",
  /** 字一色 */
  Tsuuiisou: "tsuuiisou",
  /** 緑一色 */
  Ryuuiisou: "ryuuiisou",
  /** 小四喜 */
  Shousuushii: "shousuushii",
  /** 大四喜 */
  Daisuushii: "daisuushii",
  /** 清老頭 */
  Chinroutou: "chinroutou",
  /** 九蓮宝燈 */
  ChuurenPoutou: "chuuren-poutou",
  /** 純正九蓮宝燈 */
  JunseiChuuren: "junsei-chuuren",
  /** 四槓子 */
  Suukantsu: "suukantsu",
  /** 人和 */
  Renhou: "renhou",
} as const;

export type Yaku = (typeof Yaku)[keyof typeof Yaku];

// ===== 役判定結果 =====

/**
 * 個別の役の判定結果
 */
export interface YakuResult {
  /** 役 */
  readonly yaku: Yaku;
  /** 飜数 */
  readonly han: number;
  /** 役満かどうか（役満は1, ダブル役満は2） */
  readonly yakumanTimes: number;
}

/**
 * 和了全体の判定結果
 */
export interface JudgeResult {
  /** 成立した役の一覧 */
  readonly yakuList: readonly YakuResult[];
  /** 飜数合計（役満の場合は 0） */
  readonly totalHan: number;
  /** 役満倍数（通常役の場合は 0） */
  readonly totalYakumanTimes: number;
  /** 使用された面子分解（七対子/国士は undefined） */
  readonly parsedHand?: ParsedHand;
}

// ===== 面子分解の型 =====

/**
 * グループの種類
 */
export const GroupType = {
  /** 順子（連番の3枚） */
  Shuntsu: "shuntsu",
  /** 刻子（同種の3枚） */
  Koutsu: "koutsu",
  /** 槓子（同種の4枚） */
  Kantsu: "kantsu",
} as const;

export type GroupType = (typeof GroupType)[keyof typeof GroupType];

/**
 * 面子分解の1グループ
 */
export interface ParsedGroup {
  /** グループの種類 */
  readonly type: GroupType;
  /** グループの構成要素を TileType で表現（シャンツは先頭のみ、コーツ/カンツは代表1つ） */
  readonly tileType: TileType;
  /** 副露由来かどうか */
  readonly isOpen: boolean;
}

/**
 * 4面子1雀頭に分解された結果
 */
export interface ParsedHand {
  /** 4つのグループ（面子） */
  readonly groups: readonly ParsedGroup[];
  /** 雀頭の TileType */
  readonly pair: TileType;
}

// ===== 和了コンテキスト =====

/**
 * 和了時のすべてのコンテキスト情報
 *
 * 役判定にはゲーム状態の多くの情報が必要なため、ひとまとめにする
 */
export interface WinContext {
  /** 閉じた手牌（副露に含まれない牌） */
  readonly handTiles: readonly Tile[];
  /** 副露一覧 */
  readonly melds: readonly Meld[];
  /** 和了牌 */
  readonly winTile: Tile;
  /** ツモ和了かどうか */
  readonly isTsumo: boolean;
  /** 自風（東=Ton, 南=Nan, 西=Sha, 北=Pei） */
  readonly seatWind: TileType;
  /** 場風（東=Ton, 南=Nan, 西=Sha, 北=Pei） */
  readonly roundWind: TileType;

  // --- 状況役フラグ ---
  /** リーチ中 */
  readonly isRiichi: boolean;
  /** ダブルリーチ中 */
  readonly isDoubleRiichi: boolean;
  /** 一発（リーチ後1巡以内に鳴きがなく和了） */
  readonly isIppatsu: boolean;
  /** 海底（牌山最後の牌でのツモ） */
  readonly isHaitei: boolean;
  /** 河底（牌山最後の巡目でのロン） */
  readonly isHoutei: boolean;
  /** 嶺上（槓後の嶺上牌でのツモ） */
  readonly isRinshan: boolean;
  /** 搶槓（他家の加槓をロン） */
  readonly isChankan: boolean;
  /** 天和（親の配牌和了） */
  readonly isTenhou: boolean;
  /** 地和（子の第一ツモ和了） */
  readonly isChiihou: boolean;
  /** 人和（子の第一巡ロン） */
  readonly isRenhou: boolean;

  // --- ドラ ---
  /** ドラ枚数（表ドラ + 槓ドラ） */
  readonly doraCount: number;
  /** 裏ドラ枚数 */
  readonly uraDoraCount: number;
  /** 赤ドラ枚数 */
  readonly redDoraCount: number;

  /** ルール設定 */
  readonly ruleConfig: RuleConfig;
}

/**
 * 門前かどうかを判定するヘルパー
 * 暗槓は門前扱い
 */
export function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((m) => m.type === "ankan");
}
