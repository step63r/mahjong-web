import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TopPage } from "@/pages/TopPage";
import { MenuPage } from "@/pages/MenuPage";
import { RuleSettingsPage } from "@/pages/RuleSettingsPage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { RoomPage } from "@/pages/RoomPage";
import { OnlineGamePage } from "@/pages/OnlineGamePage";
import { useAuthStore } from "./stores/authStore";

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/rule-settings" element={<RuleSettingsPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/online-game" element={<OnlineGamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
