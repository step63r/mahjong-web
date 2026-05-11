/**
 * オンライン対人戦のゲーム進行ストア
 *
 * サーバーから受信した game:stateUpdate / game:roundResult / game:gameResult を
 * UI 状態に変換して保持する。アクション送信も担当。
 */
import { create } from "zustand";
import type {
  PlayerGameView,
  RoundResultDto,
  GameResultDto,
  ActionDto,
  TileDto,
} from "@mahjong-web/shared";
import { getSocket } from "@/lib/socket";
import {
  gameViewToPlayerViews,
  buildOnlineActionOptions,
} from "@/utils/onlineViewConverter";
import type { OnlineActionOption } from "@/utils/onlineViewConverter";
import type { PlayerViewState, TileData } from "@/types";

// ===== UI phase =====

export type OnlineUiPhase =
  | "waiting"        // ゲーム開始待ち（遷移直後）
  | "playing"        // 相手のターン中（操作不可）
  | "myTurn"         // 自分のターン（アクション選択可）
  | "roundResult"    // 局結果表示中
  | "gameResult";    // 最終結果表示中

// ===== Store state =====

export interface OnlineGameStore {
  uiPhase: OnlineUiPhase;
  /** 最新の PlayerGameView (生データ) */
  latestView: PlayerGameView | null;
  /** GameBoard 用に変換済みの PlayerViewState[4] */
  playerViews: PlayerViewState[];
  /** ドラ表示牌 */
  doraIndicators: TileData[];
  /** 利用可能なアクション（ボタン用・打牌除外済み） */
  actionOptions: OnlineActionOption[];
  /** 利用可能なアクション（打牌含む生データ） */
  availableActions: ActionDto[];
  /** 選択中の牌インデックス */
  selectedTileIndex: number | undefined;
  /** 局結果 */
  roundResult: RoundResultDto | null;
  /** 最終結果 */
  gameResult: GameResultDto | null;
  /** 得点（局結果表示用） */
  scores: [number, number, number, number];
  /** 副露直後の打牌フェーズか（ツモ切り判定用） */
  isPostMeldTurn: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 局開始ごとにインクリメント（配牌アニメーション用） */
  roundStartKey: number;

  // --- アクション ---
  /** Socket リスナーをセットアップ */
  setupGameListeners: () => void;
  /** 牌選択 */
  selectTile: (index: number | undefined) => void;
  /** アクション送信（ActionDto） */
  sendAction: (action: ActionDto) => void;
  /** 局結果の「次へ」 */
  acknowledgeRoundResult: () => void;
  /** ストアリセット */
  reset: () => void;
}

function dtoToTileData(dto: TileDto): TileData {
  return { type: dto.type, id: dto.id, isRedDora: dto.isRedDora };
}

export const useOnlineGameStore = create<OnlineGameStore>((set, get) => ({
  uiPhase: "waiting",
  latestView: null,
  playerViews: [],
  doraIndicators: [],
  actionOptions: [],
  availableActions: [],
  selectedTileIndex: undefined,
  roundResult: null,
  gameResult: null,
  scores: [0, 0, 0, 0],
  isPostMeldTurn: false,
  error: null,
  roundStartKey: 0,

  setupGameListeners: () => {
    const socket = getSocket();

    socket.on("game:stateUpdate", (view: PlayerGameView) => {
      const isNewRound = get().uiPhase === "waiting";
      const playerViews = gameViewToPlayerViews(view);
      const doraIndicators = view.doraIndicators.map(dtoToTileData);
      const hasActions = view.availableActions.length > 0;

      set({
        latestView: view,
        playerViews,
        doraIndicators,
        availableActions: view.availableActions,
        actionOptions: hasActions ? buildOnlineActionOptions(view.availableActions) : [],
        uiPhase: hasActions ? "myTurn" : "playing",
        isPostMeldTurn: view.isPostMeld ?? false,
        selectedTileIndex: undefined,
        roundResult: null,
        error: null,
        ...(isNewRound ? { roundStartKey: get().roundStartKey + 1 } : {}),
      });
    });

    socket.on("game:roundResult", (data) => {
      const playerViews = gameViewToPlayerViews(data.view);
      const doraIndicators = data.view.doraIndicators.map(dtoToTileData);

      // 得点を収集（自分＋他家をseat順に並べ替え）
      const scores = collectScores(data.view);

      set({
        latestView: data.view,
        playerViews,
        doraIndicators,
        roundResult: data.result,
        scores,
        uiPhase: "roundResult",
        availableActions: [],
        actionOptions: [],
        selectedTileIndex: undefined,
      });
    });

    socket.on("game:gameResult", (data) => {
      const playerViews = gameViewToPlayerViews(data.view);
      const doraIndicators = data.view.doraIndicators.map(dtoToTileData);

      set({
        latestView: data.view,
        playerViews,
        doraIndicators,
        gameResult: data.result,
        uiPhase: "gameResult",
        availableActions: [],
        actionOptions: [],
        selectedTileIndex: undefined,
      });
    });

    socket.on("game:error", (data) => {
      set({ error: data.message });
    });
  },

  selectTile: (index) => {
    set({ selectedTileIndex: index });
  },

  sendAction: (action) => {
    const socket = getSocket();
    socket.emit("game:action", { action });
    set({
      availableActions: [],
      actionOptions: [],
      selectedTileIndex: undefined,
      uiPhase: "playing",
    });
  },

  acknowledgeRoundResult: () => {
    // サーバーが自動的に次の局を開始するので、クライアントは待つだけ
    set({
      roundResult: null,
      uiPhase: "waiting",
    });
  },

  reset: () => {
    const socket = getSocket();
    socket.off("game:stateUpdate");
    socket.off("game:roundResult");
    socket.off("game:gameResult");
    socket.off("game:error");
    set({
      uiPhase: "waiting",
      latestView: null,
      playerViews: [],
      doraIndicators: [],
      actionOptions: [],
      availableActions: [],
      selectedTileIndex: undefined,
      roundResult: null,
      gameResult: null,
      scores: [0, 0, 0, 0],
      error: null,
      roundStartKey: 0,
    });
  },
}));

// ===== ヘルパー =====

/** PlayerGameView から座席順の得点配列を構築 */
function collectScores(view: PlayerGameView): [number, number, number, number] {
  const scores: [number, number, number, number] = [0, 0, 0, 0];
  // 自分の視点での相対位置に変換
  const mySeat = view.mySeatIndex;
  scores[0] = view.self.score;
  for (const opp of view.opponents) {
    const rel = (opp.seatIndex - mySeat + 4) % 4;
    scores[rel] = opp.score;
  }
  return scores;
}
