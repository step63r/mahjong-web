import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong-web/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const FORCE_POLLING = import.meta.env.VITE_SOCKET_FORCE_POLLING === "true";
const TRANSPORTS: ["polling"] | ["websocket", "polling"] = FORCE_POLLING
  ? ["polling"]
  : ["websocket", "polling"];

let socket: AppSocket | null = null;

/** Socket.IO 接続を取得（未接続なら接続を開始） */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: TRANSPORTS,
      upgrade: !FORCE_POLLING,
    });
  }
  return socket;
}

/** 接続を開始 */
export function connectSocket(): AppSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/** 切断 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
