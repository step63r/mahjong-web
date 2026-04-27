import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export function MenuPage() {
  const navigate = useNavigate();
  const { status, profile, logout } = useAuthStore();

  const userLabel = status === "authenticated"
    ? (profile?.displayName ?? "ログイン済み")
    : "ゲスト";
  const isAuthenticated = status === "authenticated";

  return (
    <div className="relative min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-4xl font-bold text-white tracking-wider">メニュー</h1>
      {!isAuthenticated ? null : (
        <p className="text-emerald-300 text-lg">{userLabel}でプレイ中</p>
      )}

      <div className="flex flex-col gap-4 w-72">
        <button
          onClick={() => navigate("/rule-settings")}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
        >
          CPU 対戦
        </button>
        <button
          onClick={() => navigate("/lobby")}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
        >
          対人戦
        </button>
        {isAuthenticated ? (
          <button
            onClick={() => navigate("/stats")}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
          >
            戦績閲覧
          </button>
        ) : null}
      </div>

      {isAuthenticated ? (
        <button
          onClick={() => void logout().then(() => navigate("/", { replace: true }))}
          className="mt-8 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          ログアウト
        </button>
      ) : (
        <p className="text-emerald-400/70 text-sm mt-8">ゲストでプレイ中</p>
      )}

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-emerald-400/70 text-xs">
        © 2026 minato project
      </p>
    </div>
  );
}
