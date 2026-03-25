import type { RoundState } from "@mahjong-web/domain";

interface DebugPanelProps {
  round: RoundState;
}

const SEAT_NAMES = ["自家", "下家", "対面", "上家"] as const;

export function DebugPanel({ round }: DebugPanelProps) {
  return (
    <div className="fixed top-10 right-2 bg-gray-900/90 text-white text-xs rounded-lg p-3 max-w-xs max-h-[80vh] overflow-y-auto z-50 space-y-2">
      <div className="text-red-400 font-bold mb-1">DEBUG MODE</div>

      <div className="text-gray-400">
        Phase: {round.phase} | Turn: {round.turnCount} | Active:{" "}
        {SEAT_NAMES[round.activePlayerIndex]}
      </div>

      <div className="text-gray-400">
        残り: {round.wall.remainingDrawCount}枚 | 本場: {round.honba} | リーチ棒:{" "}
        {round.riichiSticks}
      </div>

      {/* 各プレイヤーの手牌 */}
      {round.players.map((player, i) => {
        const tiles = player.hand.getTiles();
        return (
          <div key={i} className="border-t border-gray-700 pt-1">
            <div className="text-amber-400">
              {SEAT_NAMES[i]}
              {player.isRiichi ? " [リーチ]" : ""}
              {player.isDoubleRiichi ? " [ダブリー]" : ""}
            </div>
            <div className="text-green-300 break-all">{tiles.map((t) => t.type).join(" ")}</div>
          </div>
        );
      })}

      {/* ドラ表示牌 */}
      <div className="border-t border-gray-700 pt-1">
        <div className="text-amber-400">ドラ表示牌</div>
        <div className="text-green-300">
          {round.wall
            .getDoraIndicators()
            .map((t) => t.type)
            .join(" ")}
        </div>
      </div>
    </div>
  );
}
