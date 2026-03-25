const KANJI_NUMBERS: Record<number, string> = {
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
  7: "七",
  8: "八",
  9: "九",
};

interface ManzuFaceProps {
  number: number;
  isRed: boolean;
}

export function ManzuFace({ number, isRed }: ManzuFaceProps) {
  const color = isRed ? "#E53935" : "#C62828";

  return (
    <g>
      <text
        x="30"
        y="34"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="28"
        fontWeight="bold"
        fontFamily="serif"
      >
        {KANJI_NUMBERS[number]}
      </text>
      <text
        x="30"
        y="62"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="20"
        fontWeight="bold"
        fontFamily="serif"
      >
        萬
      </text>
    </g>
  );
}
