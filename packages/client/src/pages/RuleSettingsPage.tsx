import { useState } from "react";
import { useNavigate } from "react-router-dom";

type GameLength = "tonpu" | "hanchan";

export function RuleSettingsPage() {
  const navigate = useNavigate();
  const [gameLength, setGameLength] = useState<GameLength>("hanchan");

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h2 className="text-3xl font-bold text-white">ルール設定</h2>

      <div className="bg-emerald-800 rounded-xl p-6 w-full max-w-md space-y-6">
        {/* Game length */}
        <div>
          <label className="text-emerald-200 text-sm font-bold block mb-2">対局の長さ</label>
          <div className="flex gap-3">
            <button
              onClick={() => setGameLength("tonpu")}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                gameLength === "tonpu"
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
              }`}
            >
              東風戦
            </button>
            <button
              onClick={() => setGameLength("hanchan")}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                gameLength === "hanchan"
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
              }`}
            >
              半荘戦
            </button>
          </div>
        </div>

        {/* Placeholder for more rule settings */}
        <div className="text-emerald-400/60 text-sm text-center py-4 border border-dashed border-emerald-600 rounded-lg">
          詳細ルール設定（後日実装）
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          戻る
        </button>
        <button
          onClick={() => navigate("/game", { state: { gameLength } })}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
        >
          対局開始
        </button>
      </div>
    </div>
  );
}
