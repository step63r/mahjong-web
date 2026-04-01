/**
 * 自家方向の2.5D牌スプライトを生成する関数群
 *
 * 立牌（手牌）: 表面が正面 + 上部面が奥行き（厚み30%）
 * 倒牌（河/副露）: 下部面が正面 + 表面が奥行き（厚み20%）
 */
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  TILE_FACE_COLOR,
  TILE_BACK_COLOR,
  TILE_BORDER_COLOR,
  TILE_ASPECT_RATIO,
  DEPTH_RATIO_SELF_HAND,
  DEPTH_RATIO_DEFAULT,
} from "./constants";
import { getCachedTileFaceTexture, getCachedTileBackTexture } from "./tileTexture";

// ===== 共通ヘルパー =====

/** 角丸の四角形パスを描画 */
function drawRoundedRect(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
  g.roundRect(x, y, w, h, r);
}

// ===== 自家の立牌（手牌） =====

/**
 * 自家の立牌を生成する
 *
 * 見え方:
 *   ┌─────────┐  ← 上部面（厚み = faceH * depthRatio）
 *   │  上部面  │     色 = TILE_BACK_COLOR（裏面色 = 厚み色）
 *   ├─────────┤
 *   │         │
 *   │  表面   │  ← メイン面（高さ = faceH）
 *   │         │
 *   └─────────┘
 *
 * @param tileType 牌の種類 (例: "man1", "ton")
 * @param isRedDora 赤ドラかどうか
 * @param faceW 表面の幅 (px)
 */
export function createSelfStandingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthH = faceH * DEPTH_RATIO_SELF_HAND;
  const totalH = depthH + faceH;
  const radius = faceW * 0.06;

  const container = new Container();

  // 上部面（厚み）
  const topFace = new Graphics();
  topFace.fill(TILE_BACK_COLOR);
  drawRoundedRect(topFace, 0, 0, faceW, depthH, radius);
  topFace.fill();
  topFace.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(topFace, 0, 0, faceW, depthH, radius);
  topFace.stroke();
  container.addChild(topFace);

  // 表面の背景
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  drawRoundedRect(faceBg, 0, depthH, faceW, faceH, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(faceBg, 0, depthH, faceW, faceH, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  // 表面のテクスチャ（絵柄）
  const tex = getCachedTileFaceTexture(tileType, isRedDora);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.x = 0;
    sprite.y = depthH;
    sprite.width = faceW;
    sprite.height = faceH;
    container.addChild(sprite);
  }

  // ヒット領域の設定
  container.hitArea = { contains: (x, y) => x >= 0 && x <= faceW && y >= 0 && y <= totalH };

  return container;
}

// ===== 自家の倒牌（河・副露） =====

/**
 * 自家の倒牌を生成する
 *
 * 見え方:
 *   ┌─────────────────┐
 *   │     表面         │  ← 表面（高さ = faceW, 横方向が牌の長辺）
 *   │  (テクスチャ)    │
 *   ├─────────────────┤
 *   │    下部面        │  ← 下部面（厚み = faceW * depthRatio）
 *   └─────────────────┘
 *
 * 倒牌は牌が寝ているため、表面の表示領域は (元の faceH × faceW) を横にした形。
 * lying の場合、正面が下部面で上に表面が見える。
 *
 * @param tileType 牌の種類
 * @param isRedDora 赤ドラかどうか
 * @param faceW 牌の表面の幅 (立牌時の短辺に相当)
 * @param showFace 表面を表示するか (暗槓の裏面牌では false)
 */
export function createSelfLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * 0.06;

  // 倒牌: 横長 = faceH が横幅、faceW が縦幅（表面部分）
  const lyingW = faceH;
  const lyingFaceH = faceW;
  const totalH = lyingFaceH + depthH;

  const container = new Container();

  // 表面（上部に表示）
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  drawRoundedRect(faceBg, 0, 0, lyingW, lyingFaceH, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(faceBg, 0, 0, lyingW, lyingFaceH, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  if (showFace) {
    const tex = getCachedTileFaceTexture(tileType, isRedDora);
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.x = 0;
      sprite.y = 0;
      sprite.width = lyingW;
      sprite.height = lyingFaceH;
      container.addChild(sprite);
    }
  } else {
    // 裏面表示（暗槓用）
    const backTex = getCachedTileBackTexture();
    if (backTex) {
      const sprite = new Sprite(backTex);
      sprite.x = 0;
      sprite.y = 0;
      sprite.width = lyingW;
      sprite.height = lyingFaceH;
      container.addChild(sprite);
    }
  }

  // 下部面（厚み）
  const bottomFace = new Graphics();
  bottomFace.fill(TILE_BACK_COLOR);
  drawRoundedRect(bottomFace, 0, lyingFaceH, lyingW, depthH, radius);
  bottomFace.fill();
  bottomFace.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(bottomFace, 0, lyingFaceH, lyingW, depthH, radius);
  bottomFace.stroke();
  container.addChild(bottomFace);

  return container;
}

/**
 * 自家の倒牌（横倒し=左90度回転）を生成する
 *
 * 副露中の鳴き元牌や立直宣言牌用。
 * 通常の倒牌を左90度回転した見え方。
 *
 * 見え方:
 *   ┌──────┬──────────┐
 *   │左側面│  表面     │
 *   │(厚み)│(テクスチャ)│
 *   └──────┴──────────┘
 *
 * @param tileType 牌の種類
 * @param isRedDora 赤ドラかどうか
 * @param faceW 牌の表面の幅 (立牌時の短辺)
 */
export function createSelfSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthW = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * 0.06;

  // 横倒し: 左に厚み面、右に表面
  const lyingFaceW = faceW;       // 表面の幅（立牌時の短辺）
  const lyingFaceH = faceH;       // 表面の高さ → ここでは横方向に使うが、
  // 横倒しなので全体は: 幅 = depthW + faceH, 高さ = faceW

  const container = new Container();

  // 左側面（厚み）
  const sideG = new Graphics();
  sideG.fill(TILE_BACK_COLOR);
  drawRoundedRect(sideG, 0, 0, depthW, lyingFaceW, radius);
  sideG.fill();
  sideG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(sideG, 0, 0, depthW, lyingFaceW, radius);
  sideG.stroke();
  container.addChild(sideG);

  // 表面
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  drawRoundedRect(faceBg, depthW, 0, lyingFaceH, lyingFaceW, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  drawRoundedRect(faceBg, depthW, 0, lyingFaceH, lyingFaceW, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  const tex = getCachedTileFaceTexture(tileType, isRedDora);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.x = depthW;
    sprite.y = 0;
    sprite.width = lyingFaceH;
    sprite.height = lyingFaceW;
    container.addChild(sprite);
  }

  return container;
}
