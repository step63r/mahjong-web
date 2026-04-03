/**
 * 盤面レイアウト計算ユーティリティ
 *
 * 720×720 の盤面上で牌・情報パネル・手牌・捨て牌・副露の配置座標を算出する。
 * 制約: 情報パネルの1辺 = 6 × tileW（牌の表面幅）
 */
import {
  BOARD_SIZE,
  TILE_ASPECT_RATIO,
  TSUMO_GAP,
  DISCARD_TILES_PER_ROW,
} from "./tiles/constants";

// ===== 型定義 =====

export interface Point {
  x: number;
  y: number;
}

export interface DirectionLayout {
  /** 手牌配置 */
  hand: {
    /** 牌0（最初の牌）の左上座標 */
    origin: Point;
    /** 牌 i → 牌 i+1 のオフセット */
    stride: Point;
    /** 最後の手牌からツモ牌までの追加オフセット（方向のみ、GAP含む） */
    tsumoGap: Point;
  };
  /** 捨て牌配置 */
  discard: {
    /** 行0牌0の左上座標（情報パネル寄り） */
    origin: Point;
    /** 同一行内: 牌 i → 牌 i+1 のオフセット */
    stride: Point;
    /** 行 n → 行 n+1 のオフセット（情報パネルから離れる方向） */
    rowOffset: Point;
  };
  /** 副露配置 */
  meld: {
    /** 最初の副露牌の基準座標（プレイヤーの右端寄り） */
    origin: Point;
    /** 倒牌1枚分の積み方向（プレイヤーの左方向へ） */
    tileStride: Point;
  };
}

export interface BoardLayout {
  /** 牌の表面幅 (px) */
  tileW: number;
  /** 牌の表面高さ = tileW × 4/3 */
  faceH: number;
  /** 自家手牌の厚み = faceH × 0.3 */
  depthSelf: number;
  /** 標準厚み = tileW × 0.2 */
  depthDefault: number;
  /** 情報パネル */
  infoPanel: { x: number; y: number; size: number };
  self: DirectionLayout;
  shimocha: DirectionLayout;
  toimen: DirectionLayout;
  kamicha: DirectionLayout;
}

// ===== 定数 =====

const HAND_TILES = 13;
const PADDING = 4;

// ===== 算出関数 =====

/**
 * 盤面サイズから全レイアウト情報を算出する
 */
export function calculateBoardLayout(boardSize = BOARD_SIZE): BoardLayout {
  // --- tileW 導出 (2D フラット) ---
  // (boardSize - 6*tileW) / 2 ≥ 4*lyingH + standH + PADDING
  // lyingH = tileW（厚みなし）
  // standH = TILE_ASPECT_RATIO * tileW = faceH
  const lyingCoeff = 4; // 4行分 × tileW
  const handCoeff = TILE_ASPECT_RATIO;
  const totalCoeff = lyingCoeff + handCoeff + 3; // 3 = infoPanelSide/2 / tileW
  const tileW = Math.floor((boardSize / 2 - PADDING) / totalCoeff);

  const faceH = tileW * TILE_ASPECT_RATIO;
  const depthSelf = 0;
  const depthDefault = 0;

  // --- 情報パネル ---
  const ipSide = 6 * tileW;
  const ipXY = (boardSize - ipSide) / 2;
  const ipRight = ipXY + ipSide;
  const ipBottom = ipXY + ipSide;

  // --- 共通サイズ (2D: 厚みなし) ---
  const lyingW = faceH; // 自家/対面 倒牌の横幅
  const lyingH = tileW; // 自家/対面 倒牌の高さ
  const sideLyingW = tileW; // 下家/上家 倒牌の横幅

  // --- 捨て牌エリアの中央揃え幅 ---
  const discardRowW = DISCARD_TILES_PER_ROW * lyingW;
  const discardRowH = DISCARD_TILES_PER_ROW * faceH; // 縦方向（下家/上家）
  const centerX = boardSize / 2;
  const centerY = boardSize / 2;

  // ================= 自家 (bottom) =================
  const selfStandH = faceH + depthSelf;

  const selfLayout: DirectionLayout = {
    hand: {
      origin: { x: (boardSize - HAND_TILES * tileW) / 2, y: boardSize - selfStandH },
      stride: { x: tileW, y: 0 },
      tsumoGap: { x: TSUMO_GAP, y: 0 },
    },
    discard: {
      origin: { x: centerX - discardRowW / 2, y: ipBottom },
      stride: { x: lyingW, y: 0 },
      rowOffset: { x: 0, y: lyingH },
    },
    meld: {
      origin: { x: boardSize, y: boardSize - lyingH },
      tileStride: { x: -lyingW, y: 0 },
    },
  };

  // ================= 下家 (right) =================
  const shimochaLayout = calculateShimochaLayout(
    boardSize, tileW, faceH, depthDefault,
    ipRight, centerY, discardRowH, sideLyingW,
  );

  // ================= 対面 (top) =================
  const toimenLayout = calculateToimenLayout(
    boardSize, tileW, faceH, depthDefault,
    ipXY, centerX, discardRowW, lyingW, lyingH,
  );

  // ================= 上家 (left) =================
  const kamichaLayout = calculateKamichaLayout(
    boardSize, tileW, faceH, depthDefault,
    ipXY, centerY, discardRowH, sideLyingW,
  );

  return {
    tileW,
    faceH,
    depthSelf,
    depthDefault,
    infoPanel: { x: ipXY, y: ipXY, size: ipSide },
    self: selfLayout,
    shimocha: shimochaLayout,
    toimen: toimenLayout,
    kamicha: kamichaLayout,
  };
}

