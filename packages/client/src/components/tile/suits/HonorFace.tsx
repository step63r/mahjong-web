const HONOR_DISPLAY: Record<string, { char: string; color: string }> = {
  ton: { char: "東", color: "#212121" },
  nan: { char: "南", color: "#212121" },
  sha: { char: "西", color: "#212121" },
  pei: { char: "北", color: "#212121" },
  haku: { char: "", color: "#9E9E9E" },
  hatsu: { char: "發", color: "#2E7D32" },
  chun: { char: "中", color: "#C62828" },
};

interface HonorFaceProps {
  name: string;
}

export function HonorFace({ name }: HonorFaceProps) {
  const display = HONOR_DISPLAY[name];
  if (!display) return null;

  // 白 (haku): bordered rectangle
  if (name === "haku") {
    return (
      <g>
        <rect
          x="15"
          y="22"
          width="30"
          height="40"
          rx="2"
          ry="2"
          fill="none"
          stroke="#BDBDBD"
          strokeWidth="2"
        />
      </g>
    );
  }

  return (
    <g>
      <text
        x="30"
        y="46"
        textAnchor="middle"
        dominantBaseline="central"
        fill={display.color}
        fontSize="38"
        fontWeight="bold"
        fontFamily="serif"
      >
        {display.char}
      </text>
    </g>
  );
}
