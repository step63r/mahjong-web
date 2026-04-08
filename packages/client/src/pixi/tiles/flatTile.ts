/**
 * 平面 2D 牌スプライト工場
 *
 * SVG 画像ベースのテクスチャ (tileAssets.ts) を使い、
 * 全4方向 × 3状態（立牌/倒牌/横倒し）のスプライトを生成する。
 *
 * 旧 selfTile.ts / shimochaTile.ts / toimenTile.ts / kamichaTile.ts を置き換える。
 * レンダラーが期待する関数シグネチャをそのまま維持している。
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { TILE_ASPECT_RATIO } from "./constants";
import { getCachedFaceTexture, getCachedBackTexture } from "./tileAssets";

/** スプライト描画スケール（各辺10%余白） */
const SPRITE_SCALE = 0.8;

// ===== ヘルパー =====

/** 白背景の角丸矩形を生成する */
function whiteBg(w: number, h: number): Graphics {
  const g = new Graphics();
  const r = Math.min(w, h) * 0.06;
  g.fill(0xffffff);
  g.roundRect(0, 0, w, h, r);
  g.fill();
  return g;
}

/**
 * キャッシュ済みテクスチャから Sprite を生成する。
 * テクスチャが見つからない場合は空の Container を返す。
 */
function faceSprite(tileType: string, isRedDora: boolean): Sprite | null {
  const tex = getCachedFaceTexture(tileType, isRedDora);
  return tex ? new Sprite(tex) : null;
}

function backSprite(): Sprite | null {
  const tex = getCachedBackTexture();
  return tex ? new Sprite(tex) : null;
}

// ================================================================
//  自家 (bottom) — 画面手前、テクスチャそのまま
// ================================================================

/**
 * 自家の立牌（手牌）: 表面 faceW × faceH
 */
export function createSelfStandingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceW, faceH));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceW * (1 - SPRITE_SCALE) / 2;
    s.y = faceH * (1 - SPRITE_SCALE) / 2;
    container.addChild(s);
  }
  container.hitArea = { contains: (x, y) => x >= 0 && x <= faceW && y >= 0 && y <= faceH };
  return container;
}

/**
 * 自家の捨て牌（正位置）: 表面 faceW × faceH（手牌と同じ向き）
 */
export function createSelfDiscardTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceW, faceH));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceW * (1 - SPRITE_SCALE) / 2;
    s.y = faceH * (1 - SPRITE_SCALE) / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 自家の副露牌（正位置）: 表面/裏面 faceW × faceH
 * 暗槓の裏面牌にも対応（showFace=false で裏面表示）
 */
export function createSelfMeldTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  if (showFace) container.addChild(whiteBg(faceW, faceH));
  const s = showFace ? faceSprite(tileType, isRedDora) : backSprite();
  const scale = showFace ? SPRITE_SCALE : 1;
  if (s) {
    s.width = faceW * scale;
    s.height = faceH * scale;
    s.x = faceW * (1 - scale) / 2;
    s.y = faceH * (1 - scale) / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 自家の副露鳴き牌（正位置左90°回転）: 表面 faceH × faceW
 */
export function createSelfMeldCalledTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceH, faceW));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = -Math.PI / 2;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 自家の倒牌（河/副露）: 表面 faceH × faceW（横倒し）
 */
export function createSelfLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  if (showFace) container.addChild(whiteBg(faceH, faceW));
  const s = showFace ? faceSprite(tileType, isRedDora) : backSprite();
  const scale = showFace ? SPRITE_SCALE : 1;
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = -Math.PI / 2;
    s.width = faceW * scale;
    s.height = faceH * scale;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 自家の横倒し（リーチ宣言牌/鳴き元）: 表面 faceH × faceW
 */
export function createSelfSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  return createSelfLyingTile(tileType, isRedDora, faceW, true);
}

// ================================================================
//  下家 (right) — 画面右側、90° 時計回り
// ================================================================

/**
 * 下家の立牌（手牌）: 裏面 faceH × faceW
 */
export function createShimochaStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  const s = backSprite();
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI / 2;
    s.width = faceW;
    s.height = faceH;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/** 下家の立牌サイド: 2Dでは不要（空） */
export function createShimochaStandingSide(_faceW: number): Container {
  return new Container();
}

/**
 * 下家の捨て牌（正位置左90°回転）: 表面 faceH × faceW
 */
