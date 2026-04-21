import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function TopPage() {
  const navigate = useNavigate();
  const { status, profile, error, loginWithGoogle, loginWithX, continueAsGuest, logout } =
    useAuthStore();
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-5xl font-bold text-white tracking-wider">麻雀 Web</h1>
      <p className="text-emerald-300 text-lg">ブラウザで遊べる4人打ち麻雀</p>

      <div className="w-80 bg-emerald-950/60 rounded-xl p-4 border border-emerald-700/60">
        {status === "authenticated" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-emerald-200 text-sm truncate">{profile?.displayName ?? "ログイン済み"}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => void loginWithGoogle()}
              disabled={isLoading}
              className="bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              Google でログイン
            </button>
            <button
              onClick={() => void loginWithX()}
              disabled={isLoading}
              className="bg-slate-950 hover:bg-slate-800 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              X でログイン
            </button>
            <button
              onClick={continueAsGuest}
              disabled={isLoading}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              ゲストで続行
            </button>
          </div>
        )}
        {error ? <p className="text-rose-300 text-xs mt-2">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-4 w-64">
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
      </div>

      <p className="text-emerald-400/60 text-sm mt-8">
        {status === "authenticated" ? "ログインしてプレイ中" : "ゲストとしてプレイ中"}
      </p>
    </div>
  );
}
