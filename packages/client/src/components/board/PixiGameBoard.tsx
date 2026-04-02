/**
 * PixiGameBoard — Pixi.js 2.5D 盤面の React ラッパーコンポーネント
 *
 * Pixi Application の生成・破棄、テクスチャのプリロード、
 * コンテナ階層の構築を行う。各領域の実際の描画は Step 5〜8 で実装する。
 */
import { useRef, useEffect, useState, type RefObject } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, BOARD_OFFSET_X, TABLE_COLOR } from "../../pixi/tiles/constants";
import { calculateBoardLayout, type BoardLayout } from "../../pixi/layout";
import { preloadAllTileTextures } from "../../pixi/tiles/tileTexture";
import { updateHands } from "../../pixi/renderers/handRenderer";
import type { PlayerViewState, TileData, DiscardEntryData, MeldViewData } from "../../types";

// ===== Props =====

export interface PixiGameBoardProps {
  players: readonly PlayerViewState[];
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  remainingTiles: number;
  doraIndicators: readonly TileData[];
  currentPlayer: number;
  dealerIndex?: number;
  selectedTileIndex?: number;
  onTileClick?: (index: number) => void;
  actionButtons?: React.ReactNode;
}

// ===== コンテナ階層の参照 =====

export interface BoardContainers {
  /** 4方向の手牌コンテナ [self, shimocha, toimen, kamicha] */
  hands: [Container, Container, Container, Container];
  /** 4方向の捨て牌コンテナ */
  discards: [Container, Container, Container, Container];
  /** 4方向の副露コンテナ */
  melds: [Container, Container, Container, Container];
  /** 中央情報パネルコンテナ */
  infoPanel: Container;
}

// ===== フック: Pixi Application 管理 =====

function usePixiApp(
  containerRef: RefObject<HTMLDivElement | null>,
): { app: Application | null; ready: boolean } {
  const appRef = useRef<Application | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();

    app
      .init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(async () => {
        if (destroyed) {
          app.destroy(true);
          return;
        }
        // テクスチャプリロード
        await preloadAllTileTextures();

        if (destroyed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        containerRef.current?.appendChild(app.canvas as HTMLCanvasElement);
        setReady(true);
      });

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { app: appRef.current, ready };
}

// ===== フック: 盤面コンテナ階層の構築 =====

function useBoardContainers(
  app: Application | null,
  ready: boolean,
  layout: BoardLayout,
): BoardContainers | null {
  const containersRef = useRef<BoardContainers | null>(null);

  useEffect(() => {
    if (!app || !ready) return;

    // 既存のステージをクリア
    app.stage.removeChildren();

    // --- 背景: 盤面領域を濃緑で塗る ---
    const bg = new Graphics();
    bg.fill(TABLE_COLOR);
    bg.rect(BOARD_OFFSET_X, 0, layout.infoPanel.size + 200, CANVAS_HEIGHT);
    bg.fill();
    app.stage.addChild(bg);

    // --- 盤面ルートコンテナ（オフセット適用） ---
    const boardRoot = new Container();
    boardRoot.x = BOARD_OFFSET_X;
    app.stage.addChild(boardRoot);

    // --- コンテナ階層 ---
    const directions = ["self", "shimocha", "toimen", "kamicha"] as const;
    const hands = directions.map(() => new Container()) as BoardContainers["hands"];
    const discards = directions.map(() => new Container()) as BoardContainers["discards"];
    const melds = directions.map(() => new Container()) as BoardContainers["melds"];
    const infoPanel = new Container();

    // 情報パネルコンテナの位置
    infoPanel.x = layout.infoPanel.x;
    infoPanel.y = layout.infoPanel.y;

    // ステージへ追加（描画順: 背景 → 捨て牌 → 副露 → 情報パネル → 手牌）
    for (const c of discards) boardRoot.addChild(c);
    for (const c of melds) boardRoot.addChild(c);
    boardRoot.addChild(infoPanel);
    for (const c of hands) boardRoot.addChild(c);

    containersRef.current = { hands, discards, melds, infoPanel };

    return () => {
      containersRef.current = null;
    };
  }, [app, ready, layout]);

  return containersRef.current;
}

// ===== メインコンポーネント =====

export function PixiGameBoard(props: PixiGameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { app, ready } = usePixiApp(containerRef);
  const layout = useRef(calculateBoardLayout()).current;
  const containers = useBoardContainers(app, ready, layout);

  // --- 描画更新 (Step 5〜8 で各 update 関数を呼ぶ) ---
  useEffect(() => {
    if (!containers) return;

    // TODO Step 5: updateHands(containers.hands, layout, props.players, props.selectedTileIndex)
    updateHands(containers.hands, layout, props.players, props.selectedTileIndex);
    // TODO Step 6: updateDiscards(containers.discards, layout, props.players)
    // TODO Step 7: updateMelds(containers.melds, layout, props.players, props.dealerIndex)
    // TODO Step 8: updateInfoPanel(containers.infoPanel, layout, props)
  }, [containers, layout, props]);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] select-none overflow-hidden">
      {/* Pixi canvas コンテナ */}
      <div className="flex-1 flex items-center justify-center">
        <div
          ref={containerRef}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        />
      </div>

      {/* アクションボタン（HTML オーバーレイ） */}
      {props.actionButtons && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          {props.actionButtons}
        </div>
      )}
    </div>
  );
}
