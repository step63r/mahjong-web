/**
 * オンライン対人戦のルーム管理ストア
 *
 * Socket.IO 経由でルーム作成 / 参加 / 退出を管理する。
 * ゲーム進行状態は onlineGameStore で管理する。
 */
import { create } from "zustand";
import type { RoomDto } from "@mahjong-web/shared";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";

export interface OnlineRoomStore {
  /** 現在のルーム情報 */
  room: RoomDto | null;
  /** 自分のプレイヤー名 */
  playerName: string;
  /** 接続状態 */
  isConnecting: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ゲーム開始フラグ（GamePageへの遷移トリガー） */
  gameStarted: boolean;

  /** ルーム作成 */
  createRoom: (playerName: string, gameType: "tonpu" | "hanchan") => void;
  /** ルーム参加 */
  joinRoom: (roomId: string, playerName: string) => void;
  /** ルーム退出 */
  leaveRoom: () => void;
  /** ゲーム開始（ホストのみ） */
  startGame: () => void;
  /** ストアリセット */
  reset: () => void;
  /** gameStarted フラグをクリア */
  clearGameStarted: () => void;
}

export const useOnlineRoomStore = create<OnlineRoomStore>((set, get) => {
  /** Socket イベントリスナー登録 */
  function setupListeners(): void {
    const socket = getSocket();

    socket.on("room:state", (data) => {
      set({ room: data, isConnecting: false, error: null });
    });

    socket.on("room:playerJoined", () => {
      // room:state で全体更新されるのでここでは何もしない
    });

    socket.on("room:playerLeft", () => {
      // room:state で全体更新されるのでここでは何もしない
    });

    socket.on("room:error", (data) => {
      set({ error: data.message, isConnecting: false });
    });

    socket.on("game:started", () => {
      set({ gameStarted: true });
    });
  }

  return {
    room: null,
    playerName: "",
    isConnecting: false,
    error: null,
    gameStarted: false,

    createRoom: (playerName, gameType) => {
      set({ isConnecting: true, error: null, playerName });
      const socket = connectSocket();
      setupListeners();
      socket.emit("room:create", { playerName, gameType });
    },

    joinRoom: (roomId, playerName) => {
      set({ isConnecting: true, error: null, playerName });
      const socket = connectSocket();
      setupListeners();
      socket.emit("room:join", { roomId, playerName });
    },

    leaveRoom: () => {
      const socket = getSocket();
      socket.emit("room:leave");
      socket.removeAllListeners();
      disconnectSocket();
      set({ room: null, error: null, gameStarted: false });
    },

    startGame: () => {
      const socket = getSocket();
      socket.emit("room:startGame");
    },

    reset: () => {
      const socket = getSocket();
      socket.removeAllListeners();
      disconnectSocket();
      set({ room: null, playerName: "", isConnecting: false, error: null, gameStarted: false });
    },

    clearGameStarted: () => {
      set({ gameStarted: false });
    },
  };
});
