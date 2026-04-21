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
  playerNames?: readonly string[];
  currentPlayer: number;
  dealerIndex?: number;
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
  playerNames,
  currentPlayer,
  dealerIndex,
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

      {/* Middle: Center area with discards around info panel (3×3 grid) */}
      <div className="flex flex-1 min-h-0 items-center justify-center">

        {/* 3×3 grid: discard rivers surround InfoPanel */}
        <div
          className="grid shrink-0"
          style={{
            gridTemplateColumns: "130px 1fr 130px",
            gridTemplateRows: "130px 1fr 130px",
            width: 560,
            height: 560,
          }}
        >
          {/* row 1 */}
          <div /> {/* top-left corner */}
          <div className="overflow-hidden flex items-end justify-end">
            {/* 対面: 右→左、行は下→上（最初の行が下=中央寄り） */}
            <DiscardArea discards={toimen?.discards ?? []} tileSize={28} flow="left" tileRotation={180} />
          </div>
          <div /> {/* top-right corner */}

          {/* row 2 */}
          <div className="overflow-hidden flex items-start justify-end">
            {/* 上家: 上→下、列は右→左（最初の列が右=中央寄り） */}
            <DiscardArea discards={kamicha?.discards ?? []} tileSize={28} flow="down" tileRotation={90} />
          </div>
          <div className="flex items-center justify-center">
            <InfoPanel
              roundWind={roundWind}
              roundNumber={roundNumber}
              honba={honba}
              riichiSticks={riichiSticks}
              remainingTiles={remainingTiles}
              doraIndicators={doraIndicators}
              scores={players.map((p) => p.score)}
              playerNames={playerNames}
              currentPlayer={currentPlayer}
              dealerIndex={dealerIndex}
            />
          </div>
          <div className="overflow-hidden flex items-end justify-start">
            {/* 下家: 下→上、列は左→右（最初の列が左=中央寄り） */}
            <DiscardArea discards={shimocha?.discards ?? []} tileSize={28} flow="up" tileRotation={270} />
          </div>

          {/* row 3 */}
          <div /> {/* bottom-left corner */}
          <div className="overflow-hidden flex items-start justify-start">
            {/* 自家: 左→右、行は上→下（最初の行が上=中央寄り） */}
            <DiscardArea discards={self?.discards ?? []} tileSize={28} flow="right" />
          </div>
          <div /> {/* bottom-right corner */}
        </div>

      </div>

      {/* Bottom: Self melds + hand + actions */}
      <div className="flex flex-col items-center gap-2 p-2 pb-4">
        <div className="flex flex-col items-end gap-2">
          {actionButtons}
          <div className="flex items-end gap-5">
            <PlayerHand
              tiles={self?.hand ?? []}
              drawnTile={self?.drawnTile}
              tileSize={40}
              selectedIndex={selectedTileIndex}
              onTileClick={onTileClick}
            />
            <MeldDisplay melds={self?.melds ?? []} tileSize={30} />
          </div>
        </div>
      </div>
    </div>
  );
}
