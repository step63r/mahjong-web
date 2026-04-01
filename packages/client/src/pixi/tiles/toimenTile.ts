/**
 * 対面（向かい側）方向の2.5D牌スプライトを生成する関数群
 *
 * 対面の副露・捨て牌は自家の上下180度回転で表示される。
 *
 * 立牌（手牌）: 裏面が正面 + 上部面が奥行き（20%）
 * 倒牌（河/副露）: 上部面が正面 + 表面が奥行き（20%）— 自家の倒牌を180度回転
 * 横倒し: 右側面が正面 + 表面が奥行き（20%）— 自家の横倒しを180度回転
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

// ===== 対面の立牌（手牌） =====

/**
 * 対面の立牌: 裏面が正面 + 上部面が奥行き
 *
 * 見え方:
 *   ┌─────────┐
 *   │ 上部面  │  高さ = depthH
 *   ├─────────┤
 *   │ 裏面    │  高さ = faceH
 *   └─────────┘
 *   幅 = faceW
 */
export function createToimenStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
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

  // 裏面
  const backG = new Graphics();
  backG.fill(TILE_BACK_COLOR);
  backG.roundRect(0, depthH, faceW, faceH, radius);
  backG.fill();
  backG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  backG.roundRect(0, depthH, faceW, faceH, radius);
  backG.stroke();
  container.addChild(backG);

  const backTex = getCachedTileBackTexture();
  if (backTex) {
    const sprite = new Sprite(backTex);
    sprite.x = 0;
    sprite.y = depthH;
    sprite.width = faceW;
    sprite.height = faceH;
    container.addChild(sprite);
  }

  return container;
}

// ===== 対面の倒牌（河・副露） =====

/**
 * 対面の倒牌: 上部面が正面 + 表面が下に見える（自家の倒牌を180度回転）
 *
 * 見え方:
 *   ┌─────────────────┐
 *   │    上部面        │  高さ = depthH （正面=厚み色）
 *   ├─────────────────┤
 *   │     表面         │  高さ = faceW （牌が横に寝ている）
 *   └─────────────────┘
 *   幅 = faceH（牌の長辺が横）
 *
 * 自家の倒牌を180度回転 → テクスチャも180度回転して配置
 */
export function createToimenLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const lyingW = faceH;
  const lyingFaceH = faceW;

  const container = new Container();

  // 上部面（厚み — 正面）
  const topG = new Graphics();
  topG.fill(TILE_BACK_COLOR);
  topG.roundRect(0, 0, lyingW, depthH, radius);
  topG.fill();
  topG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  topG.roundRect(0, 0, lyingW, depthH, radius);
  topG.stroke();
  container.addChild(topG);

  // 表面（下部に見える）
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  faceBg.roundRect(0, depthH, lyingW, lyingFaceH, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  faceBg.roundRect(0, depthH, lyingW, lyingFaceH, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  if (showFace) {
    const tex = getCachedTileFaceTexture(tileType, isRedDora);
    if (tex) {
      const sprite = new Sprite(tex);
      // 180度回転: 自家の倒牌と上下反転
      sprite.anchor.set(0.5, 0.5);
      sprite.rotation = Math.PI;
      sprite.x = lyingW / 2;
      sprite.y = depthH + lyingFaceH / 2;
      sprite.width = lyingW;
      sprite.height = lyingFaceH;
      container.addChild(sprite);
    }
  } else {
    const backTex = getCachedTileBackTexture();
    if (backTex) {
      const sprite = new Sprite(backTex);
      sprite.anchor.set(0.5, 0.5);
      sprite.rotation = Math.PI;
      sprite.x = lyingW / 2;
      sprite.y = depthH + lyingFaceH / 2;
      sprite.width = lyingW;
      sprite.height = lyingFaceH;
      container.addChild(sprite);
    }
  }

  return container;
}

// ===== 対面の横倒し（立直宣言牌・鳴き元） =====

/**
 * 対面の横倒し: 右側面が正面 + 表面が左に見える（自家の横倒しを180度回転）
 *
 * 見え方:
 *   ┌──────┬────┐
 *   │ 表面 │右側│
 *   │      │ 面 │
 *   └──────┴────┘
 *   幅 = faceW + depthW, 高さ = faceH
 *
 * 自家の横倒しを180度回転 → 表面テクスチャも180度回転
 */
export function createToimenSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthW = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const container = new Container();

  // 表面（左側に表示）
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  faceBg.roundRect(0, 0, faceW, faceH, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  faceBg.roundRect(0, 0, faceW, faceH, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  const tex = getCachedTileFaceTexture(tileType, isRedDora);
  if (tex) {
    const sprite = new Sprite(tex);
    // 180度回転
    sprite.anchor.set(0.5, 0.5);
    sprite.rotation = Math.PI;
    sprite.x = faceW / 2;
    sprite.y = faceH / 2;
    sprite.width = faceW;
    sprite.height = faceH;
    container.addChild(sprite);
  }

  // 右側面（厚み）
  const sideG = new Graphics();
  sideG.fill(TILE_BACK_COLOR);
  sideG.roundRect(faceW, 0, depthW, faceH, radius);
  sideG.fill();
  sideG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  sideG.roundRect(faceW, 0, depthW, faceH, radius);
  sideG.stroke();
  container.addChild(sideG);

  return container;
}
