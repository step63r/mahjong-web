/**
 * PixiGameBoard — Pixi.js 2.5D 盤面の React ラッパーコンポーネント
 *
 * Pixi Application の生成・破棄、テクスチャのプリロード、
 * コンテナ階層の構築を行う。各領域の実際の描画は Step 5〜8 で実装する。
 */
import { useRef, useEffect, useState, useMemo, type RefObject } from "react";
import { Application, Container, Graphics, Ticker } from "pixi.js";
import { TABLE_COLOR } from "../../pixi/tiles/constants";
import { calculateBoardLayout, type BoardLayout } from "../../pixi/layout";
import { preloadAllTileAssets } from "../../pixi/tiles/tileAssets";
import { updateHands } from "../../pixi/renderers/handRenderer";
import { updateDiscards } from "../../pixi/renderers/discardRenderer";
import type { LastDiscardPosition } from "../../pixi/renderers/discardRenderer";
import { updateMelds } from "../../pixi/renderers/meldRenderer";
import { PixiInfoPanel } from "./PixiInfoPanel";
import type { PlayerViewState, TileData, DiscardEntryData, MeldViewData } from "../../types";
import type { WaitingTileInfo } from "../../utils/viewConverter";
import { RiichiWaitTooltip } from "../action/RiichiWaitTooltip";

// ===== Props =====

