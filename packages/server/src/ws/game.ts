import type { Server, Socket } from "socket.io";

export function registerGameHandlers(_io: Server, socket: Socket) {
  // プレイヤーアクション（打牌・ツモ・鳴き等）
  socket.on("game:action", (data: { roomId: string; action: unknown }) => {
    // ルーム内の他プレイヤーにアクションをブロードキャスト
    socket.to(data.roomId).emit("game:action", {
      playerId: socket.id,
      action: data.action,
    });
  });

  // ゲーム状態の同期リクエスト
  socket.on("game:requestSync", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("game:syncRequested", {
      playerId: socket.id,
    });
  });

  // ゲーム状態の送信（ホスト→要求者）
  socket.on(
    "game:syncState",
    (data: { targetId: string; state: unknown }) => {
      socket.to(data.targetId).emit("game:syncState", {
        state: data.state,
      });
    },
  );
}
