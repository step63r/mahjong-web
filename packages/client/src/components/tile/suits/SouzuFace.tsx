const BAMBOO_POSITIONS: Record<number, [number, number][]> = {
  1: [[30, 42]],
  2: [
    [30, 26],
    [30, 58],
  ],
  3: [
    [30, 18],
    [30, 42],
    [30, 66],
  ],
  4: [
    [22, 26],
    [38, 26],
    [22, 58],
    [38, 58],
  ],
  5: [
    [22, 20],
    [38, 20],
    [30, 42],
    [22, 64],
    [38, 64],
  ],
  6: [
    [22, 18],
    [38, 18],
    [22, 42],
    [38, 42],
    [22, 66],
    [38, 66],
  ],
  7: [
    [22, 16],
    [38, 16],
    [30, 30],
    [22, 44],
    [38, 44],
    [22, 62],
    [38, 62],
  ],
  8: [
    [22, 14],
    [38, 14],
    [22, 30],
    [38, 30],
    [22, 50],
    [38, 50],
    [22, 68],
    [38, 68],
  ],
  9: [
    [18, 16],
    [30, 16],
    [42, 16],
    [18, 42],
    [30, 42],
    [42, 42],
    [18, 68],
    [30, 68],
    [42, 68],
  ],
};

function Bamboo({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const w = 5;
  const h = 7;
  const gap = 1;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h - gap / 2} width={w} height={h} rx={1} fill={color} />
      <rect x={cx - w / 2} y={cy + gap / 2} width={w} height={h} rx={1} fill={color} />
    </g>
  );
}

interface SouzuFaceProps {
  number: number;
  isRed: boolean;
}

export function SouzuFace({ number, isRed }: SouzuFaceProps) {
  const color = isRed ? "#E53935" : "#2E7D32";
  const positions = BAMBOO_POSITIONS[number] ?? [];

  // 1 souzu: concentric circles
  if (number === 1) {
    return (
      <g>
        <circle cx={30} cy={42} r={12} fill={color} />
        <circle cx={30} cy={42} r={7} fill="white" />
        <circle cx={30} cy={42} r={3} fill={color} />
      </g>
    );
  }

  return (
    <g>
      {positions.map(([cx, cy], i) => (
        <Bamboo key={i} cx={cx} cy={cy} color={color} />
      ))}
    </g>
  );
}
