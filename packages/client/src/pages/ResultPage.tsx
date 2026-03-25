import { useNavigate } from "react-router-dom";

export function ResultPage() {
  const navigate = useNavigate();

  // Mock results
  const results = [
    { rank: 1, label: "CPU 3", score: 42000, diff: "+52.0" },
    { rank: 2, label: "あなた", score: 28000, diff: "+8.0" },
    { rank: 3, label: "CPU 1", score: 18000, diff: "-12.0" },
    { rank: 4, label: "CPU 2", score: 12000, diff: "-48.0" },
  ];

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
            {results.map((r) => (
              <tr
                key={r.rank}
                className={r.label === "あなた" ? "text-yellow-300 font-bold" : "text-gray-200"}
              >
                <td className="py-3 text-2xl">{r.rank}位</td>
                <td className="py-3">{r.label}</td>
                <td className="py-3 text-right">{r.score.toLocaleString()}点</td>
                <td className="py-3 text-right">{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => navigate("/")}
        className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
      >
        トップに戻る
      </button>
    </div>
  );
}
