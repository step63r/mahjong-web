import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/stores/gameStore";

const PLAYER_NAMES = ["あなた", "CPU 1", "CPU 2", "CPU 3"] as const;

export function ResultPage() {
  const navigate = useNavigate();
  const { gameResult, returnToTop } = useGameStore();

  const handleReturn = () => {
    returnToTop();
    navigate("/");
  };

  if (!gameResult) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
        <p className="text-white text-xl">結果データがありません</p>
        <button
          onClick={handleReturn}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
        >
          トップに戻る
        </button>
      </div>
    );
  }

  // 順位順にソート
  const rows = PLAYER_NAMES.map((name, i) => ({
    name,
    rank: gameResult.rankings[i],
    score: gameResult.finalScores[i],
    points: gameResult.finalPoints[i],
    isHuman: i === 0,
  })).sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h2 className="text-3xl font-bold text-white">対局結果</h2>

      <div className="bg-emerald-800 rounded-xl p-6 w-full max-w-md">
        <table className="w-full text-white">
          <thead>
            <tr className="text-emerald-300 text-sm border-b border-emerald-600">
              <th className="py-2 text-left">順位</th>
              <th className="py-2 text-left">プレイヤー</th>
              <th className="py-2 text-right">持ち点</th>
              <th className="py-2 text-right">ポイント</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rank}
                className={r.isHuman ? "text-yellow-300 font-bold" : "text-gray-200"}
              >
                <td className="py-3 text-2xl">{r.rank}位</td>
                <td className="py-3">{r.name}</td>
                <td className="py-3 text-right">{r.score.toLocaleString()}点</td>
                <td className="py-3 text-right">
                  {r.points > 0 ? "+" : ""}
                  {r.points.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleReturn}
        className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
      >
        トップに戻る
      </button>
    </div>
  );
}
