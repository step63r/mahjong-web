import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { getStatsSummary, type StatsSummaryDto } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

type StatsTab = "cpu" | "online";

interface ChartPoint {
  x: number;
  label: string;
  rank: number | null;
}

function toChartData(recentRanks: StatsSummaryDto["recentRanks"]): ChartPoint[] {
  const points: ChartPoint[] = Array.from({ length: 10 }, (_, idx) => ({
    x: idx + 1,
    label: `${10 - idx}試合前`,
    rank: null,
  }));

  const normalized = recentRanks.slice(-10);
  for (let i = 0; i < normalized.length; i++) {
    const targetIndex = 10 - normalized.length + i;
    points[targetIndex].rank = normalized[i].rank;
  }

  points[9].label = "前回";
  return points;
}

export function StatsPage() {
  const navigate = useNavigate();
  const { status } = useAuthStore();

  const [tab, setTab] = useState<StatsTab>("cpu");
  const [stats, setStats] = useState<StatsSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      navigate("/menu", { replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void getStatsSummary(tab)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "戦績の取得に失敗しました");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, tab]);

  const chartData = useMemo(() => toChartData(stats?.recentRanks ?? []), [stats]);

  return (
    <div className="min-h-screen bg-emerald-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-wide">戦績閲覧</h1>
          <button
            onClick={() => navigate("/menu")}
            className="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            メニューへ戻る
          </button>
        </div>

        <div className="inline-flex rounded-xl bg-emerald-950/60 p-1 border border-emerald-700/60 mb-6">
          <button
            onClick={() => setTab("cpu")}
            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
              tab === "cpu"
                ? "bg-amber-600 text-white"
                : "text-emerald-200 hover:bg-emerald-800"
            }`}
          >
            CPU戦
          </button>
          <button
            onClick={() => setTab("online")}
            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
              tab === "online"
                ? "bg-sky-600 text-white"
                : "text-emerald-200 hover:bg-emerald-800"
            }`}
          >
            対人戦
          </button>
        </div>

        {isLoading ? (
          <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-6 text-emerald-200">
            読み込み中...
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-700/60 rounded-xl p-6 text-rose-200">
            {error}
          </div>
        ) : !stats ? (
          <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-6 text-emerald-200">
            データがありません
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-5">
              <h2 className="text-xl font-bold mb-4">直近の戦績（最大10試合）</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 24, left: 8, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#2d6a4f" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={[0, 10]}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                      tickFormatter={(value) => chartData.find((d) => d.x === value)?.label ?? ""}
                      stroke="#a7f3d0"
                    />
                    <YAxis
                      type="number"
                      domain={[5, 1]}
                      ticks={[4, 3, 2, 1]}
                      tickFormatter={(value) => `${value}位`}
                      stroke="#a7f3d0"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#052e16",
                        border: "1px solid #166534",
                        borderRadius: "8px",
                      }}
                      formatter={(value: unknown) => {
                        const num = typeof value === "number" ? value : null;
                        return num == null ? "データなし" : `${num}位`;
                      }}
                      labelFormatter={(value) =>
                        chartData.find((d) => d.x === value)?.label ?? ""
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="rank"
                      stroke={tab === "cpu" ? "#f59e0b" : "#38bdf8"}
                      strokeWidth={3}
                      connectNulls={false}
                      dot={{ fill: "#ffffff", r: 4 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey="rank"
                        position="top"
                        formatter={(value: unknown) => {
                          const num = typeof value === "number" ? value : null;
                          return num == null ? "" : `${num}`;
                        }}
                        fill="#e5e7eb"
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-4">
                <p className="text-emerald-300 text-sm">総対局数</p>
                <p className="text-2xl font-bold mt-1">{stats.totalGames} 戦</p>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-4">
                <p className="text-emerald-300 text-sm">平均順位</p>
                <p className="text-2xl font-bold mt-1">{stats.averageRank.toFixed(2)} 位</p>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-4">
                <p className="text-emerald-300 text-sm">平均和了</p>
                <p className="text-lg font-bold mt-1">{stats.averageWinScore.toLocaleString()} 点</p>
                <p className="text-emerald-200 text-sm mt-1">平均 {stats.averageWinHan.toFixed(2)} 飜</p>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-4">
                <p className="text-emerald-300 text-sm">平均放銃</p>
                <p className="text-lg font-bold mt-1">{stats.averageLossScore.toLocaleString()} 点</p>
                <p className="text-emerald-200 text-sm mt-1">平均 {stats.averageLossHan.toFixed(2)} 飜</p>
              </div>
            </section>

            <section className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-5">
              <h2 className="text-xl font-bold mb-4">役ごとの和了回数</h2>
              {stats.yakuStats.length === 0 ? (
                <p className="text-emerald-200">和了データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[360px]">
                    <thead>
                      <tr className="border-b border-emerald-700/70 text-emerald-300 text-sm">
                        <th className="py-2 pr-4">役</th>
                        <th className="py-2 text-right">回数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.yakuStats.map((yaku) => (
                        <tr key={yaku.name} className="border-b border-emerald-800/60">
                          <td className="py-2 pr-4">{yaku.name}</td>
                          <td className="py-2 text-right font-semibold">{yaku.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
