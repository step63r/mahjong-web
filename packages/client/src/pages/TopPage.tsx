import { useNavigate } from "react-router-dom";

export function TopPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-5xl font-bold text-white tracking-wider">麻雀 Web</h1>
      <p className="text-emerald-300 text-lg">ブラウザで遊べる4人打ち麻雀</p>

      <div className="flex flex-col gap-4 w-64">
        <button
          onClick={() => navigate("/rule-settings")}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
        >
          CPU 対戦
        </button>
        <button
          disabled
          className="bg-gray-600 text-gray-400 font-bold py-4 px-8 rounded-xl text-xl cursor-not-allowed"
        >
          対人戦（準備中）
        </button>
      </div>

      <p className="text-emerald-400/60 text-sm mt-8">ゲストとしてプレイ中</p>
    </div>
  );
}
