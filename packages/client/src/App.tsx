import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TopPage } from "@/pages/TopPage";
import { MenuPage } from "@/pages/MenuPage";
import { RuleSettingsPage } from "@/pages/RuleSettingsPage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { RoomPage } from "@/pages/RoomPage";
import { OnlineGamePage } from "@/pages/OnlineGamePage";
import { StatsPage } from "@/pages/StatsPage";
import { ReplayPage } from "@/pages/ReplayPage";
import { useAuthStore } from "./stores/authStore";

/** 対局中・結果画面などローディング表示が不要なルート */
const GAME_ROUTES = new Set(["/game", "/online-game", "/result", "/replay"]);

/** 認証状態が確定するまで全画面スピナーを表示するラッパー */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  // 対局中などのルートは認証チラつきとは無関係なので即表示
  if (status === "loading" && !GAME_ROUTES.has(location.pathname)) {
    return (
      <div className="min-h-screen bg-emerald-900 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<TopPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/rule-settings" element={<RuleSettingsPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/room" element={<RoomPage />} />
          <Route path="/online-game" element={<OnlineGamePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/replay" element={<ReplayPage />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
