import { registerLobbyHandlers } from "./lobby.js";
import { registerGameHandlers } from "./game.js";
import type { GameManager } from "../game/GameManager.js";

import type { Server } from "socket.io";

/** 切断プレイヤーのタイムアウト管理 */
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DISCONNECT_TIMEOUT_MS = 60_000;

export function registerSocketHandlers(io: Server, gameManager: GameManager) {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    registerLobbyHandlers(io, socket, gameManager);
    registerGameHandlers(socket, gameManager);

    socket.on("disconnect", () => {
      const roomId = socket.data["roomId"] as string | undefined;
      const playerName = socket.data["playerName"] as string | undefined;

      if (roomId) {
        const room = gameManager.getRoom(roomId);
        if (room && room.status === "playing") {
          // プレイング中の切断: 即退出せず切断扱い
          const player = room.players.find((p) => p.socketId === socket.id);
          if (player) {
            player.isConnected = false;
            player.socketId = null;

            // 他プレイヤーに切断を通知
            socket.to(roomId).emit("room:playerLeft", {
              seatIndex: player.seatIndex,
              playerName: player.playerName,
            });

            // タイムアウト設定: 一定時間再接続がなければルームを処理
            const timerId = setTimeout(() => {
              disconnectTimers.delete(socket.id);
              // 再接続されなかった場合、残りの処理は GameManager のタイムアウトに任せる
            }, DISCONNECT_TIMEOUT_MS);
            disconnectTimers.set(socket.id, timerId);
          }
        } else {
          // waiting中またはfinished: 通常退出
          gameManager.leaveRoom(socket.id);
          if (room && playerName) {
            const leavingPlayer = room.players.find((p) => p.playerName === playerName);
            socket.to(roomId).emit("room:playerLeft", {
              seatIndex: leavingPlayer?.seatIndex ?? -1,
              playerName: playerName,
            });
          }
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
