/**
 * PixiGameBoard — Pixi.js 2.5D 盤面の React ラッパーコンポーネント
 *
 * Pixi Application の生成・破棄、テクスチャのプリロード、
 * コンテナ階層の構築を行う。各領域の実際の描画は Step 5〜8 で実装する。
 */
import { useRef, useEffect, useState, useMemo, type RefObject } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { TABLE_COLOR } from "../../pixi/tiles/constants";
import { calculateBoardLayout, type BoardLayout } from "../../pixi/layout";
import { preloadAllTileAssets } from "../../pixi/tiles/tileAssets";
import { updateHands } from "../../pixi/renderers/handRenderer";
import { updateDiscards } from "../../pixi/renderers/discardRenderer";
import { updateMelds } from "../../pixi/renderers/meldRenderer";
import { PixiInfoPanel } from "./PixiInfoPanel";
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
  /** 現在の東家（親）のインデックス */
  dealerIndex?: number;
  /** 起家のインデックス（ゲーム通して固定） */
  initialDealerIndex?: number;
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

// ===== フック: 画面高さに連動する盤面サイズ =====

function useBoardSize(): number {
  const [size, setSize] = useState(() => window.innerHeight);

  useEffect(() => {
    const onResize = () => setSize(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

// ===== フック: Pixi Application 管理 =====

function usePixiApp(
  containerRef: RefObject<HTMLDivElement | null>,
  boardSize: number,
): { app: Application | null; ready: boolean } {
  const appRef = useRef<Application | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();

    app
      .init({
        width: boardSize,
        height: boardSize,
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
        await preloadAllTileAssets();

        if (destroyed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;

        // containerRef がまだ null の場合、DOM 準備完了まで待機
        const attachCanvas = () => {
          if (destroyed) return;
          if (containerRef.current) {
            containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
            setReady(true);
          } else {
            requestAnimationFrame(attachCanvas);
          }
        };
        attachCanvas();
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
  boardSize: number,
): BoardContainers | null {
  const [containers, setContainers] = useState<BoardContainers | null>(null);

  useEffect(() => {
    if (!app || !ready) return;

    // 既存のステージをクリア
    app.stage.removeChildren();

    // --- 背景: キャンバス全体を濃緑で塗る ---
    const bg = new Graphics();
    bg.fill(TABLE_COLOR);
    bg.rect(0, 0, boardSize, boardSize);
    bg.fill();
    app.stage.addChild(bg);

    // --- 盤面ルートコンテナ ---
    const boardRoot = new Container();
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

    setContainers({ hands, discards, melds, infoPanel });

    return () => {
      setContainers(null);
    };
  }, [app, ready, layout]);

  return containers;
}

// ===== メインコンポーネント =====

export function PixiGameBoard(props: PixiGameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardSize = useBoardSize();
  const { app, ready } = usePixiApp(containerRef, boardSize);
  const layout = useMemo(() => calculateBoardLayout(boardSize), [boardSize]);
  const containers = useBoardContainers(app, ready, layout, boardSize);

  // --- リサイズ時にキャンバスサイズ追従 ---
  useEffect(() => {
    if (!app || !ready) return;
    app.renderer.resize(boardSize, boardSize);
  }, [app, ready, boardSize]);

  // --- 描画更新 ---
  useEffect(() => {
    if (!containers) return;

    updateHands(containers.hands, layout, props.players, props.selectedTileIndex, props.onTileClick);
    updateDiscards(containers.discards, layout, props.players);
    updateMelds(containers.melds, layout, props.players, props.initialDealerIndex, props.roundWind);
  }, [containers, layout, props]);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] select-none overflow-hidden">
      {/* Pixi canvas + HTML オーバーレイ */}
      <div className="flex-1 flex items-center justify-center">
        <div style={{ position: "relative", width: boardSize, height: boardSize }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          {ready && (
            <PixiInfoPanel
              left={layout.infoPanel.x}
              top={layout.infoPanel.y}
              size={layout.infoPanel.size}
              roundWind={props.roundWind}
              roundNumber={props.roundNumber}
              honba={props.honba}
              riichiSticks={props.riichiSticks}
              remainingTiles={props.remainingTiles}
              doraIndicators={props.doraIndicators}
              scores={props.players.map((p) => p.score)}
              currentPlayer={props.currentPlayer}
              dealerIndex={props.dealerIndex}
            />
          )}
        </div>
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
