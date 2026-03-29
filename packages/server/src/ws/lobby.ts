import type { Server, Socket } from "socket.io";

export function registerLobbyHandlers(io: Server, socket: Socket) {
  // ルームに参加
  socket.on("room:join", (data: { roomId: string; playerName: string }) => {
    socket.join(data.roomId);
    socket.data["roomId"] = data.roomId;
    socket.data["playerName"] = data.playerName;

    // 他のプレイヤーに通知
    socket.to(data.roomId).emit("room:playerJoined", {
      playerName: data.playerName,
      socketId: socket.id,
    });

    // 現在のルームメンバーを送信
    const room = io.sockets.adapter.rooms.get(data.roomId);
    if (room) {
      io.to(data.roomId).emit("room:members", {
        count: room.size,
      });
    }
  });

  // ルームから退出
  socket.on("room:leave", () => {
    const roomId = socket.data["roomId"] as string | undefined;
    if (roomId) {
      socket.leave(roomId);
      socket.to(roomId).emit("room:playerLeft", {
        playerName: socket.data["playerName"] as string,
        socketId: socket.id,
      });
    }
  });

  // ゲーム開始（ホストのみ）
  socket.on("room:startGame", () => {
    const roomId = socket.data["roomId"] as string | undefined;
    if (roomId) {
      io.to(roomId).emit("game:started", { roomId });
    }
  });
}
