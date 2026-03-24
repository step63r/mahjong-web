import { describe, it, expect } from "vitest";
import {
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
import { createTonpuDefaults, createHanchanDefaults, createDefaultRuleConfig } from "./defaults.js";

describe("createTonpuDefaults", () => {
  const rule = createTonpuDefaults();

  it("対局の長さが東風", () => {
    expect(rule.gameLength).toBe(GameLength.Tonpu);
  });

  it("連荘条件がアガリ連荘", () => {
    expect(rule.renchanCondition).toBe(RenchanCondition.WinOnly);
  });

  // 共通デフォルト値
  it("喰いタンが有効", () => expect(rule.kuitan).toBe(true));
  it("後付けが有効", () => expect(rule.atozuke).toBe(true));
  it("一発が有効", () => expect(rule.ippatsu).toBe(true));
  it("流し満貫が有効", () => expect(rule.nagashiMangan).toBe(true));
  it("国士暗槓ロンが有効", () => expect(rule.kokushiAnkanRon).toBe(true));
  it("九蓮宝燈は萬索筒いずれも可", () => expect(rule.chuurenManzuOnly).toBe(false));
  it("發なし緑一色が有効", () => expect(rule.ryuuiisouWithoutHatsu).toBe(true));

  it("槓ドラが暗槓即乗り/明槓打牌後", () => expect(rule.kanDora).toBe(KanDoraRule.AfterDiscard));
  it("裏ドラが有効", () => expect(rule.uraDora).toBe(true));
  it("槓裏ドラが有効", () => expect(rule.kanUraDora).toBe(true));
  it("赤ドラが two-pinzu", () => expect(rule.redDora).toBe("two-pinzu"));

  it("七対子が25符2飜", () => expect(rule.chiitoitsuCalc).toBe(ChiitoitsuCalc.Fu25Han2));
  it("連風牌雀頭が4符", () => expect(rule.doubleWindFu).toBe(DoubleWindFu.Fu4));
  it("切り上げ満貫が有効", () => expect(rule.kiriage).toBe(true));
  it("人和が役満", () => expect(rule.renhou).toBe(RenhouRule.Yakuman));

  it("食い替えが無し", () => expect(rule.kuikae).toBe(false));
  it("ダブロンが有効", () => expect(rule.doubleRon).toBe(DoubleRonRule.Allowed));
  it("トリロンが流局", () => expect(rule.tripleRon).toBe(TripleRonRule.Draw));
  it("責任払いが有効", () => expect(rule.sekininBarai).toBe(true));

  it("九種九牌が親の連荘", () => expect(rule.kyuushuKyuuhai).toBe(AbortiveDraw.DealerKeep));
  it("四風子連打が親流れ", () => expect(rule.suufonsuRenda).toBe(AbortiveDraw.DealerRotate));
  it("四開槓が親流れ", () => expect(rule.suukaikan).toBe(AbortiveDraw.DealerRotate));
  it("四人リーチが流局しない", () => expect(rule.suuchaRiichi).toBe(AbortiveDraw.Disabled));
  it("トビが0点未満", () => expect(rule.tobi).toBe(TobiRule.BelowZero));
  it("アガリ止めが無し", () => expect(rule.agariyame).toBe(false));

  it("ウマが10-30", () => expect(rule.uma).toBe(UmaRule.Uma10_30));
  it("端数計算が五捨六入", () => expect(rule.rounding).toBe(RoundingRule.Round5Down6Up));

  it("初期持ち点が25000", () => expect(rule.startingPoints).toBe(25000));
  it("返しが30000", () => expect(rule.returnPoints).toBe(30000));
});

describe("createHanchanDefaults", () => {
  const rule = createHanchanDefaults();

  it("対局の長さが半荘", () => {
    expect(rule.gameLength).toBe(GameLength.Hanchan);
  });

  it("連荘条件が聴牌連荘", () => {
    expect(rule.renchanCondition).toBe(RenchanCondition.Tenpai);
  });
});

describe("createDefaultRuleConfig", () => {
  it("引数なしで半荘デフォルト", () => {
    const rule = createDefaultRuleConfig();
    expect(rule.gameLength).toBe(GameLength.Hanchan);
  });

  it("東風を指定すると東風デフォルト", () => {
    const rule = createDefaultRuleConfig(GameLength.Tonpu);
    expect(rule.gameLength).toBe(GameLength.Tonpu);
    expect(rule.renchanCondition).toBe(RenchanCondition.WinOnly);
  });

  it("半荘を指定すると半荘デフォルト", () => {
    const rule = createDefaultRuleConfig(GameLength.Hanchan);
    expect(rule.gameLength).toBe(GameLength.Hanchan);
    expect(rule.renchanCondition).toBe(RenchanCondition.Tenpai);
  });
});
