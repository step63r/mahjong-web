import type { PlayerViewState, TileData } from "@/types";
import { PlayerHand } from "./PlayerHand";
import { DiscardArea } from "./DiscardArea";
import { MeldDisplay } from "./MeldDisplay";
import { InfoPanel } from "./InfoPanel";

interface GameBoardProps {
  players: readonly PlayerViewState[];
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  remainingTiles: number;
  doraIndicators: readonly TileData[];
  currentPlayer: number;
  selectedTileIndex?: number;
  onTileClick?: (index: number) => void;
  actionButtons?: React.ReactNode;
}

export function GameBoard({
  players,
  roundWind,
  roundNumber,
  honba,
  riichiSticks,
  remainingTiles,
  doraIndicators,
  currentPlayer,
  selectedTileIndex,
  onTileClick,
  actionButtons,
}: GameBoardProps) {
  const self = players[0];
  const shimocha = players[1];
  const toimen = players[2];
  const kamicha = players[3];

  return (
    <div className="flex flex-col h-screen bg-emerald-900 select-none overflow-hidden">
      {/* Top: Toimen (opponent across) */}
      <div className="flex justify-center items-center gap-2 p-2">
        <MeldDisplay melds={toimen?.melds ?? []} tileSize={18} />
        <PlayerHand tiles={toimen?.hand ?? []} tileSize={22} faceDown />
      </div>

      {/* Middle row: Side opponents + Center discards */}
      <div className="flex flex-1 min-h-0 items-center">
        {/* Kamicha (left) */}
        <div className="hidden md:flex flex-col items-center justify-center p-1 gap-1 w-24 shrink-0">
          <span className="text-xs text-emerald-300/60">上家</span>
          <span className="text-xs text-white">{(kamicha?.score ?? 0).toLocaleString()}</span>
        </div>

        {/* Center: Discard rivers + info */}
        <div className="flex-1 flex items-center justify-center gap-3 p-2 min-w-0">
          <div className="bg-emerald-800/50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <DiscardArea discards={kamicha?.discards ?? []} tileSize={22} label="上家" />
              <DiscardArea discards={toimen?.discards ?? []} tileSize={22} label="対面" />
              <DiscardArea discards={self?.discards ?? []} tileSize={22} label="自家" />
              <DiscardArea discards={shimocha?.discards ?? []} tileSize={22} label="下家" />
            </div>
          </div>

          {/* Info panel */}
          <div className="hidden sm:block">
            <InfoPanel
              roundWind={roundWind}
              roundNumber={roundNumber}
              honba={honba}
              riichiSticks={riichiSticks}
              remainingTiles={remainingTiles}
              doraIndicators={doraIndicators}
              scores={players.map((p) => p.score)}
              currentPlayer={currentPlayer}
            />
          </div>
        </div>

        {/* Shimocha (right) */}
        <div className="hidden md:flex flex-col items-center justify-center p-1 gap-1 w-24 shrink-0">
          <span className="text-xs text-emerald-300/60">下家</span>
          <span className="text-xs text-white">{(shimocha?.score ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Bottom: Self melds + hand + actions */}
      <div className="flex flex-col items-center gap-2 p-2 pb-4">
        <MeldDisplay melds={self?.melds ?? []} tileSize={30} />
        <PlayerHand
          tiles={self?.hand ?? []}
          drawnTile={self?.drawnTile}
          tileSize={40}
          selectedIndex={selectedTileIndex}
          onTileClick={onTileClick}
        />
        {actionButtons}
      </div>
    </div>
  );
}
