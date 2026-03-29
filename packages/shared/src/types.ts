// === API レスポンス型 ===

/** ユーザー情報 */
export interface UserDto {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

/** ルーム内プレイヤー情報 */
export interface RoomPlayerDto {
  seatIndex: number;
  playerName: string;
}

/** ルーム情報 */
export interface RoomDto {
  roomId: string;
  gameType: "tonpu" | "hanchan";
  status: "waiting" | "playing" | "finished";
  players: RoomPlayerDto[];
}

/** 戦績サマリー */
export interface StatsSummaryDto {
  totalGames: number;
  rankCounts: [number, number, number, number];
  averageRank: number;
  totalScore: number;
  winCount: number;
  lossCount: number;
  averageWinHan: number;
  averageLossScoreDelta: number;
}

/** 対局履歴の1件 */
export interface GameHistoryDto {
  gameId: string;
  gameType: "tonpu" | "hanchan";
  finishedAt: string | null;
  myRank: number | null;
  myScore: number | null;
  players: Array<{
    playerName: string;
    finalScore: number | null;
    finalRank: number | null;
  }>;
}

// === Socket.IO イベント型 ===

/** クライアント → サーバー */
export interface ClientToServerEvents {
  "room:join": (data: { roomId: string; playerName: string }) => void;
  "room:leave": () => void;
  "room:startGame": () => void;
  "game:action": (data: { roomId: string; action: unknown }) => void;
  "game:requestSync": (data: { roomId: string }) => void;
  "game:syncState": (data: { targetId: string; state: unknown }) => void;
}

/** サーバー → クライアント */
export interface ServerToClientEvents {
  "room:playerJoined": (data: { playerName: string; socketId: string }) => void;
  "room:playerLeft": (data: { playerName: string; socketId: string }) => void;
  "room:members": (data: { count: number }) => void;
  "game:started": (data: { roomId: string }) => void;
  "game:action": (data: { playerId: string; action: unknown }) => void;
  "game:syncRequested": (data: { playerId: string }) => void;
  "game:syncState": (data: { state: unknown }) => void;
}

// === API リクエスト型 ===

export interface LoginRequest {
  idToken: string;
}

export interface CreateRoomRequest {
  gameType: "tonpu" | "hanchan";
  ruleConfig: Record<string, unknown>;
}
