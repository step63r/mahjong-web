import { useState } from "react";
import { GameBoard } from "@/components/board/GameBoard";
import { ActionButtons } from "@/components/action/ActionButtons";
import type { TileData, PlayerViewState } from "@/types";

// --- Mock data helpers ---

function t(type: string, id: number, isRedDora = false): TileData {
  return { type, id, isRedDora };
}

function createMockState(): {
  players: PlayerViewState[];
  doraIndicators: TileData[];
} {
  const selfHand: TileData[] = [
    t("man1", 0),
    t("man2", 0),
    t("man3", 0),
    t("pin4", 0),
    t("pin5", 0, true),
    t("pin6", 0),
    t("sou7", 0),
    t("sou8", 0),
    t("sou9", 0),
    t("ton", 0),
    t("ton", 1),
    t("haku", 0),
    t("haku", 1),
  ];

  const faceDownHand = (count: number): TileData[] =>
    Array.from({ length: count }, (_, i) => t("haku", i));

  return {
    players: [
      {
        hand: selfHand,
        drawnTile: t("hatsu", 0),
        discards: [
          { tile: t("pei", 0) },
          { tile: t("sha", 0) },
          { tile: t("chun", 0) },
          { tile: t("man9", 0) },
          { tile: t("pin1", 0) },
          { tile: t("sou1", 0) },
        ],
        melds: [],
        score: 25000,
      },
      {
        hand: faceDownHand(13),
        discards: [
          { tile: t("pei", 1) },
          { tile: t("man8", 0) },
          { tile: t("sou2", 0) },
          { tile: t("pin9", 0) },
          { tile: t("sha", 1) },
        ],
        melds: [],
        score: 25000,
      },
      {
        hand: faceDownHand(13),
        discards: [
          { tile: t("nan", 0) },
          { tile: t("man7", 0) },
          { tile: t("sou3", 0) },
          { tile: t("pin8", 0) },
        ],
        melds: [
          {
            tiles: [t("chun", 1), t("chun", 2), t("chun", 3)],
            calledTileIndex: 2,
          },
        ],
        score: 25000,
      },
      {
        hand: faceDownHand(13),
        discards: [
          { tile: t("pei", 2) },
          { tile: t("man6", 0) },
          { tile: t("sou4", 0), isRiichi: true },
        ],
        melds: [],
        score: 24000,
      },
    ],
    doraIndicators: [t("man4", 0)],
  };
}

const MOCK_ACTIONS = [
  { type: "riichi", label: "リーチ" },
  { type: "skip", label: "スキップ" },
];

// --- Component ---

export function GamePage() {
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | undefined>();
  const { players, doraIndicators } = createMockState();

  const handleTileClick = (index: number) => {
    setSelectedTileIndex((prev) => (prev === index ? undefined : index));
  };

  const handleAction = (type: string) => {
    if (type === "skip") {
      setSelectedTileIndex(undefined);
    }
  };

  return (
    <GameBoard
      players={players}
      roundWind="ton"
      roundNumber={1}
      honba={0}
      riichiSticks={1}
      remainingTiles={56}
      doraIndicators={doraIndicators}
      currentPlayer={0}
      selectedTileIndex={selectedTileIndex}
      onTileClick={handleTileClick}
      actionButtons={<ActionButtons actions={MOCK_ACTIONS} onAction={handleAction} />}
    />
  );
}