// ===== 他家レイアウト =====

/**
 * 下家 (right): 手牌は右端を縦に下→上、捨て牌は情報パネル右辺から右へ下→上
 */
function calculateShimochaLayout(
  boardSize: number, tileW: number, faceH: number, _depthDefault: number,
  ipRight: number, centerY: number, discardRowH: number, sideLyingW: number,
): DirectionLayout {
  // 手牌: 右端に縦並び（下から上へ）。立牌サイズ = faceH × faceW
  const handTotalH = HAND_TILES * tileW;
  const handOriginY = centerY + handTotalH / 2 - tileW;
  return {
    hand: {
      origin: { x: boardSize - faceH, y: handOriginY },
      stride: { x: 0, y: -tileW },
      tsumoGap: { x: 0, y: -TSUMO_GAP },
    },
    discard: {
      // 牌0 = 行0最下部。行は情報パネル右辺から右へ、牌は下→上
      origin: { x: ipRight, y: centerY + discardRowH / 2 - faceH },
      stride: { x: 0, y: -faceH },
      rowOffset: { x: sideLyingW, y: 0 },
    },
    meld: {
      // 上端から下へ（下家の右=画面上）
      origin: { x: boardSize - sideLyingW, y: 0 },
      tileStride: { x: 0, y: faceH },
    },
  };
}

/**
 * 対面 (top): 自家の180度回転。手牌は上端を右→左、捨て牌は情報パネル上辺から上へ右→左
 */
function calculateToimenLayout(
  boardSize: number, tileW: number, faceH: number, depthDefault: number,
  ipXY: number, centerX: number, discardRowW: number, lyingW: number, lyingH: number,
): DirectionLayout {
  // 手牌: 上端に横並び（右から左へ）。立牌 = tileW × (faceH + depthDefault)
  const handOriginX = centerX + (HAND_TILES * tileW) / 2 - tileW;
  return {
    hand: {
      origin: { x: handOriginX, y: 0 },
      stride: { x: -tileW, y: 0 },
      tsumoGap: { x: -TSUMO_GAP, y: 0 },
    },
    discard: {
      // 牌0 = 行0最右部。行は情報パネル上辺から上へ、牌は右→左
      origin: { x: centerX + discardRowW / 2 - lyingW, y: ipXY - lyingH },
      stride: { x: -lyingW, y: 0 },
      rowOffset: { x: 0, y: -lyingH },
    },
    meld: {
      // 左端から右へ（対面の右=画面左）
      origin: { x: 0, y: 0 },
      tileStride: { x: lyingW, y: 0 },
    },
  };
}

/**
 * 上家 (left): 下家の左右反転。手牌は左端を縦に上→下、捨て牌は情報パネル左辺から左へ上→下
 */
function calculateKamichaLayout(
  boardSize: number, tileW: number, faceH: number, _depthDefault: number,
  ipXY: number, centerY: number, discardRowH: number, sideLyingW: number,
): DirectionLayout {
  // 手牌: 左端に縦並び（上から下へ）。立牌サイズ = faceH × faceW
  const handTotalH = HAND_TILES * tileW;
  const handOriginY = centerY - handTotalH / 2;
  return {
    hand: {
      origin: { x: 0, y: handOriginY },
      stride: { x: 0, y: tileW },
      tsumoGap: { x: 0, y: TSUMO_GAP },
    },
    discard: {
      // 牌0 = 行0最上部。行は情報パネル左辺から左へ、牌は上→下
      origin: { x: ipXY - sideLyingW, y: centerY - discardRowH / 2 },
      stride: { x: 0, y: faceH },
      rowOffset: { x: -sideLyingW, y: 0 },
    },
    meld: {
      // 下端から上へ（上家の右=画面下）
      origin: { x: 0, y: boardSize },
      tileStride: { x: 0, y: -faceH },
    },
  };
}
