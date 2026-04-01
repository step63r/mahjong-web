/**
 * 上家（左側）方向の2.5D牌スプライトを生成する関数群
 *
 * 上家の副露・捨て牌は下家の左右180度回転で表示される。
 *
 * 立牌（手牌）: 右側面が正面 + 上部面が奥行き（20%）
 * 倒牌（河/副露）: 右側面が正面 + 表面が左に見える（20%）— 下家の左右反転
 * 横倒し: 下部面が正面 + 表面が上に見える（20%）— 下家の左右反転
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

// ===== 上家の立牌（手牌） =====

/**
 * 上家の立牌: 右側面が正面 + 上部面が奥行き
 *
 * 盤面上では上→下方向に牌が並ぶ（下家と逆順）。
 * 個々の牌は上部面のみ描画（下家の立牌と同じ考え方、ただし右側面が先頭牌用）。
 *
 * @param faceW 基準の牌幅
 */
export function createKamichaStandingTile(faceW: number): Container {
  const faceH = faceW * TILE_ASPECT_RATIO;
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  // 上部面: 幅 = faceH, 高さ = depthH
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
 * 上家の立牌の右側面（先頭牌用の追加パーツ）
 * 手牌列の右端（画面上で一番上の牌）にだけ付加する。
 */
export function createKamichaStandingSide(faceW: number): Container {
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

// ===== 上家の倒牌（河・副露） =====

/**
 * 上家の倒牌: 右側面が正面 + 表面が左に見える（下家の左右反転）
 *
 * 見え方:
 *   ┌──────┬────┐
 *   │ 表面 │右側│
 *   │      │ 面 │
 *   └──────┴────┘
 *   幅 = faceW + depthW, 高さ = faceH
 *
 * 下家の倒牌を左右反転 → テクスチャを左右反転で配置
 */
export function createKamichaLyingTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
  showFace = true,
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

  if (showFace) {
    const tex = getCachedTileFaceTexture(tileType, isRedDora);
    if (tex) {
      const sprite = new Sprite(tex);
      // 左右反転: scaleX = -1
      sprite.anchor.set(0.5, 0.5);
      sprite.scale.x = -1;
      sprite.x = faceW / 2;
      sprite.y = faceH / 2;
      sprite.width = faceW;
      sprite.height = faceH;
      container.addChild(sprite);
    }
  } else {
    const backTex = getCachedTileBackTexture();
    if (backTex) {
      const sprite = new Sprite(backTex);
      sprite.anchor.set(0.5, 0.5);
      sprite.scale.x = -1;
      sprite.x = faceW / 2;
      sprite.y = faceH / 2;
      sprite.width = faceW;
      sprite.height = faceH;
      container.addChild(sprite);
    }
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

// ===== 上家の横倒し（立直宣言牌・鳴き元） =====

/**
 * 上家の横倒し: 下部面が正面 + 表面が上に見える（下家の横倒しの左右反転）
 *
 * 見え方:
 *   ┌───────────┐
 *   │  表面     │  高さ = faceW
 *   ├───────────┤
 *   │  下部面   │  高さ = depthH
 *   └───────────┘
 *   幅 = faceW, 全高 = faceW + depthH
 *
 * 下家の横倒しを左右反転 → テクスチャを左右反転
 */
export function createKamichaSidewaysTile(
  tileType: string,
  isRedDora: boolean,
  faceW: number,
): Container {
  const depthH = faceW * DEPTH_RATIO_DEFAULT;
  const radius = faceW * R_RATIO;

  const container = new Container();

  // 表面（上部に表示）
  const faceBg = new Graphics();
  faceBg.fill(TILE_FACE_COLOR);
  faceBg.roundRect(0, 0, faceW, faceW, radius);
  faceBg.fill();
  faceBg.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  faceBg.roundRect(0, 0, faceW, faceW, radius);
  faceBg.stroke();
  container.addChild(faceBg);

  const tex = getCachedTileFaceTexture(tileType, isRedDora);
  if (tex) {
    const sprite = new Sprite(tex);
    // 左右反転
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.x = -1;
    sprite.x = faceW / 2;
    sprite.y = faceW / 2;
    sprite.width = faceW;
    sprite.height = faceW;
    container.addChild(sprite);
  }

  // 下部面（厚み）
  const bottomG = new Graphics();
  bottomG.fill(TILE_BACK_COLOR);
  bottomG.roundRect(0, faceW, faceW, depthH, radius);
  bottomG.fill();
  bottomG.stroke({ color: TILE_BORDER_COLOR, width: 0.5 });
  bottomG.roundRect(0, faceW, faceW, depthH, radius);
  bottomG.stroke();
  container.addChild(bottomG);

  return container;
}
