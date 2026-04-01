/**
 * 牌のSVG文字列を生成するユーティリティ
 *
 * 既存の React SVG コンポーネント (TileFace, TileBack) と同等の牌面を
 * プレーン SVG 文字列として生成する。Pixi.js テクスチャへの変換に使用。
 */
import { SVG_VIEWBOX_WIDTH, SVG_VIEWBOX_HEIGHT } from "./constants";

const W = SVG_VIEWBOX_WIDTH;  // 60
const H = SVG_VIEWBOX_HEIGHT; // 84

// ===== 萬子 =====

const KANJI: Record<number, string> = {
  1: "一", 2: "二", 3: "三", 4: "四", 5: "五",
  6: "六", 7: "七", 8: "八", 9: "九",
};

function manzuSvg(n: number, isRed: boolean): string {
  const c = isRed ? "#E53935" : "#C62828";
  return `<text x="30" y="34" text-anchor="middle" dominant-baseline="central" fill="${c}" font-size="28" font-weight="bold" font-family="serif">${KANJI[n]}</text>
<text x="30" y="62" text-anchor="middle" dominant-baseline="central" fill="${c}" font-size="20" font-weight="bold" font-family="serif">萬</text>`;
}

// ===== 筒子 =====

const CIRCLE_POS: Record<number, [number, number][]> = {
  1: [[30,42]], 2: [[30,28],[30,56]],
  3: [[38,20],[30,42],[22,64]],
  4: [[22,28],[38,28],[22,56],[38,56]],
  5: [[22,22],[38,22],[30,42],[22,62],[38,62]],
  6: [[22,20],[38,20],[22,42],[38,42],[22,64],[38,64]],
  7: [[22,16],[38,16],[30,30],[22,44],[38,44],[22,62],[38,62]],
  8: [[22,14],[38,14],[22,30],[38,30],[22,50],[38,50],[22,68],[38,68]],
  9: [[18,16],[30,16],[42,16],[18,42],[30,42],[42,42],[18,68],[30,68],[42,68]],
};

function pinzuSvg(n: number, isRed: boolean): string {
  const c = isRed ? "#E53935" : "#1565C0";
  const r = n >= 9 ? 7 : 8;
  return (CIRCLE_POS[n] ?? [])
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="2"/>`)
    .join("");
}

// ===== 索子 =====

const BAMBOO_POS: Record<number, [number, number][]> = {
  1: [[30,42]], 2: [[30,26],[30,58]],
  3: [[30,18],[30,42],[30,66]],
  4: [[22,26],[38,26],[22,58],[38,58]],
  5: [[22,20],[38,20],[30,42],[22,64],[38,64]],
  6: [[22,18],[38,18],[22,42],[38,42],[22,66],[38,66]],
  7: [[22,16],[38,16],[30,30],[22,44],[38,44],[22,62],[38,62]],
  8: [[22,14],[38,14],[22,30],[38,30],[22,50],[38,50],[22,68],[38,68]],
  9: [[18,16],[30,16],[42,16],[18,42],[30,42],[42,42],[18,68],[30,68],[42,68]],
};

function bambooStick(cx: number, cy: number, color: string): string {
  const w = 5, h = 7, gap = 1;
  return `<rect x="${cx - w / 2}" y="${cy - h - gap / 2}" width="${w}" height="${h}" rx="1" fill="${color}"/>
<rect x="${cx - w / 2}" y="${cy + gap / 2}" width="${w}" height="${h}" rx="1" fill="${color}"/>`;
}

function souzuSvg(n: number, isRed: boolean): string {
  const c = isRed ? "#E53935" : "#2E7D32";
  if (n === 1) {
    return `<circle cx="30" cy="42" r="12" fill="${c}"/><circle cx="30" cy="42" r="7" fill="white"/><circle cx="30" cy="42" r="3" fill="${c}"/>`;
  }
  return (BAMBOO_POS[n] ?? []).map(([cx, cy]) => bambooStick(cx, cy, c)).join("");
}

// ===== 字牌 =====

const HONOR: Record<string, { char: string; color: string }> = {
  ton: { char: "東", color: "#212121" },
  nan: { char: "南", color: "#212121" },
  sha: { char: "西", color: "#212121" },
  pei: { char: "北", color: "#212121" },
  haku: { char: "", color: "#9E9E9E" },
  hatsu: { char: "發", color: "#2E7D32" },
  chun: { char: "中", color: "#C62828" },
};

function honorSvg(name: string): string {
  const d = HONOR[name];
  if (!d) return "";
  if (name === "haku") {
    return `<rect x="15" y="22" width="30" height="40" rx="2" ry="2" fill="none" stroke="#BDBDBD" stroke-width="2"/>`;
  }
  return `<text x="30" y="46" text-anchor="middle" dominant-baseline="central" fill="${d.color}" font-size="38" font-weight="bold" font-family="serif">${d.char}</text>`;
}

// ===== パーサー =====

function parseTileType(type: string): { suit: string; number?: number; name?: string } {
  if (type.startsWith("man")) return { suit: "manzu", number: parseInt(type.slice(3), 10) };
  if (type.startsWith("sou")) return { suit: "souzu", number: parseInt(type.slice(3), 10) };
  if (type.startsWith("pin")) return { suit: "pinzu", number: parseInt(type.slice(3), 10) };
  if (["ton", "nan", "sha", "pei", "haku", "hatsu", "chun"].includes(type))
    return { suit: "honor", name: type };
  return { suit: "unknown" };
}

// ===== 公開関数 =====

/** 牌の表面 SVG 文字列を生成 */
export function buildTileFaceSvg(tileType: string, isRedDora: boolean): string {
  const { suit, number, name } = parseTileType(tileType);
  let inner = "";
  if (suit === "manzu" && number) inner = manzuSvg(number, isRedDora);
  else if (suit === "pinzu" && number) inner = pinzuSvg(number, isRedDora);
  else if (suit === "souzu" && number) inner = souzuSvg(number, isRedDora);
  else if (suit === "honor" && name) inner = honorSvg(name);

  const redBorder = isRedDora
    ? `<rect x="2" y="2" width="56" height="80" rx="3" ry="3" fill="none" stroke="#E53935" stroke-width="1.5"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect x="1" y="1" width="58" height="82" rx="4" ry="4" fill="white" stroke="#9E9E9E" stroke-width="1"/>${redBorder}${inner}</svg>`;
}

/** 牌の裏面 SVG 文字列を生成 */
export function buildTileBackSvg(): string {
  const lines = [15, 30, 45].map((x) => `<line x1="${x}" y1="8" x2="${x}" y2="76" stroke="#1976D2" stroke-width="0.5"/>`).join("");
  const hlines = [20, 36, 52, 68].map((y) => `<line x1="8" y1="${y}" x2="52" y2="${y}" stroke="#1976D2" stroke-width="0.5"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect x="1" y="1" width="58" height="82" rx="4" ry="4" fill="#1565C0" stroke="#0D47A1" stroke-width="1"/>${lines}${hlines}</svg>`;
}
