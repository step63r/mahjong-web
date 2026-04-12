/**
 * 捨て牌（河）レンダリング — 4方向の捨て牌コンテナを更新する
 *
 * 1行6枚、最大4行。リーチ宣言牌は横倒し（sideways）で配置する。
 */
import type { Container } from "pixi.js";
import type { BoardLayout, DirectionLayout } from "../layout";
import type { PlayerViewState, DiscardEntryData } from "../../types";
import { DISCARD_TILES_PER_ROW } from "../tiles/constants";

import {
  createSelfLyingTile, createSelfSidewaysTile,
  createSelfDiscardTile,
  createShimochaLyingTile, createShimochaSidewaysTile,
  createShimochaDiscardTile, createShimochaRiichiTile,
  createToimenLyingTile, createToimenSidewaysTile,
  createToimenDiscardTile, createToimenRiichiTile,
  createKamichaLyingTile, createKamichaSidewaysTile,
  createKamichaDiscardTile, createKamichaRiichiTile,
} from "../tiles/flatTile";

// ===== 方向ごとの牌生成マップ =====

type Direction = "self" | "shimocha" | "toimen" | "kamicha";

interface TileCreators {
  lying: (type: string, isRed: boolean, faceW: number) => Container;
  sideways: (type: string, isRed: boolean, faceW: number) => Container;
}

const CREATORS: Record<Direction, TileCreators> = {
  self: { lying: createSelfDiscardTile, sideways: createSelfSidewaysTile },
  shimocha: { lying: createShimochaDiscardTile, sideways: createShimochaRiichiTile },
  toimen: { lying: createToimenDiscardTile, sideways: createToimenRiichiTile },
  kamicha: { lying: createKamichaDiscardTile, sideways: createKamichaRiichiTile },
};

// ===== 横倒し牌のサイズ差分を方向ごとに取得 =====

/**
 * sideways 牌は lying 牌と stride 軸方向のサイズが異なる。
 * その差分（sideways が lying より大きい分）を返す。
 *
 * 自家/対面: stride は横方向(x)。lyingW = faceH, sidewaysW = depthW + faceH → 差 =  depthW
 *            ただし自家 sideways は (depthW + faceH) 幅で、lying は faceH 幅。差 = depthW
 * 下家/上家: stride は縦方向(y)。lyingH = faceH, sidewaysH = depthH + faceW → 差は方向依存
 *
 * 簡易計算: sideways牌の stride 軸サイズ - lying牌の stride 軸サイズ
 */
function getSidewaysExtraSize(direction: Direction, tileW: number, faceH: number, _depthDefault: number): { dx: number; dy: number } {
  // 2D フラット: lying と sideways のサイズは同じなので差分は 0
  void tileW;
  void faceH;
  switch (direction) {
    case "self":
      return { dx: faceH - tileW, dy: 0 };
    case "toimen":
      return { dx: -(faceH - tileW), dy: 0 };
    case "shimocha":
      return { dx: 0, dy: -(faceH - tileW) };
    case "kamicha":
      return { dx: 0, dy: faceH - tileW };
  }
}

// ===== メイン =====

/**
 * 4方向の捨て牌コンテナを更新する
 */
export function updateDiscards(
  discards: [Container, Container, Container, Container],
  layout: BoardLayout,
  players: readonly PlayerViewState[],
): void {
  const dirs: Direction[] = ["self", "shimocha", "toimen", "kamicha"];
  for (let i = 0; i < 4; i++) {
    renderDiscardArea(discards[i], layout, dirs[i], players[i]);
  }
}

function renderDiscardArea(
  container: Container,
  layout: BoardLayout,
  direction: Direction,
  player: PlayerViewState | undefined,
): void {
  container.removeChildren();
  if (!player) return;

  const { tileW, faceH, depthDefault } = layout;
  const dl = layout[direction].discard;
  const { lying, sideways } = CREATORS[direction];
  const entries = player.discards;
  const extra = getSidewaysExtraSize(direction, tileW, faceH, depthDefault);

  // stride軸の累積オフセット（横倒し牌のサイズ差分を蓄積）
  let cumulativeExtra = { x: 0, y: 0 };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = Math.floor(i / DISCARD_TILES_PER_ROW);
    const col = i % DISCARD_TILES_PER_ROW;

    // 行の先頭で累積差分をリセット
    if (col === 0) {
      cumulativeExtra = { x: 0, y: 0 };
    }

    const isRiichi = entry.isRiichi || entry.isRiichiRotated;
    const tile = entry.tile;

    const sprite = isRiichi
      ? sideways(tile.type, tile.isRedDora, tileW)
      : lying(tile.type, tile.isRedDora, tileW);

    sprite.x =
      dl.origin.x +
      dl.stride.x * col +
      dl.rowOffset.x * row +
      cumulativeExtra.x;

    sprite.y =
      dl.origin.y +
      dl.stride.y * col +
      dl.rowOffset.y * row +
      cumulativeExtra.y;

    // 負方向 stride の横倒し牌は前の牌に重なるため、自身の位置も補正する
    if (isRiichi) {
      if (extra.dx < 0) sprite.x += extra.dx;
      if (extra.dy < 0) sprite.y += extra.dy;
    }

    container.addChild(sprite);

    // 横倒し牌の場合、後続牌の位置をずらす
    if (isRiichi) {
      cumulativeExtra.x += extra.dx;
      cumulativeExtra.y += extra.dy;
    }
  }
}
