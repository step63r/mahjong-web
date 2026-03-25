export function TileBack() {
  return (
    <g>
      <rect
        x="1"
        y="1"
        width="58"
        height="82"
        rx="4"
        ry="4"
        fill="#1565C0"
        stroke="#0D47A1"
        strokeWidth="1"
      />
      {[15, 30, 45].map((x) => (
        <line key={`v${x}`} x1={x} y1="8" x2={x} y2="76" stroke="#1976D2" strokeWidth="0.5" />
      ))}
      {[20, 36, 52, 68].map((y) => (
        <line key={`h${y}`} x1="8" y1={y} x2="52" y2={y} stroke="#1976D2" strokeWidth="0.5" />
      ))}
    </g>
  );
}
