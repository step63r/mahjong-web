interface ActionOption {
  type: string;
  label: string;
}

interface ActionButtonsProps {
  actions: readonly ActionOption[];
  onAction: (type: string) => void;
  /** リーチモード中は true — キャンセルボタンのみ表示 */
  riichiMode?: boolean;
  onCancelRiichi?: () => void;
}

const ACTION_STYLES: Record<string, string> = {
  tsumo: "bg-green-600 hover:bg-green-500 text-white",
  ron: "bg-red-600 hover:bg-red-500 text-white",
  riichi: "bg-blue-600 hover:bg-blue-500 text-white",
  chi: "bg-amber-600 hover:bg-amber-500 text-white",
  pon: "bg-orange-600 hover:bg-orange-500 text-white",
  kan: "bg-purple-600 hover:bg-purple-500 text-white",
  ankan: "bg-purple-600 hover:bg-purple-500 text-white",
  kakan: "bg-purple-600 hover:bg-purple-500 text-white",
  kyuushu: "bg-yellow-700 hover:bg-yellow-600 text-white",
  skip: "bg-gray-600 hover:bg-gray-500 text-white",
};

export function ActionButtons({ actions, onAction, riichiMode, onCancelRiichi }: ActionButtonsProps) {
  if (riichiMode) {
    return (
      <div className="flex gap-2 justify-center flex-wrap mt-2">
        <span className="px-3 py-2 text-sm text-blue-200">捨てる牌を選択してください</span>
        <button
          onClick={onCancelRiichi}
          className="px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-gray-600 hover:bg-gray-500 text-white"
        >
          キャンセル
        </button>
      </div>
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 justify-center flex-wrap mt-2">
      {actions.map((action) => (
        <button
          key={action.type}
          onClick={() => onAction(action.type)}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
            ACTION_STYLES[action.type] ?? "bg-gray-600 hover:bg-gray-500 text-white"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
