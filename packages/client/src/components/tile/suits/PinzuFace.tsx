const CIRCLE_POSITIONS: Record<number, [number, number][]> = {
  1: [[30, 42]],
  2: [
    [30, 28],
    [30, 56],
  ],
  3: [
    [38, 20],
    [30, 42],
    [22, 64],
  ],
  4: [
    [22, 28],
    [38, 28],
    [22, 56],
    [38, 56],
  ],
  5: [
    [22, 22],
    [38, 22],
    [30, 42],
    [22, 62],
    [38, 62],
  ],
  6: [
    [22, 20],
    [38, 20],
    [22, 42],
    [38, 42],
    [22, 64],
    [38, 64],
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

interface PinzuFaceProps {
  number: number;
  isRed: boolean;
}

export function PinzuFace({ number, isRed }: PinzuFaceProps) {
  const color = isRed ? "#E53935" : "#1565C0";
  const positions = CIRCLE_POSITIONS[number] ?? [];
  const radius = number >= 9 ? 7 : 8;

  return (
    <g>
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth="2" />
      ))}
    </g>
  );
}
