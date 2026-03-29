import type { Socket } from "socket.io";
import type { GameManager } from "../game/GameManager.js";
import type { ActionDto } from "@mahjong-web/shared";

export function registerGameHandlers(socket: Socket, gameManager: GameManager) {
  // プレイヤーアクション（打牌・ツモ・鳴き等）
  socket.on("game:action", (data: { action: ActionDto }) => {
    gameManager.handlePlayerAction(socket.id, data.action);
  });

  // ゲーム状態の同期リクエスト（再接続後などに使用）
  socket.on("game:requestSync", () => {
    gameManager.handleSyncRequest(socket.id);
  });
}
