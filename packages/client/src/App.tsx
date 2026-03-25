import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TopPage } from "@/pages/TopPage";
import { RuleSettingsPage } from "@/pages/RuleSettingsPage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/rule-settings" element={<RuleSettingsPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}