export interface PixiGameBoardProps {
  players: readonly PlayerViewState[];
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  remainingTiles: number;
  doraIndicators: readonly TileData[];
  playerNames?: readonly string[];
  currentPlayer: number;
  /** 現在の東家（親）のインデックス */
  dealerIndex?: number;
  /** 起家のインデックス（ゲーム通して固定） */
  initialDealerIndex?: number;
  selectedTileIndex?: number;
  /** リーチモードで選択中の手牌インデックス */
  riichiSelectedIndex?: number;
  /** リーチモードで選択中の牌の待ち牌情報 */
  riichiWaitingTiles?: readonly WaitingTileInfo[];
  onTileClick?: (index: number) => void;
  /** リーチモード中の候補牌インデックス集合 */
  riichiCandidateIndices?: ReadonlySet<number>;
  actionButtons?: React.ReactNode;
  /** 最後の捨て牌をハイライトする（副露アクション選択中）プレイヤー相対インデックス */
  highlightLastDiscardPlayerIndex?: number;
  /** 配牌アニメーション中の各プレイヤーの表示枚数 [self, shimocha, toimen, kamicha] */
  revealedCounts?: readonly [number, number, number, number];
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

// ===== フック: 画面サイズに連動する盤面サイズ =====

function useBoardDimensions(): { width: number; height: number } {
  const [dims, setDims] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setDims({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return dims;
}

// ===== フック: Pixi Application 管理 =====

function usePixiApp(
  containerRef: RefObject<HTMLDivElement | null>,
  boardWidth: number,
  boardHeight: number,
): { app: Application | null; ready: boolean } {
  const appRef = useRef<Application | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();

    app
      .init({
        width: boardWidth,
        height: boardHeight,
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
): BoardContainers | null {
  const [containers, setContainers] = useState<BoardContainers | null>(null);

  useEffect(() => {
    if (!app || !ready) return;

    // 既存のステージをクリア
    app.stage.removeChildren();

    // --- 背景: キャンバス全体を濃緑で塗る ---
    const bg = new Graphics();
    bg.fill(TABLE_COLOR);
    bg.rect(0, 0, layout.boardWidth, layout.boardHeight);
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
  const { width: boardWidth, height: boardHeight } = useBoardDimensions();
  const { app, ready } = usePixiApp(containerRef, boardWidth, boardHeight);
  const layout = useMemo(() => calculateBoardLayout(boardWidth, boardHeight), [boardWidth, boardHeight]);
  const containers = useBoardContainers(app, ready, layout);

  // --- ハイライト用 Graphics ---
  const highlightGraphicsRef = useRef<Graphics | null>(null);
  const highlightPosRef = useRef<LastDiscardPosition | null>(null);
  const tickerRef = useRef<Ticker | null>(null);
  const timeRef = useRef<number>(0);

  // ハイライト Graphics を stage に登録（ready になったら）
  useEffect(() => {
    if (!app || !ready) return;
    const g = new Graphics();
    g.zIndex = 100;
    app.stage.addChild(g);
    highlightGraphicsRef.current = g;
    return () => {
      // app.destroy() 後は stage が破棄済みのため removeChild をスキップ
      if (app.stage) {
        app.stage.removeChild(g);
      }
      highlightGraphicsRef.current = null;
    };
  }, [app, ready]);

  // Ticker で明滅
  useEffect(() => {
    if (!app || !ready) return;
    const ticker = new Ticker();
    tickerRef.current = ticker;
    ticker.add((t) => {
      const g = highlightGraphicsRef.current;
      const pos = highlightPosRef.current;
      if (!g) return;
      g.clear();
      if (!pos) return;
      timeRef.current += t.deltaMS;
      // 1000ms で 1 周期（sin で滑らかに明滅）
      const alpha = 0.25 + 0.25 * Math.sin((timeRef.current / 1000) * Math.PI * 2);
      g.fill({ color: 0xffdd00, alpha });
      g.rect(pos.x - 2, pos.y - 2, pos.w + 4, pos.h + 4);
      g.fill();
    });
    ticker.start();
    return () => {
      ticker.destroy();
      tickerRef.current = null;
    };
  }, [app, ready]);
  useEffect(() => {
    if (!app || !ready) return;
    app.renderer.resize(boardWidth, boardHeight);
  }, [app, ready, boardWidth, boardHeight]);

  // --- 描画更新 ---
  useEffect(() => {
    if (!containers) return;

    // リーチモード中は riichiSelectedIndex を選択表示として使用
    const activeSelectedIndex = props.riichiSelectedIndex ?? props.selectedTileIndex;
    updateHands(containers.hands, layout, props.players, activeSelectedIndex, props.onTileClick, props.riichiCandidateIndices, props.revealedCounts);
    const lastPos = updateDiscards(containers.discards, layout, props.players, props.highlightLastDiscardPlayerIndex);
    highlightPosRef.current = lastPos;
    // ハイライトがなくなった場合は即座に消す
    if (!lastPos && highlightGraphicsRef.current) {
      highlightGraphicsRef.current.clear();
      timeRef.current = 0;
    }
    updateMelds(containers.melds, layout, props.players, props.initialDealerIndex, props.roundWind);
  }, [containers, layout, props]);

  // --- リーチツールチップの位置計算 ---
  const tooltipPosition = useMemo(() => {
    const idx = props.riichiSelectedIndex ?? props.selectedTileIndex;
    if (idx === undefined || !props.riichiWaitingTiles?.length) return null;
    const hand = layout.self.hand;
    const handLen = props.players[0]?.hand.length ?? 0;
    const isTsumo = idx === handLen;

    const tileX = hand.origin.x + hand.stride.x * idx + (isTsumo ? hand.tsumoGap.x : 0);
    const tileY = hand.origin.y;
    return { centerX: tileX + layout.tileW / 2, bottomY: tileY - 4 };
  }, [props.riichiSelectedIndex, props.selectedTileIndex, props.riichiWaitingTiles, layout, props.players]);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] select-none overflow-hidden">
      {/* Pixi canvas + HTML オーバーレイ */}
      <div className="flex-1 flex items-center justify-center">
        <div style={{ position: "relative", width: boardWidth, height: boardHeight }}>
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
              playerNames={props.playerNames}
              currentPlayer={props.currentPlayer}
              dealerIndex={props.dealerIndex}
            />
          )}
          {/* リーチ待ち牌ツールチップ */}
          {tooltipPosition && props.riichiWaitingTiles && (
            <RiichiWaitTooltip
              waitingTiles={props.riichiWaitingTiles}
              centerX={tooltipPosition.centerX}
              bottomY={tooltipPosition.bottomY}
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
