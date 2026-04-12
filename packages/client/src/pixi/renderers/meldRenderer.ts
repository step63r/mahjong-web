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
  createShimochaMeldTile, createShimochaMeldCalledTile,
  createToimenMeldTile, createToimenMeldCalledTile,
  createKamichaMeldTile, createKamichaMeldCalledTile,
} from "../tiles/flatTile";

// ===== 型 =====

type Direction = "self" | "shimocha" | "toimen" | "kamicha";

interface MeldTileCreators {
  lying: (type: string, isRed: boolean, faceW: number, showFace?: boolean) => Container;
  sideways: (type: string, isRed: boolean, faceW: number) => Container;
}

const CREATORS: Record<Direction, MeldTileCreators> = {
  self: { lying: createSelfMeldTile, sideways: createSelfMeldCalledTile },
  shimocha: { lying: createShimochaMeldTile, sideways: createShimochaMeldCalledTile },
  toimen: { lying: createToimenMeldTile, sideways: createToimenMeldCalledTile },
  kamicha: { lying: createKamichaMeldTile, sideways: createKamichaMeldCalledTile },
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

  // stride と直交する軸（横倒し牌の盤面端揃え補正に使用）
  // 自家: 下辺に揃える(+y), 下家: 右辺に揃える(+x)
  // 対面/上家: origin が盤面端(0)なので補正不要(0)
  const crossAxis: { x: number; y: number } =
    direction === "self" ? { x: 0, y: 1 } :
    direction === "shimocha" ? { x: 1, y: 0 } :
    { x: 0, y: 0 };

  // 副露セット間のギャップ
  const MELD_GAP = 0;

  // stride 軸上の累積位置
  let cursor = { x: 0, y: 0 };

  // 起家マーカー分のスペースを確保（盤面端に配置するため副露を内側にずらす）
  if (isDealer && player.melds.length > 0) {
    const markerSize = tileW;
    cursor.x += strideAxis.x * markerSize;
    cursor.y += strideAxis.y * markerSize;
  }

  for (let mi = 0; mi < player.melds.length; mi++) {
    const meld = player.melds[mi];
    const isAnkan = meld.meldType === "ankan";

    // セット間ギャップ
    if (mi > 0) {
      cursor.x += strideAxis.x * MELD_GAP;
      cursor.y += strideAxis.y * MELD_GAP;
    }

    // viewConverter は牌を視覚的な左→右順で配列する。
    // stride の正負に関わらず、プレイヤー右端(origin)から左へ描画するため
    // 配列の末尾(右端)を origin 側に配置する（reverseTileOrder=true）。
    // cursor の pre/post increment は stride の正負で決定する。
    const negativeStride = (strideAxis.x + strideAxis.y) < 0;
    const reverseTileOrder = true;

    for (let rawIdx = 0; rawIdx < meld.tiles.length; rawIdx++) {
      const ti = reverseTileOrder ? (meld.tiles.length - 1 - rawIdx) : rawIdx;
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
      if (negativeStride) {
        cursor.x += strideAxis.x * tileSize;
        cursor.y += strideAxis.y * tileSize;
      }

      sprite.x = origin.x + cursor.x;
      sprite.y = origin.y + cursor.y;

      // 横倒し牌は cross 軸方向のサイズが小さいため、盤面端に揃える
      if (isCalled) {
        const heightDiff = faceH - tileW;
        sprite.x += crossAxis.x * heightDiff;
        sprite.y += crossAxis.y * heightDiff;
      }

      container.addChild(sprite);

      // 正方向 stride: 配置後にカーソルを進める
      if (!negativeStride) {
        cursor.x += strideAxis.x * tileSize;
        cursor.y += strideAxis.y * tileSize;
      }
    }
  }

  // 起家表示マーカー（盤面端に固定配置）
  if (isDealer) {
    const markerSize = tileW;
    const marker = createDealerMarker(markerSize, roundWind, dirIndex);
    let mx = origin.x;
    let my = origin.y;
    // stride が負方向の場合、マーカーが canvas 外に出ないよう補正
    if (tileStride.y < 0) my -= markerSize;
    if (tileStride.x < 0) mx -= markerSize;
    // 自家: origin.y は faceH 基準なのでマーカー（tileW）を下辺に揃える
    if (direction === "self") my += faceH - markerSize;
    // 下家: lying牌がfaceH幅なのでマーカーを右辺に揃える
    if (direction === "shimocha") mx += faceH - markerSize;
    // 上家: lying牌がfaceH幅、マーカーは下辺かつ左辺に張り付く
    if (direction === "kamicha") my -= markerSize;
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
