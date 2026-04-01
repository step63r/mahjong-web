/**
 * 下家（右側）方向の2.5D牌スプライトを生成する関数群
 *
 * 立牌（手牌）: 左側面が正面 + 上部面が奥行き（20%）
 *   → 表面は見えない（裏向き）。ほぼ上部だけが見え、左端牌の左側面がわずかに見える。
 * 倒牌（河/副露）: 左側面が正面 + 表面が奥行き（20%）
 * 横倒し: 上部が正面 + 表面が奥行き（20%）
 */
import { Container, Graphics, Sprite } from "pixi.js";
import {
  TILE_FACE_COLOR,
  TILE_BACK_COLOR,
  TILE_BORDER_COLOR,
  TILE_ASPECT_RATIO,
  DEPTH_RATIO_DEFAULT,
} from "./constants";
import { getCachedTileFaceTexture, getCachedTileBackTexture } from "./tileTexture";

const R_RATIO = 0.06;

// ===== 下家の立牌（手牌） =====

/**
 * 下家の立牌: 上部面が主に見え、左側面がわずかに見える。表面は見えない。
 *
 * 盤面上では上→下方向に牌が並ぶ。
 * 個々の牌は:
 *   幅 = faceH（牌の長辺＝上部面の長さ）
 *   高さ = depthH（厚み＝上部面の短辺）+ sideW（左側面の幅）
 *
 * ただし左側面はほとんど見えないため sideW を小さくする。
 * ここでは「先頭牌のみ左側面を描画」は上位レンダラーで制御し、
 * この関数は1枚分として上部面のみ描画する。
 *
 * @param faceW 基準の牌幅（自家立牌と同じ基準）
 */
export function createShimochaStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  // 上部面: 幅 = faceH, 高さ = depthH
  // 色は TILE_BACK_COLOR（厚み色=裏面色）
  const container = new Container();

  const topFace = new Graphics();
  topFace.fill(TILE_BACK_COLOR);
  topFace.roundRect(0, 0, faceH, depthH, radius);
  topFace.fill();
  topFace.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  topFace.roundRect(0, 0, faceH, depthH, radius);
  topFace.stroke();
  container.addChild(topFace);

  return container;
}

/**
 * 下家の立牌の左側面（先頭牌用の追加パーツ）
 * 手牌列の左端（画面上で一番下の牌）にだけ付加する。
 */
export function createShimochaStandingSide(faceW: number): Container {
  const depthW = faceW * DEPTH_RATIO_DEFAULT;
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const container = new Container();

  const sideG = new Graphics();
  sideG.fill(TILE_BACK_COLOR);
  sideG.roundRect(0, 0, depthW, depthH, radius);
  sideG.fill();
  sideG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  sideG.roundRect(0, 0, depthW, depthH, radius);
  sideG.stroke();
  container.addChild(sideG);

  return container;
}

// ===== 下家の倒牌（河・副露） =====

/**
 * 下家の倒牌: 左側面が正面 + 表面が右に見える（20%）
 *
 * 見え方（画面上での配置）:
 *   ┌────┬──────┐
 *   │左側│ 表面 │  ← 左側面(depthW) + 表面(faceW)
 *   │ 面 │      │
 *   └────┴──────┘
 *   幅 = depthW + faceW, 高さ = faceH（牌の長辺が縦）
 *
 * ただし下家の河は下→上方向に並ぶため、
 * このコンポーネント自体は「左側面+表面」を横に並べた形。
 */
export function createShimochaLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthW = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const container = new Container();

  // 左側面（厚み）
  const sideG = new Graphics();
  sideG.fill(TILE_BACK_COLOR);
  sideG.roundRect(0, 0, depthW, faceH, radius);
  sideG.fill();
  sideG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  sideG.roundRect(0, 0, depthW, faceH, radius);
  sideG.stroke();
  container.addChild(sideG);

  // 表面
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  faceBg.roundRect(depthW, 0, faceW, faceH, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  faceBg.roundRect(depthW, 0, faceW, faceH, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  if (showFace) {
    const tex = getCachedTileFaceTexture(tileType, isRedDora);
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.x = depthW;
      sprite.y = 0;
      sprite.width = faceW;
      sprite.height = faceH;
      container.addChild(sprite);
    }
  } else {
    const backTex = getCachedTileBackTexture();
    if (backTex) {
      const sprite = new Sprite(backTex);
      sprite.x = depthW;
      sprite.y = 0;
      sprite.width = faceW;
      sprite.height = faceH;
      container.addChild(sprite);
    }
  }

  return container;
}

// ===== 下家の横倒し（立直宣言牌・鳴き元） =====

/**
 * 下家の横倒し: 上部が正面 + 表面が下に見える
 *
 * 見え方:
 *   ┌───────────┐
 *   │  上部面   │  高さ = depthH
 *   ├───────────┤
 *   │  表面     │  高さ = faceW
 *   └───────────┘
 *   幅 = faceW, 全高 = depthH + faceW
 */
export function createShimochaSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const container = new Container();

  // 上部面（厚み）
  const topG = new Graphics();
  topG.fill(TILE_BACK_COLOR);
  topG.roundRect(0, 0, faceW, depthH, radius);
  topG.fill();
  topG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  topG.roundRect(0, 0, faceW, depthH, radius);
  topG.stroke();
  container.addChild(topG);

  // 表面
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  faceBg.roundRect(0, depthH, faceW, faceW, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  faceBg.roundRect(0, depthH, faceW, faceW, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  const tex = getCachedTileFaceTexture(tileType, isRedDora);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.x = 0;
    sprite.y = depthH;
    sprite.width = faceW;
    sprite.height = faceW;
    container.addChild(sprite);
  }

  return container;
}
