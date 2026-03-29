import type { Server, Socket } from "socket.io";
import type { GameManager } from "../game/GameManager.js";
import type { RoomDto, RoomPlayerDto } from "@mahjong-web/shared";

function toRoomDto(room: import("../game/GameManager.js").ActiveRoom): RoomDto {
  return {
    roomId: room.roomId,
    hostSeatIndex: room.hostSeatIndex,
    gameType: room.gameType,
    status: room.status,
    players: room.players.map(
      (p): RoomPlayerDto => ({
        seatIndex: p.seatIndex,
        playerName: p.playerName,
        isConnected: p.isConnected,
        userId: p.userId,
      }),
    ),
  };
}

export function registerLobbyHandlers(io: Server, socket: Socket, gameManager: GameManager) {
  // ルームに参加
  socket.on("room:join", (data: { roomId: string; playerName: string }) => {
    const existingRoom = gameManager.getRoom(data.roomId);
    if (!existingRoom) {
      socket.emit("room:error", { message: "ルームが見つかりません" });
      return;
    }

    // 再接続チェック: socket.data にuserIdがあれば再接続を試みる
    const userId = (socket.data["userId"] as string) ?? null;
    if (userId && existingRoom.status === "playing") {
      const reconnected = gameManager.reconnect(userId, socket.id);
      if (reconnected) {
        socket.join(data.roomId);
        socket.data["roomId"] = data.roomId;
        socket.data["playerName"] = data.playerName;
        // 再接続成功: 現在のルーム状態を送信
        socket.emit("room:state", toRoomDto(reconnected.room));
        // ゲーム状態を送信
        gameManager.sendGameStateToPlayer(reconnected.room, reconnected.player.seatIndex);
        // 他プレイヤーに再接続を通知
        socket.to(data.roomId).emit("room:state", toRoomDto(reconnected.room));
        return;
      }
    }

    // 新規参加
    const room = gameManager.joinRoom(data.roomId, {
      playerName: data.playerName,
      userId,
      socketId: socket.id,
    });

    if (!room) {
      socket.emit("room:error", { message: "ルームに参加できません" });
      return;
    }

    socket.join(data.roomId);
    socket.data["roomId"] = data.roomId;
    socket.data["playerName"] = data.playerName;

    const newPlayer = room.players[room.players.length - 1];

    // 参加者に通知
    socket.to(data.roomId).emit("room:playerJoined", {
      seatIndex: newPlayer.seatIndex,
      playerName: newPlayer.playerName,
      isConnected: true,
      userId: newPlayer.userId,
    });

    // ルーム状態を全員に送信
    io.to(data.roomId).emit("room:state", toRoomDto(room));
  });

  // ルームから退出
  socket.on("room:leave", () => {
    const result = gameManager.leaveRoom(socket.id);
    if (!result) return;

    const roomId = socket.data["roomId"] as string | undefined;
    if (roomId) {
      socket.leave(roomId);
      socket.to(roomId).emit("room:playerLeft", {
        seatIndex: result.player.seatIndex,
        playerName: result.player.playerName,
      });
      // 更新されたルーム状態を送信
      if (gameManager.getRoom(roomId)) {
        io.to(roomId).emit("room:state", toRoomDto(result.room));
      }
    }
    socket.data["roomId"] = undefined;
  });

  // ゲーム開始（ホストのみ）
  socket.on("room:startGame", () => {
    const roomId = socket.data["roomId"] as string | undefined;
    if (!roomId) return;

    const room = gameManager.getRoom(roomId);
    if (!room) return;

    // ホストチェック
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || player.seatIndex !== room.hostSeatIndex) {
      socket.emit("room:error", { message: "ホストのみがゲームを開始できます" });
      return;
    }

    if (room.players.length !== 4) {
      socket.emit("room:error", { message: "4人揃っていません" });
      return;
    }

    const success = gameManager.startGame(roomId);
    if (success) {
      io.to(roomId).emit("game:started", { roomId });
    }
  });
}
