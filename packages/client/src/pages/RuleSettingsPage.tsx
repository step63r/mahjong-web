import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { RuleConfig } from "@mahjong-web/domain";
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
  createDefaultRuleConfig,
} from "@mahjong-web/domain";

// ===== 汎用 UI コンポーネント =====

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-emerald-200 text-sm font-bold border-b border-emerald-600 pb-1">{title}</h3>;
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-emerald-100 text-sm">{label}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(true)}
          className={`px-3 py-1 text-xs rounded-l-md font-bold transition-colors ${
            value ? "bg-amber-600 text-white" : "bg-emerald-700 text-emerald-400 hover:bg-emerald-600"
          }`}
        >
          有り
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-3 py-1 text-xs rounded-r-md font-bold transition-colors ${
            !value ? "bg-amber-600 text-white" : "bg-emerald-700 text-emerald-400 hover:bg-emerald-600"
          }`}
        >
          無し
        </button>
      </div>
    </div>
  );
}

function SelectRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 gap-2">
      <span className="text-emerald-100 text-sm shrink-0">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
        className="bg-emerald-700 text-emerald-100 text-xs rounded-md px-2 py-1 border border-emerald-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ===== メインコンポーネント =====

export function RuleSettingsPage() {
  const navigate = useNavigate();
  const [rule, setRule] = useState<RuleConfig>(() => createDefaultRuleConfig(GameLength.Hanchan));

  const update = useCallback(<K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) => {
    setRule((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 対局の長さを変更したとき連荘条件のデフォルトも切り替える
  const setGameLength = useCallback((gl: GameLength) => {
    setRule((prev) => ({
      ...prev,
      gameLength: gl,
      renchanCondition:
        gl === GameLength.Tonpu ? RenchanCondition.WinOnly : RenchanCondition.Tenpai,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center py-8 px-4">
      <h2 className="text-3xl font-bold text-white mb-6">ルール設定</h2>

      <div className="bg-emerald-800 rounded-xl p-5 w-full max-w-md space-y-5 overflow-y-auto max-h-[calc(100vh-160px)]">
        {/* 対局の長さ */}
        <div>
          <SectionHeader title="対局の長さ" />
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setGameLength(GameLength.Tonpu)}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                rule.gameLength === GameLength.Tonpu
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
              }`}
            >
              東風戦
            </button>
            <button
              onClick={() => setGameLength(GameLength.Hanchan)}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                rule.gameLength === GameLength.Hanchan
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
              }`}
            >
              半荘戦
            </button>
          </div>
        </div>

        {/* 役 */}
        <div className="space-y-1">
          <SectionHeader title="役" />
          <ToggleRow label="喰いタン" value={rule.kuitan} onChange={(v) => update("kuitan", v)} />
          <ToggleRow label="後付け" value={rule.atozuke} onChange={(v) => update("atozuke", v)} />
          <ToggleRow label="一発" value={rule.ippatsu} onChange={(v) => update("ippatsu", v)} />
          <ToggleRow label="流し満貫" value={rule.nagashiMangan} onChange={(v) => update("nagashiMangan", v)} />
          <ToggleRow label="国士無双の暗槓ロン" value={rule.kokushiAnkanRon} onChange={(v) => update("kokushiAnkanRon", v)} />
          <SelectRow
            label="九蓮宝燈の成立条件"
            value={rule.chuurenManzuOnly ? "manzu" : "all"}
            options={[
              { value: "all", label: "萬索筒いずれも可" },
              { value: "manzu", label: "萬子のみ" },
            ]}
            onChange={(v) => update("chuurenManzuOnly", v === "manzu")}
          />
          <ToggleRow label="發なし緑一色" value={rule.ryuuiisouWithoutHatsu} onChange={(v) => update("ryuuiisouWithoutHatsu", v)} />
        </div>

        {/* ドラ */}
        <div className="space-y-1">
          <SectionHeader title="ドラ" />
          <SelectRow
            label="槓ドラ"
            value={rule.kanDora}
            options={[
              { value: KanDoraRule.Immediate, label: "常に即乗り" },
              { value: KanDoraRule.AfterDiscard, label: "暗槓即/明槓打牌後" },
              { value: KanDoraRule.None, label: "無し" },
            ]}
            onChange={(v) => update("kanDora", v)}
          />
          <ToggleRow label="裏ドラ" value={rule.uraDora} onChange={(v) => update("uraDora", v)} />
          <ToggleRow label="槓裏ドラ" value={rule.kanUraDora} onChange={(v) => update("kanUraDora", v)} />
          <SelectRow
            label="赤ドラ"
            value={rule.redDora}
            options={[
              { value: "none" as const, label: "無し" },
              { value: "one-each" as const, label: "各1枚 (5萬5索5筒)" },
              { value: "two-pinzu" as const, label: "5萬5索5筒×2" },
            ]}
            onChange={(v) => update("redDora", v)}
          />
        </div>

        {/* アガリ点 */}
        <div className="space-y-1">
          <SectionHeader title="アガリ点" />
          <SelectRow
            label="七対子の点数"
            value={rule.chiitoitsuCalc}
            options={[
              { value: ChiitoitsuCalc.Fu25Han2, label: "25符2飜" },
              { value: ChiitoitsuCalc.Fu50Han1, label: "50符1飜" },
            ]}
            onChange={(v) => update("chiitoitsuCalc", v)}
          />
          <SelectRow
            label="連風牌の雀頭"
            value={rule.doubleWindFu}
            options={[
              { value: DoubleWindFu.Fu2, label: "2符" },
              { value: DoubleWindFu.Fu4, label: "4符" },
            ]}
            onChange={(v) => update("doubleWindFu", v)}
          />
          <ToggleRow label="切り上げ満貫" value={rule.kiriage} onChange={(v) => update("kiriage", v)} />
          <SelectRow
            label="人和"
            value={rule.renhou}
            options={[
              { value: RenhouRule.Yakuman, label: "役満" },
              { value: RenhouRule.Baiman, label: "倍満" },
              { value: RenhouRule.Haneman, label: "跳満" },
              { value: RenhouRule.None, label: "無し" },
            ]}
            onChange={(v) => update("renhou", v)}
          />
        </div>

        {/* 鳴き/リーチ/アガリ */}
        <div className="space-y-1">
          <SectionHeader title="鳴き / リーチ / アガリ" />
          <ToggleRow label="食い替え" value={rule.kuikae} onChange={(v) => update("kuikae", v)} />
          <SelectRow
            label="ダブロン"
            value={rule.doubleRon}
            options={[
              { value: DoubleRonRule.Allowed, label: "有り" },
              { value: DoubleRonRule.Atamahane, label: "頭ハネ" },
            ]}
            onChange={(v) => update("doubleRon", v)}
          />
          <SelectRow
            label="トリロン"
            value={rule.tripleRon}
            options={[
              { value: TripleRonRule.Allowed, label: "有り" },
              { value: TripleRonRule.Atamahane, label: "頭ハネ" },
              { value: TripleRonRule.Draw, label: "流局" },
            ]}
            onChange={(v) => update("tripleRon", v)}
          />
          <ToggleRow label="責任払い" value={rule.sekininBarai} onChange={(v) => update("sekininBarai", v)} />
        </div>

        {/* ゲーム進行 */}
        <div className="space-y-1">
          <SectionHeader title="ゲーム進行" />
          <SelectRow
            label="連荘条件"
            value={rule.renchanCondition}
            options={[
              { value: RenchanCondition.WinOnly, label: "アガリ連荘" },
              { value: RenchanCondition.Tenpai, label: "聴牌連荘" },
            ]}
            onChange={(v) => update("renchanCondition", v)}
          />
          <SelectRow
            label="九種九牌"
            value={rule.kyuushuKyuuhai}
            options={[
              { value: AbortiveDraw.DealerKeep, label: "親の連荘" },
              { value: AbortiveDraw.DealerRotate, label: "親流れ" },
              { value: AbortiveDraw.Disabled, label: "流局しない" },
            ]}
            onChange={(v) => update("kyuushuKyuuhai", v)}
          />
          <SelectRow
            label="四風子連打"
            value={rule.suufonsuRenda}
            options={[
              { value: AbortiveDraw.DealerKeep, label: "親の連荘" },
              { value: AbortiveDraw.DealerRotate, label: "親流れ" },
              { value: AbortiveDraw.Disabled, label: "流局しない" },
            ]}
            onChange={(v) => update("suufonsuRenda", v)}
          />
          <SelectRow
            label="四開槓"
            value={rule.suukaikan}
            options={[
              { value: AbortiveDraw.DealerKeep, label: "親の連荘" },
              { value: AbortiveDraw.DealerRotate, label: "親流れ" },
              { value: AbortiveDraw.Disabled, label: "流局しない" },
            ]}
            onChange={(v) => update("suukaikan", v)}
          />
          <SelectRow
            label="四人リーチ"
            value={rule.suuchaRiichi}
            options={[
              { value: AbortiveDraw.DealerKeep, label: "親の連荘" },
              { value: AbortiveDraw.DealerRotate, label: "親流れ" },
              { value: AbortiveDraw.Disabled, label: "流局しない" },
            ]}
            onChange={(v) => update("suuchaRiichi", v)}
          />
          <SelectRow
            label="トビ"
            value={rule.tobi}
            options={[
              { value: TobiRule.BelowZero, label: "0点未満でトビ" },
              { value: TobiRule.ZeroOrBelow, label: "0点以下でトビ" },
              { value: TobiRule.Disabled, label: "トビ無し" },
            ]}
            onChange={(v) => update("tobi", v)}
          />
          <ToggleRow label="アガリ止め" value={rule.agariyame} onChange={(v) => update("agariyame", v)} />
        </div>

        {/* 順位 */}
        <div className="space-y-1">
          <SectionHeader title="順位" />
          <SelectRow
            label="順位ウマ"
            value={rule.uma}
            options={[
              { value: UmaRule.Uma5_10, label: "5-10" },
              { value: UmaRule.Uma10_20, label: "10-20" },
              { value: UmaRule.Uma10_30, label: "10-30" },
              { value: UmaRule.Uma20_30, label: "20-30" },
            ]}
            onChange={(v) => update("uma", v)}
          />
          <SelectRow
            label="端数計算"
            value={rule.rounding}
            options={[
              { value: RoundingRule.OneDecimal, label: "小数第1位まで" },
              { value: RoundingRule.Round5Down6Up, label: "五捨六入" },
            ]}
            onChange={(v) => update("rounding", v)}
          />
        </div>
      </div>

      {/* ボタン */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          戻る
        </button>
        <button
          onClick={() => setRule(createDefaultRuleConfig(rule.gameLength))}
          className="bg-emerald-700 hover:bg-emerald-600 text-emerald-200 font-bold py-3 px-6 rounded-xl transition-colors"
        >
          デフォルトに戻す
        </button>
        <button
          onClick={() => navigate("/game", { state: { ruleConfig: rule } })}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
        >
          対局開始
        </button>
      </div>
    </div>
  );
}
