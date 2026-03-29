import { registerLobbyHandlers } from "./lobby.js";
import { registerGameHandlers } from "./game.js";

import type { Server } from "socket.io";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on("disconnect", () => {
      const roomId = socket.data["roomId"] as string | undefined;
      if (roomId) {
        socket.to(roomId).emit("room:playerLeft", {
          playerName: socket.data["playerName"] as string,
          socketId: socket.id,
        });
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
