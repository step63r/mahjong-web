import type { TileData } from "@/types";
import { ManzuFace } from "./suits/ManzuFace";
import { SouzuFace } from "./suits/SouzuFace";
import { PinzuFace } from "./suits/PinzuFace";
import { HonorFace } from "./suits/HonorFace";

function parseTileType(type: string): {
  suit: "manzu" | "souzu" | "pinzu" | "kaze" | "sangen";
  number?: number;
  name?: string;
} {
  if (type.startsWith("man")) return { suit: "manzu", number: parseInt(type.slice(3), 10) };
  if (type.startsWith("sou")) return { suit: "souzu", number: parseInt(type.slice(3), 10) };
  if (type.startsWith("pin")) return { suit: "pinzu", number: parseInt(type.slice(3), 10) };
  if (type === "ton" || type === "nan" || type === "sha" || type === "pei")
    return { suit: "kaze", name: type };
  return { suit: "sangen", name: type };
}

interface TileFaceProps {
  tile: TileData;
}

export function TileFace({ tile }: TileFaceProps) {
  const parsed = parseTileType(tile.type);
  const isRed = tile.isRedDora;

  return (
    <g>
      {/* White tile background */}
      <rect
        x="1"
        y="1"
        width="58"
        height="82"
        rx="4"
        ry="4"
        fill="white"
        stroke="#9E9E9E"
        strokeWidth="1"
      />
      {/* Red dora indicator */}
      {isRed && (
        <rect
          x="2"
          y="2"
          width="56"
          height="80"
          rx="3"
          ry="3"
          fill="none"
          stroke="#E53935"
          strokeWidth="1.5"
        />
      )}
      {/* Suit-specific rendering */}
      {parsed.suit === "manzu" && <ManzuFace number={parsed.number!} isRed={isRed} />}
      {parsed.suit === "souzu" && <SouzuFace number={parsed.number!} isRed={isRed} />}
      {parsed.suit === "pinzu" && <PinzuFace number={parsed.number!} isRed={isRed} />}
      {(parsed.suit === "kaze" || parsed.suit === "sangen") && <HonorFace name={parsed.name!} />}
    </g>
  );
}