export function createShimochaDiscardTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceH, faceW));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = -Math.PI / 2;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 下家のリーチ宣言牌（正位置180°回転）: 表面 faceW × faceH
 */
export function createShimochaRiichiTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceW, faceH));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceW / 2;
    s.y = faceH / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 下家の倒牌（河/副露）: 表面 faceW × faceH（90° 回転）
 */
export function createShimochaLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  if (showFace) container.addChild(whiteBg(faceW, faceH));
  const s = showFace ? faceSprite(tileType, isRedDora) : backSprite();
  const scale = showFace ? SPRITE_SCALE : 1;
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI / 2;
    s.width = faceW * scale;
    s.height = faceH * scale;
    s.x = faceW / 2;
    s.y = faceH / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 下家の横倒し: 表面 faceW × faceH（90° 回転）
 */
export function createShimochaSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  return createShimochaLyingTile(tileType, isRedDora, faceW, true);
}

// ================================================================
//  対面 (top) — 画面奥、180° 回転
// ================================================================

/**
 * 対面の立牌（手牌）: 裏面 faceW × faceH（180° 回転）
 */
export function createToimenStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  const s = backSprite();
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI;
    s.width = faceW;
    s.height = faceH;
    s.x = faceW / 2;
    s.y = faceH / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 対面の捨て牌（正位置180°回転）: 表面 faceW × faceH
 */
export function createToimenDiscardTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceW, faceH));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceW / 2;
    s.y = faceH / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 対面のリーチ宣言牌（正位置右90°回転）: 表面 faceH × faceW
 */
export function createToimenRiichiTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceH, faceW));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI / 2;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 対面の倒牌（河/副露）: 表面 faceH × faceW（180° + 横倒し）
 */
export function createToimenLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  if (showFace) container.addChild(whiteBg(faceH, faceW));
  const s = showFace ? faceSprite(tileType, isRedDora) : backSprite();
  const scale = showFace ? SPRITE_SCALE : 1;
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI / 2;
    s.width = faceW * scale;
    s.height = faceH * scale;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 対面の横倒し: 表面 faceH × faceW（180° + 横倒し）
 */
export function createToimenSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  return createToimenLyingTile(tileType, isRedDora, faceW, true);
}

// ================================================================
//  上家 (left) — 画面左側、-90° (270°) 回転
// ================================================================

/**
 * 上家の立牌（手牌）: 裏面 faceH × faceW（-90° 回転）
 */
export function createKamichaStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  const s = backSprite();
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = -Math.PI / 2;
    s.width = faceW;
    s.height = faceH;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/** 上家の立牌サイド: 2Dでは不要（空） */
export function createKamichaStandingSide(_faceW: number): Container {
  return new Container();
}

/**
 * 上家の捨て牌（正位置右90°回転）: 表面 faceH × faceW
 */
export function createKamichaDiscardTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceH, faceW));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = Math.PI / 2;
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceH / 2;
    s.y = faceW / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 上家のリーチ宣言牌（正位置）: 表面 faceW × faceH
 */
export function createKamichaRiichiTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  container.addChild(whiteBg(faceW, faceH));
  const s = faceSprite(tileType, isRedDora);
  if (s) {
    s.width = faceW * SPRITE_SCALE;
    s.height = faceH * SPRITE_SCALE;
    s.x = faceW * (1 - SPRITE_SCALE) / 2;
    s.y = faceH * (1 - SPRITE_SCALE) / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 上家の倒牌（河/副露）: 表面 faceW × faceH（-90° 回転）
 */
export function createKamichaLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const container = new Container();
  if (showFace) container.addChild(whiteBg(faceW, faceH));
  const s = showFace ? faceSprite(tileType, isRedDora) : backSprite();
  const scale = showFace ? SPRITE_SCALE : 1;
  if (s) {
    s.anchor.set(0.5, 0.5);
    s.rotation = -Math.PI / 2;
    s.width = faceW * scale;
    s.height = faceH * scale;
    s.x = faceW / 2;
    s.y = faceH / 2;
    container.addChild(s);
  }
  return container;
}

/**
 * 上家の横倒し: 表面 faceW × faceH（-90° 回転）
 */
export function createKamichaSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  return createKamichaLyingTile(tileType, isRedDora, faceW, true);
}
