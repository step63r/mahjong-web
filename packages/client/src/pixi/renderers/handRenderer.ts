/**
 * 手牌レンダリング — 4方向の手牌コンテナを更新する
 */
import type { Container } from "pixi.js";
import type { BoardLayout } from "../layout";
import type { PlayerViewState, TileData } from "../../types";
import {
  createSelfStandingTile,
  createShimochaStandingTile,
  createToimenStandingTile,
  createKamichaStandingTile,
  createShimochaDiscardTile,
  createToimenDiscardTile,
  createKamichaDiscardTile,
} from "../tiles/flatTile";

// ===== 選択状態の視覚フィードバック =====

const SELECTED_LIFT_Y = -8;
/** リーチモード中、候補外の牌の不透明度 */
const DIMMED_ALPHA = 0.35;

// ===== メイン =====

/**
 * 4方向の手牌コンテナを更新する
 *
 * @param hands [self, shimocha, toimen, kamicha] のコンテナ
 * @param layout 盤面レイアウト
 * @param players 4方向のプレイヤービュー
 * @param selectedTileIndex 自家の選択中の牌インデックス（undefined なら未選択）
 * @param onTileClick 牌クリックコールバック
 * @param riichiCandidateIndices リーチモード中の候補牌インデックス集合（undefined ならリーチモードでない）
 */
export function updateHands(
  hands: [Container, Container, Container, Container],
  layout: BoardLayout,
  players: readonly PlayerViewState[],
  selectedTileIndex: number | undefined,
  onTileClick?: (index: number) => void,
  riichiCandidateIndices?: ReadonlySet<number>,
  revealedCounts?: readonly [number, number, number, number],
): void {
  renderSelfHand(hands[0], layout, players[0], selectedTileIndex, onTileClick, riichiCandidateIndices, revealedCounts?.[0]);
  renderOpponentHand(hands[1], layout, "shimocha", players[1], revealedCounts?.[1]);
  renderOpponentHand(hands[2], layout, "toimen", players[2], revealedCounts?.[2]);
  renderOpponentHand(hands[3], layout, "kamicha", players[3], revealedCounts?.[3]);
}

// ===== 自家の手牌 =====

function renderSelfHand(
  container: Container,
  layout: BoardLayout,
  player: PlayerViewState | undefined,
  selectedTileIndex: number | undefined,
  onTileClick?: (index: number) => void,
  riichiCandidateIndices?: ReadonlySet<number>,
  revealedCount?: number,
): void {
  container.removeChildren();
  if (!player) return;

  const { tileW, faceH } = layout;
  const { origin, stride, tsumoGap } = layout.self.hand;
  const tiles = player.hand;
  const isRiichiMode = riichiCandidateIndices !== undefined;

  const handShowCount = revealedCount !== undefined ? Math.min(revealedCount, tiles.length) : tiles.length;

  // 通常手牌（13枚以下）
  for (let i = 0; i < handShowCount; i++) {
    const tile = tiles[i];
    const sprite = createSelfStandingTile(tile.type, tile.isRedDora, tileW);
    sprite.x = origin.x + stride.x * i;
    sprite.y = origin.y + stride.y * i;

    // 選択中なら浮き上がり
    if (selectedTileIndex === i) {
      sprite.y += SELECTED_LIFT_Y;
    }

    // リーチモード: 候補外の牌を暗くする
    if (isRiichiMode && !riichiCandidateIndices.has(i)) {
      sprite.alpha = DIMMED_ALPHA;
    }

    // クリックインタラクション
    // リーチモード中は候補牌のみクリック可能
    const clickable = onTileClick && (!isRiichiMode || riichiCandidateIndices.has(i));
    if (clickable) {
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      const idx = i;
      sprite.on("pointertap", () => onTileClick(idx));
    }

    container.addChild(sprite);
  }

  // ツモ牌（14枚目）
  if (player.drawnTile && (revealedCount === undefined || revealedCount > tiles.length)) {
    const dt = player.drawnTile;
    const tsumoIdx = tiles.length;
    const sprite = createSelfStandingTile(dt.type, dt.isRedDora, tileW);
    sprite.x = origin.x + stride.x * tsumoIdx + tsumoGap.x;
    sprite.y = origin.y + stride.y * tsumoIdx + tsumoGap.y;

    if (selectedTileIndex === tsumoIdx) {
      sprite.y += SELECTED_LIFT_Y;
    }

    // リーチモード: 候補外の牌を暗くする
    if (isRiichiMode && !riichiCandidateIndices.has(tsumoIdx)) {
      sprite.alpha = DIMMED_ALPHA;
    }

    // クリックインタラクション
    const clickable = onTileClick && (!isRiichiMode || riichiCandidateIndices.has(tsumoIdx));
    if (clickable) {
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      sprite.on("pointertap", () => onTileClick(tsumoIdx));
    }

    container.addChild(sprite);
  }
}

// ===== 他家の手牌 =====

type OpponentDirection = "shimocha" | "toimen" | "kamicha";

const STANDING_CREATORS: Record<OpponentDirection, (faceW: number) => Container> = {
  shimocha: createShimochaStandingTile,
  toimen: createToimenStandingTile,
  kamicha: createKamichaStandingTile,
};

/** 表向き（公開）手牌を捨て牌と同じ向きで描画する関数マップ */
const FACE_UP_CREATORS: Record<OpponentDirection, (tileType: string, isRedDora: boolean, faceW: number) => Container> = {
  shimocha: createShimochaDiscardTile,
  toimen: createToimenDiscardTile,
  kamicha: createKamichaDiscardTile,
};

function renderOpponentHand(
  container: Container,
  layout: BoardLayout,
  direction: OpponentDirection,
  player: PlayerViewState | undefined,
  revealedCount?: number,
): void {
  container.removeChildren();
  if (!player) return;

  const { tileW } = layout;
  const { origin, stride } = layout[direction].hand;
  const tileCount = player.hand.length;
  const showCount = revealedCount !== undefined ? Math.min(revealedCount, tileCount) : tileCount;
  const createBack = STANDING_CREATORS[direction];
  const createFace = FACE_UP_CREATORS[direction];

  for (let i = 0; i < showCount; i++) {
    const tile = player.hand[i];
    const isFaceUp = tile.type !== "back";
    const sprite = isFaceUp
      ? createFace(tile.type, tile.isRedDora, tileW)
      : createBack(tileW);
    sprite.x = origin.x + stride.x * i;
    sprite.y = origin.y + stride.y * i;
    container.addChild(sprite);
  }
}
