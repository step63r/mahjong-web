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
  isConnected: boolean;
  userId: string | null;
}

/** ルーム情報 */
export interface RoomDto {
  roomId: string;
  hostSeatIndex: number;
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
  hasReplay: boolean;
  players: Array<{
    playerName: string;
    finalScore: number | null;
    finalRank: number | null;
  }>;
}

/** 局サマリー（牌譜有無を含む） */
export interface RoundSummaryDto {
  roundId: string;
  roundWind: number;
  roundNumber: number;
  honba: number;
  resultType: string;
  hasReplay: boolean;
}

// === ゲーム状態同期型 ===

/** JSON互換の牌表現 */
export interface TileDto {
  type: string;
  id: number;
  isRedDora: boolean;
}

/** JSON互換の副露表現 */
export interface MeldDto {
  type: string;
  tiles: TileDto[];
  calledTile?: TileDto;
  fromPlayerIndex?: number;
}

/** 河の1エントリ */
export interface DiscardEntryDto {
  tile: TileDto;
  isTsumogiri: boolean;
  isRiichiDeclare: boolean;
  calledByPlayerIndex?: number;
}

/** 他家から見たプレイヤー情報（手牌非公開） */
export interface OpponentPlayerView {
  seatIndex: number;
  seatWind: string;
  handCount: number;
  melds: MeldDto[];
  discards: DiscardEntryDto[];
  isRiichi: boolean;
  isDoubleRiichi: boolean;
  score: number;
  playerName: string;
}

/** 自分から見たプレイヤー情報（手牌公開） */
export interface SelfPlayerView {
  seatIndex: number;
  seatWind: string;
  handTiles: TileDto[];
  melds: MeldDto[];
  discards: DiscardEntryDto[];
  isRiichi: boolean;
  isDoubleRiichi: boolean;
  score: number;
  playerName: string;
}

/** 和了情報DTO */
export interface WinEntryDto {
  winnerIndex: number;
  loserIndex: number | undefined;
  totalHan: number;
  totalFu: number;
  level: string;
  yakuList: Array<{ name: string; han: number }>;
  payment: {
    totalWinnerGain: number;
    ronLoserPayment: number;
    tsumoPaymentDealer: number;
    tsumoPaymentChild: number;
  };
  /** 和了時の手牌（和了牌を含む14枚） */
  handTiles: TileDto[];
  /** 和了牌 */
  winTile: TileDto;
  /** 副露情報 */
  melds: MeldDto[];
}

/** 局結果DTO */
export interface RoundResultDto {
  reason: string;
  wins: WinEntryDto[];
  scoreChanges: [number, number, number, number];
  tenpaiPlayers: boolean[];
  dealerKeeps: boolean;
}

/** プレイヤー視点のゲーム状態 */
export interface PlayerGameView {
  /** ゲーム情報 */
  roomId: string;
  gamePhase: string;
  /** 局情報 */
  roundWind: string;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  dealerIndex: number;
  /** 起家のインデックス（ゲーム通して不変） */
  initialDealerIndex: number;
  turnCount: number;
  /** 現在のフェーズ */
  roundPhase: string;
  activePlayerIndex: number;
  /** ドラ表示牌 */
  doraIndicators: TileDto[];
  /** 牌山残り枚数 */
  remainingTiles: number;
  /** 自分の情報 */
  mySeatIndex: number;
  self: SelfPlayerView;
  /** 他家の情報 */
  opponents: OpponentPlayerView[];
  /** 利用可能なアクション */
  availableActions: ActionDto[];
  /** 局結果（completed時のみ） */
  roundResult?: RoundResultDto;
  /** 最終結果（finished時のみ） */
  gameResult?: GameResultDto;
}

/** 最終結果DTO */
export interface GameResultDto {
  finalScores: [number, number, number, number];
  rankings: [number, number, number, number];
  finalPoints: [number, number, number, number];
  playerNames: string[];
}

// === アクションDTO ===

/** JSON互換のアクション表現 */
export interface ActionDto {
  type: string;
  playerIndex: number;
  tile?: TileDto;
  tileType?: string;
  isTsumogiri?: boolean;
  candidate?: {
    tiles: [TileDto, TileDto];
    calledTile: TileDto;
    resultTiles: [TileDto, TileDto, TileDto];
  };
}

// === Socket.IO イベント型 ===

/** クライアント → サーバー */
export interface ClientToServerEvents {
  "room:create": (data: { playerName: string; gameType: "tonpu" | "hanchan" }) => void;
  "room:join": (data: { roomId: string; playerName: string }) => void;
  "room:leave": () => void;
  "room:startGame": () => void;
  "game:action": (data: { action: ActionDto }) => void;
  "game:requestSync": () => void;
}

/** サーバー → クライアント */
export interface ServerToClientEvents {
  "room:playerJoined": (data: RoomPlayerDto) => void;
  "room:playerLeft": (data: { seatIndex: number; playerName: string }) => void;
  "room:state": (data: RoomDto) => void;
  "game:started": (data: { roomId: string }) => void;
  "game:stateUpdate": (data: PlayerGameView) => void;
  "game:roundResult": (data: { view: PlayerGameView; result: RoundResultDto }) => void;
  "game:gameResult": (data: { view: PlayerGameView; result: GameResultDto }) => void;
  "game:error": (data: { message: string }) => void;
  "room:error": (data: { message: string }) => void;
}

// === API リクエスト型 ===

export interface LoginRequest {
  idToken: string;
}

export interface CreateRoomRequest {
  gameType: "tonpu" | "hanchan";
  ruleConfig: Record<string, unknown>;
}

export interface JoinRoomRequest {
  playerName: string;
}

// === 牌譜再生用イベント型 ===

/** 牌譜再生イベント（1アクション/ツモ/打牌） */
export interface ReplayEventDto {
  type: string; // "initial_hand" | "draw" | "discard" | "chi" | "pon" | "ankan" | "minkan" | "kakan" | "riichi" | "win" | "exhaustive_draw" | "kyuushu_kyuuhai" | ...
  playerIndex: number;
  actionType?: string;
  tile?: TileDto;
  tileType?: string;
  isTsumogiri?: boolean;
  fromPlayerIndex?: number;
  roundPhase?: string;
  reason?: string;
  scoreChanges?: [number, number, number, number];
  dealerKeeps?: boolean;
  ownTiles?: TileDto[];
  yakuList?: Array<{ name: string; han: number }>;
  totalHan?: number;
  totalFu?: number;
  loserIndex?: number;
  tenpaiPlayers?: boolean[];
}

/** 局ごとのイベントログデータ */
export interface RoundEventDataDto {
  version: number; // スキーマバージョン
  roundWind: string; // "ton" | "nan" | "sha" | "pei"
  roundNumber: number; // 1-4
  dealerIndex: number; // 親の座席インデックス
  honba: number;
  riichiSticks: number;
  initialHands: [TileDto[], TileDto[], TileDto[], TileDto[]]; // 各プレイヤーの初期手牌（座席順）
  events: ReplayEventDto[];
}

/** RoundEventから取得するDTO */
export interface RoundEventDto {
  id: string;
  roundId: string;
  eventData: RoundEventDataDto;
  createdAt: string;
}
