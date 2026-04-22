import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function TopPage() {
  const navigate = useNavigate();
  const { status, error, loginWithGoogle, loginWithX, continueAsGuest } =
    useAuthStore();
  const isLoading = status === "loading";

  useEffect(() => {
    if (status === "authenticated") {
      navigate("/menu", { replace: true });
    }
  }, [status, navigate]);

  const handleContinueAsGuest = () => {
    continueAsGuest();
    navigate("/menu");
  };

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-5xl font-bold text-white tracking-wider">麻雀 Web</h1>
      <p className="text-emerald-300 text-lg">ブラウザで遊べる4人打ち麻雀</p>

      <div className="w-80 bg-emerald-950/60 rounded-xl p-4 border border-emerald-700/60">
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
          <div className="my-2 border-t border-emerald-700/70" />
          <button
            onClick={handleContinueAsGuest}
            disabled={isLoading}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            ゲストで続行
          </button>
        </div>
        {error ? <p className="text-rose-300 text-xs mt-2">{error}</p> : null}
      </div>
    </div>
  );
}
