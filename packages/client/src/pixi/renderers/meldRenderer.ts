/**
 * 副露レンダリング — 4方向の副露コンテナを更新する
 *
 * viewConverter が既に calledTileIndex（横倒し位置）を算出済み。
 * 暗槓は両端が裏面（showFace=false）。
 * 起家表示マーカーも副露領域に配置する。
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { BoardLayout } from "../layout";
import type { PlayerViewState, MeldViewData, TileData } from "../../types";
import {
  DEALER_MARKER_BG,
  DEALER_MARKER_TEXT,
  TILE_ASPECT_RATIO,
} from "../tiles/constants";

import {
  createSelfLyingTile, createSelfSidewaysTile,
  createSelfMeldTile, createSelfMeldCalledTile,
  createShimochaLyingTile, createShimochaSidewaysTile,
  createToimenLyingTile, createToimenSidewaysTile,
  createKamichaLyingTile, createKamichaSidewaysTile,
} from "../tiles/flatTile";

// ===== 型 =====

type Direction = "self" | "shimocha" | "toimen" | "kamicha";

interface MeldTileCreators {
  lying: (type: string, isRed: boolean, faceW: number, showFace?: boolean) => Container;
  sideways: (type: string, isRed: boolean, faceW: number) => Container;
}

const CREATORS: Record<Direction, MeldTileCreators> = {
  self: { lying: createSelfMeldTile, sideways: createSelfMeldCalledTile },
  shimocha: { lying: createShimochaLyingTile, sideways: createShimochaSidewaysTile },
  toimen: { lying: createToimenLyingTile, sideways: createToimenSidewaysTile },
  kamicha: { lying: createKamichaLyingTile, sideways: createKamichaSidewaysTile },
};

// ===== メイン =====

/**
 * 4方向の副露コンテナを更新する
 */
export function updateMelds(
  melds: [Container, Container, Container, Container],
  layout: BoardLayout,
  players: readonly PlayerViewState[],
  dealerIndex: number | undefined,
  roundWind: string,
): void {
  const dirs: Direction[] = ["self", "shimocha", "toimen", "kamicha"];
  for (let i = 0; i < 4; i++) {
    renderMeldArea(melds[i], layout, dirs[i], players[i], i === dealerIndex, roundWind, i);
  }
}

// ===== 1方向の副露描画 =====

function renderMeldArea(
  container: Container,
  layout: BoardLayout,
  direction: Direction,
  player: PlayerViewState | undefined,
  isDealer: boolean,
  roundWind: string,
  dirIndex: number,
): void {
  container.removeChildren();
  if (!player) return;

  const { tileW, faceH } = layout;
  const { origin, tileStride } = layout[direction].meld;
  const { lying, sideways } = CREATORS[direction];

  // stride 方向の単位ベクトル（正規化）
  const strideAxis = tileStride.x !== 0
    ? { x: Math.sign(tileStride.x), y: 0 }
    : { x: 0, y: Math.sign(tileStride.y) };

  // stride と直交する軸（横倒し牌の下揃え補正に使用）
  // 自家: stride=x軸, cross=y軸(下揃え → +方向)
  const crossAxis = strideAxis.x !== 0
    ? { x: 0, y: 1 }
    : { x: 1, y: 0 };

  // 副露セット間のギャップ
  const MELD_GAP = 20;

  // stride 軸上の累積位置
  let cursor = { x: 0, y: 0 };

  for (let mi = 0; mi < player.melds.length; mi++) {
    const meld = player.melds[mi];
    const isAnkan = meld.meldType === "ankan";

    // セット間ギャップ
    if (mi > 0) {
      cursor.x += strideAxis.x * MELD_GAP;
      cursor.y += strideAxis.y * MELD_GAP;
    }

    // viewConverter は牌を視覚的な左→右順で配列する。
    // stride が負方向（右→左 / 下→上）の場合、描画順を逆にして一致させる。
    const reverseOrder = (strideAxis.x + strideAxis.y) < 0;

    for (let rawIdx = 0; rawIdx < meld.tiles.length; rawIdx++) {
      const ti = reverseOrder ? (meld.tiles.length - 1 - rawIdx) : rawIdx;
      const tile = meld.tiles[ti];
      const isCalled = ti === meld.calledTileIndex;

      // 暗槓: 両端(index 0, 3)は裏面
      const showFace = isAnkan ? (ti === 1 || ti === 2) : true;

      let sprite: Container;
      if (isCalled) {
        sprite = sideways(tile.type, tile.isRedDora, tileW);
      } else {
        sprite = lying(tile.type, tile.isRedDora, tileW, showFace);
      }

      // 牌の stride 軸サイズ
      const tileSize = isCalled ? faceH : tileW;

      // 負方向 stride: 先にカーソルを進めてから配置（異サイズ牌の隙間防止）
      if (reverseOrder) {
        cursor.x += strideAxis.x * tileSize;
        cursor.y += strideAxis.y * tileSize;
      }

      sprite.x = origin.x + cursor.x;
      sprite.y = origin.y + cursor.y;

      // 横倒し牌は高さが tileW (< faceH) なので、正位置牌の下端に揃える
      if (isCalled) {
        const heightDiff = faceH - tileW;
        sprite.x += crossAxis.x * heightDiff;
        sprite.y += crossAxis.y * heightDiff;
      }

      container.addChild(sprite);

      // 正方向 stride: 配置後にカーソルを進める
      if (!reverseOrder) {
        cursor.x += strideAxis.x * tileSize;
        cursor.y += strideAxis.y * tileSize;
      }
    }
  }

  // 起家表示マーカー
  if (isDealer) {
    const markerSize = tileW;
    const marker = createDealerMarker(markerSize, roundWind, dirIndex);
    let mx = origin.x + cursor.x;
    let my = origin.y + cursor.y;
    // stride が負方向の場合、マーカーが canvas 外に出ないよう補正
    if (tileStride.y < 0) my -= markerSize;
    if (tileStride.x < 0) mx -= markerSize;
    marker.x = mx;
    marker.y = my;
    container.addChild(marker);
  }
}

// ===== 起家表示マーカー =====

// 各方向の回転角度: 自家=0, 下家=-90, 対面=180, 上家=90 (度)
const MARKER_ROTATIONS = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

function createDealerMarker(size: number, roundWind: string, dirIndex: number): Container {
  const container = new Container();

  const bg = new Graphics();
  bg.fill(DEALER_MARKER_BG);
  bg.roundRect(0, 0, size, size, size * 0.1);
  bg.fill();
  container.addChild(bg);

  const windChar = roundWind === "ton" ? "東" : "南";
  const style = new TextStyle({
    fontFamily: "sans-serif",
    fontSize: size * 0.6,
    fill: DEALER_MARKER_TEXT,
    fontWeight: "bold",
    align: "center",
  });
  const text = new Text({ text: windChar, style });
  text.anchor.set(0.5, 0.5);
  text.x = size / 2;
  text.y = size / 2;
  text.rotation = MARKER_ROTATIONS[dirIndex] ?? 0;
  container.addChild(text);

  return container;
}
