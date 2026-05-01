/**
 * サーバーサイドのオンライン対局管理
 *
 * インメモリで RoundState / GameState を保持し、
 * ドメインエンジンを駆動してゲームを進行させる。
 */
import type { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import {
  createGame,
  startGame,
  processRoundResult,
  calculateFinalResult,
  getCurrentRoundInfo,
  createRound,
  startRound,
  applyAction,
  resolveAfterDiscard,
  resolveAfterKan,
  isFuriten,
  getActionsAfterDraw,
  getActionsAfterDiscard,
  getActionsAfterAnkan,
  Wall,
  RoundPhase,
  GamePhase,
  ActionType,
  createDefaultRuleConfig,
  createTonpuDefaults,
} from "@mahjong-web/domain";
import type {
  RoundState,
  GameState,
  GameResult,
  PlayerAction,
  RuleConfig,
  Tile,
  Meld,
} from "@mahjong-web/domain";
import type {
  TileDto,
  MeldDto,
  DiscardEntryDto,
  OpponentPlayerView,
  SelfPlayerView,
  PlayerGameView,
  WinEntryDto,
  RoundResultDto,
  GameResultDto,
  ActionDto,
  RoundEventDataDto,
  ReplayEventDto,
} from "@mahjong-web/shared";

// ===== 型定義 =====

type PrismaClient = FastifyInstance["prisma"];

export interface RoomPlayer {
  seatIndex: number;
  playerName: string;
  userId: string | null;
  socketId: string | null;
  isConnected: boolean;
}

export interface ActiveRoom {
  roomId: string;
  hostSeatIndex: number;
  gameType: "tonpu" | "hanchan";
  ruleConfig: RuleConfig;
  status: "waiting" | "playing" | "finished";
  players: RoomPlayer[];
  /** ゲーム進行中の状態 */
  gameState: GameState | null;
  roundState: RoundState | null;
  gameResult: GameResult | null;
  /** AfterDiscard/AfterKanで収集中のアクション */
  pendingPlayerActions: Map<number, PlayerAction>;
  /** タイムアウトタイマー */
  actionTimers: Map<number, ReturnType<typeof setTimeout>>;
  /** 全体アクションタイムアウト（秒） */
  actionTimeout: number;
  /** 永続化した games.id */
  dbGameId: string | null;
  /** seatIndex -> game_players.id */
  dbGamePlayerIds: Map<number, string>;
  /** 現在局の牌譜イベントバッファ */
  currentRoundEventData: RoundEventDataDto | null;
}

// ===== GameManager =====

export class GameManager {
  /** roomId → ActiveRoom */
  private rooms = new Map<string, ActiveRoom>();
  /** socketId → roomId */
  private socketToRoom = new Map<string, string>();
  /** userId → roomId（再接続用） */
  private userToRoom = new Map<string, string>();

  constructor(
    private io: Server,
    private prisma: PrismaClient,
  ) {}

  /** 6桁のルームIDを生成 */
  generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id: string;
    do {
      id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } while (this.rooms.has(id));
    return id;
  }

  /** gameType に応じたデフォルトルール設定を返す */
  getDefaultRuleConfig(gameType: "tonpu" | "hanchan"): RuleConfig {
    return gameType === "tonpu" ? createTonpuDefaults() : createDefaultRuleConfig();
  }

  // ========== ルーム管理 ==========

  createRoom(
    roomId: string,
    gameType: "tonpu" | "hanchan",
    ruleConfig: RuleConfig,
    hostPlayer: { playerName: string; userId: string | null; socketId: string },
  ): ActiveRoom {
    const room: ActiveRoom = {
      roomId,
      hostSeatIndex: 0,
      gameType,
      ruleConfig,
      status: "waiting",
      players: [
        {
          seatIndex: 0,
          playerName: hostPlayer.playerName,
          userId: hostPlayer.userId,
          socketId: hostPlayer.socketId,
          isConnected: true,
        },
      ],
      gameState: null,
      roundState: null,
      gameResult: null,
      pendingPlayerActions: new Map(),
      actionTimers: new Map(),
      actionTimeout: 30,
      dbGameId: null,
      dbGamePlayerIds: new Map(),
      currentRoundEventData: null,
    };
    this.rooms.set(roomId, room);
    this.socketToRoom.set(hostPlayer.socketId, roomId);
    if (hostPlayer.userId) {
      this.userToRoom.set(hostPlayer.userId, roomId);
    }
    return room;
  }

  joinRoom(
    roomId: string,
    player: { playerName: string; userId: string | null; socketId: string },
  ): ActiveRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== "waiting") return null;
    if (room.players.length >= 4) return null;

    const seatIndex = room.players.length;
    room.players.push({
      seatIndex,
      playerName: player.playerName,
      userId: player.userId,
      socketId: player.socketId,
      isConnected: true,
    });
    this.socketToRoom.set(player.socketId, roomId);
    if (player.userId) {
      this.userToRoom.set(player.userId, roomId);
    }
    return room;
  }

  leaveRoom(socketId: string): { room: ActiveRoom; player: RoomPlayer } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
    if (playerIdx === -1) return null;
    const player = room.players[playerIdx];

    this.socketToRoom.delete(socketId);
    if (player.userId) {
      this.userToRoom.delete(player.userId);
    }

    if (room.status === "waiting") {
      // waiting中は退出可能
      room.players.splice(playerIdx, 1);
      // 席番号を振り直す
      room.players.forEach((p, i) => (p.seatIndex = i));
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    } else {
      // playing中は切断扱い
      player.isConnected = false;
      player.socketId = null;
    }

    return { room, player };
  }

  getRoom(roomId: string): ActiveRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId: string): ActiveRoom | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getPlayerBySocket(socketId: string): { room: ActiveRoom; player: RoomPlayer } | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return undefined;
    return { room, player };
  }

  // ========== 再接続 ==========

  reconnect(
    userId: string,
    socketId: string,
  ): { room: ActiveRoom; player: RoomPlayer } | null {
    const roomId = this.userToRoom.get(userId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return null;

    // 古いソケットIDをクリーンアップ
    if (player.socketId) {
      this.socketToRoom.delete(player.socketId);
    }

    player.socketId = socketId;
    player.isConnected = true;
    this.socketToRoom.set(socketId, roomId);

    return { room, player };
  }

  // ========== ゲーム開始 ==========

  async startGame(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== "waiting" || room.players.length !== 4) return false;

    room.status = "playing";

    const game = startGame(createGame(room.ruleConfig));
    room.gameState = game;

    try {
      await this.ensurePersistedOnlineGame(room);
    } catch (error) {
      console.error("Failed to persist online game start", error);
    }

    this.startNewRound(room);
    return true;
  }

  private async ensurePersistedOnlineGame(room: ActiveRoom): Promise<void> {
    if (room.dbGameId) return;

    const rawUserIds = room.players
      .map((p) => p.userId)
      .filter((value): value is string => Boolean(value));

    const resolvedUserIds = new Map<string, string>();
    if (rawUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [{ id: { in: rawUserIds } }, { firebaseUid: { in: rawUserIds } }],
        },
      });

      for (const user of users) {
        resolvedUserIds.set(user.id, user.id);
        resolvedUserIds.set(user.firebaseUid, user.id);
      }
    }

    const game = await this.prisma.game.create({
      data: {
        gameType: `online_${room.gameType}`,
        status: "playing",
        ruleConfig: JSON.stringify(room.ruleConfig),
        gamePlayers: {
          create: room.players.map((player) => ({
            seatIndex: player.seatIndex,
            playerName: player.playerName,
            userId: player.userId ? (resolvedUserIds.get(player.userId) ?? null) : null,
          })),
        },
      },
      include: {
        gamePlayers: true,
      },
    });

    room.dbGameId = game.id;
    room.dbGamePlayerIds = new Map(
      game.gamePlayers.map((p: { seatIndex: number; id: string }) => [p.seatIndex, p.id]),
    );
  }

  private async persistRoundResult(
    room: ActiveRoom,
    round: RoundState,
    result: import("@mahjong-web/domain").RoundResult,
    roundWind: string,
    roundNumber: number,
  ): Promise<string | null> {
    if (!room.dbGameId) return null;

    const roundWindValue = roundWind === "nan" ? 1 : 0;

    const createdRound = await this.prisma.round.create({
      data: {
        gameId: room.dbGameId,
        roundWind: roundWindValue,
        roundNumber: Math.max(0, roundNumber - 1),
        honba: round.honba,
        resultType: result.reason,
      },
    });

    await this.prisma.roundPlayerStat.createMany({
      data: room.players.map((player) => {
        const gamePlayerId = room.dbGamePlayerIds.get(player.seatIndex);
        if (!gamePlayerId) {
          throw new Error(`Missing gamePlayerId for seatIndex=${player.seatIndex}`);
        }

        const win = result.wins.find((w) => w.winnerIndex === player.seatIndex);
        return {
          roundId: createdRound.id,
          gamePlayerId,
          isWinner: win !== undefined,
          isLoser: result.wins.some((w) => w.loserIndex === player.seatIndex),
          scoreDelta: result.scoreChanges[player.seatIndex],
          yakuList:
            win !== undefined
              ? JSON.stringify(
                  win.scoreResult.judgeResult.yakuList.map((yaku) => ({
                    name: yaku.yaku,
                    han: yaku.han,
                  })),
                )
              : null,
          han: win?.scoreResult.totalHan,
          fu: win?.scoreResult.totalFu,
        };
      }),
    });

    return createdRound.id;
  }

  /**
   * 局の牌譜イベントを保存する（Step2で実装）
   * roundId と eventData JSON を受け取り、RoundEvent テーブルに保存する
   * @param roundId Round.id
   * @param eventDataJson RoundEventDataDto の JSON文字列
   */
  async persistRoundEvent(roundId: string, eventDataJson: string): Promise<void> {
    await this.prisma.roundEvent.create({
      data: {
        roundId,
        eventData: eventDataJson,
      },
    });
  }

  private async persistGameFinished(room: ActiveRoom, gameResult: GameResult): Promise<void> {
    if (!room.dbGameId) return;

    await this.prisma.$transaction(
      async (tx: { game: PrismaClient["game"]; gamePlayer: PrismaClient["gamePlayer"] }) => {
        await tx.game.update({
          where: { id: room.dbGameId! },
          data: {
            status: "finished",
            finishedAt: new Date(),
          },
        });

        for (const player of room.players) {
          const gamePlayerId = room.dbGamePlayerIds.get(player.seatIndex);
          if (!gamePlayerId) continue;

          await tx.gamePlayer.update({
            where: { id: gamePlayerId },
            data: {
              finalScore: gameResult.finalScores[player.seatIndex],
              finalRank: gameResult.rankings[player.seatIndex],
            },
          });
        }
      }
    );
  }

  private startNewRound(room: ActiveRoom): void {
    const game = room.gameState!;
    const info = getCurrentRoundInfo(game);

    const wall = Wall.create(game.ruleConfig.redDora);
    const round = createRound({
      ruleConfig: game.ruleConfig,
      wall,
      dealerIndex: info.dealerIndex,
      roundWind: info.roundWind as Tile["type"],
      honba: info.honba,
      riichiSticks: game.riichiSticks,
      playerScores: [...game.scores] as [number, number, number, number],
    });
    startRound(round);
    room.roundState = round;
    room.currentRoundEventData = this.createRoundEventData(game, round);
    room.pendingPlayerActions.clear();
    this.clearAllTimers(room);

    // 全プレイヤーに状態を送信
    this.broadcastGameState(room);

    // ゲームループ開始
    this.processGameLoop(room);
  }

  // ========== ゲームループ ==========

  private processGameLoop(room: ActiveRoom): void {
    const round = room.roundState;
    if (!round) return;

    // 局終了
    if (round.phase === RoundPhase.Completed) {
      this.handleRoundComplete(room);
      return;
    }

  // DrawPhase: アクティブプレイヤーにアクションを送信
    if (round.phase === RoundPhase.DrawPhase) {
      const activeIdx = round.activePlayerIndex;
      // 鳴き後の DrawPhase がどうか判定し、実際のドローのみイベントを記録する
      if (!this.isPostMeldDrawPhase(room, activeIdx)) {
        const player = round.players[activeIdx];
        const handTiles = player.hand.getTiles();
        if (handTiles.length > 0) {
          this.appendDrawEvent(room, activeIdx, handTiles[handTiles.length - 1]);
        }
      }
      this.sendActionsToPlayer(room, activeIdx, this.getDrawActions(round, activeIdx));
      return;
    }

    // AfterDiscard: 打牌者以外にアクション要求
    if (round.phase === RoundPhase.AfterDiscard) {
      this.requestAfterDiscardActions(room);
      return;
    }

    // AfterKan: 槍槓チェック
    if (round.phase === RoundPhase.AfterKan) {
      this.requestAfterKanActions(room);
      return;
    }
  }

  // ========== DrawPhase処理 ==========

  private getDrawActions(round: RoundState, playerIndex: number): PlayerAction[] {
    const player = round.players[playerIndex];
    const handTiles = player.hand.getTiles();
    const drawnTile = handTiles[handTiles.length - 1];

    return getActionsAfterDraw({
      playerIndex,
      hand: player.hand,
      melds: player.melds,
      drawnTile,
      ruleConfig: round.ruleConfig,
      seatWind: player.seatWind,
      roundWind: round.roundWind,
      isFirstDraw: player.isFirstTurn,
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      isIppatsu: player.isIppatsu,
      isHaitei: round.wall.remainingDrawCount === 0,
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
      canKyuushuKyuuhai: player.isFirstTurn && round.ruleConfig.kyuushuKyuuhai !== "disabled",
      kuikaeForbiddenTypes: round.kuikaeForbiddenTypes,
    });
  }

  private getAfterDiscardActions(round: RoundState, playerIndex: number): PlayerAction[] {
    const discardTile = round.lastDiscardTile;
    const discardPlayer = round.lastDiscardPlayerIndex;
    if (!discardTile || discardPlayer === undefined) return [];
    if (discardPlayer === playerIndex) return [];

    const player = round.players[playerIndex];
    return getActionsAfterDiscard({
      playerIndex,
      hand: player.hand,
      melds: player.melds,
      discardTile,
      discardPlayerIndex: discardPlayer,
      ruleConfig: round.ruleConfig,
      seatWind: player.seatWind,
      roundWind: round.roundWind,
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      isIppatsu: player.isIppatsu,
      isHoutei: round.wall.remainingDrawCount === 0,
      isFuriten: isFuriten(round, playerIndex),
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });
  }

  private getAfterAnkanActions(round: RoundState, playerIndex: number): PlayerAction[] {
    const ankanTile = round.chankanTile;
    const kanPlayer = round.activePlayerIndex;
    if (!ankanTile || kanPlayer === playerIndex) return [];

    const player = round.players[playerIndex];
    return getActionsAfterAnkan({
      playerIndex,
      hand: player.hand,
      melds: player.melds,
      ankanTile,
      ankanPlayerIndex: kanPlayer,
      ruleConfig: round.ruleConfig,
      seatWind: player.seatWind,
      roundWind: round.roundWind,
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      isIppatsu: player.isIppatsu,
      isFuriten: isFuriten(round, playerIndex),
      doraCount: 0,
      uraDoraCount: 0,
      redDoraCount: 0,
    });
  }

  // ========== AfterDiscard処理 ==========

  private requestAfterDiscardActions(room: ActiveRoom): void {
    const round = room.roundState!;
    const discardPlayer = round.lastDiscardPlayerIndex!;
    room.pendingPlayerActions.clear();

    let waitingFor = 0;

    for (let i = 0; i < 4; i++) {
      if (i === discardPlayer) continue;
      const actions = this.getAfterDiscardActions(round, i);
      const meaningful = actions.filter((a) => a.type !== ActionType.Skip);

      if (meaningful.length === 0) {
        // スキップのみ → 自動スキップ
        room.pendingPlayerActions.set(i, { type: ActionType.Skip, playerIndex: i });
      } else {
        // アクション選択を要求
        this.sendActionsToPlayer(room, i, actions);
        waitingFor++;
      }
    }

    if (waitingFor === 0) {
      // 全員スキップ → 即解決
      this.resolveAfterDiscardActions(room);
    }
  }

  private requestAfterKanActions(room: ActiveRoom): void {
    const round = room.roundState!;
    const kanPlayer = round.activePlayerIndex;
    const chankanTile = round.chankanTile;
    room.pendingPlayerActions.clear();

    if (!chankanTile) {
      // 暗槓・大明槓 → 嶺上牌ツモへ
      resolveAfterKan(round, new Map());
      this.broadcastGameState(room);
      this.processGameLoop(room);
      return;
    }

    let waitingFor = 0;

    for (let i = 0; i < 4; i++) {
      if (i === kanPlayer) continue;
      const actions = round.isAnkanChankan
        ? this.getAfterAnkanActions(round, i)
        : this.getAfterDiscardActions(round, i);
      const ronActions = actions.filter((a) => a.type === ActionType.Ron);

      if (ronActions.length === 0) {
        room.pendingPlayerActions.set(i, { type: ActionType.Skip, playerIndex: i });
      } else {
        this.sendActionsToPlayer(room, i, [
          ...ronActions,
          { type: ActionType.Skip, playerIndex: i },
        ]);
        waitingFor++;
      }
    }

    if (waitingFor === 0) {
      resolveAfterKan(round, room.pendingPlayerActions);
      this.broadcastGameState(room);
      this.processGameLoop(room);
    }
  }

  // ========== アクション受信 ==========

  handlePlayerAction(socketId: string, actionDto: ActionDto): void {
    const info = this.getPlayerBySocket(socketId);
    if (!info) return;
    const { room, player } = info;
    if (room.status !== "playing" || !room.roundState) return;

    const round = room.roundState;
    const seatIndex = player.seatIndex;

    // ActionDto → PlayerAction に変換
    const action = this.deserializeAction(actionDto, round);
    if (!action) {
      this.sendError(socketId, "不正なアクションです");
      return;
    }

    // playerIndex の一致チェック
    if (action.playerIndex !== seatIndex) {
      this.sendError(socketId, "プレイヤーインデックスが一致しません");
      return;
    }

    // フェーズに応じた処理
    if (round.phase === RoundPhase.DrawPhase && round.activePlayerIndex === seatIndex) {
      // DrawPhaseのアクション
      const validActions = this.getDrawActions(round, seatIndex);
      if (!this.isValidAction(action, validActions)) {
        this.sendError(socketId, "無効なアクションです");
        return;
      }

      this.clearTimer(room, seatIndex);
      this.appendRoundActionEvent(room, action, round);
      applyAction(round, action);
      this.broadcastGameState(room);
      this.processGameLoop(room);
    } else if (
      round.phase === RoundPhase.AfterDiscard ||
      round.phase === RoundPhase.AfterKan
    ) {
      // AfterDiscard/AfterKanのアクション
      if (room.pendingPlayerActions.has(seatIndex)) {
        return; // 既に回答済み
      }

      this.clearTimer(room, seatIndex);
      this.appendRoundActionEvent(room, action, round);
      room.pendingPlayerActions.set(seatIndex, action);

      // 全員揃ったかチェック
      if (this.allActionsCollected(room)) {
        if (round.phase === RoundPhase.AfterDiscard) {
          this.resolveAfterDiscardActions(room);
        } else {
          resolveAfterKan(round, room.pendingPlayerActions);
          this.broadcastGameState(room);
          this.processGameLoop(room);
        }
      }
    }
  }

  private allActionsCollected(room: ActiveRoom): boolean {
    const round = room.roundState!;
    const excludeIdx =
      round.phase === RoundPhase.AfterDiscard
        ? round.lastDiscardPlayerIndex!
        : round.activePlayerIndex;

    for (let i = 0; i < 4; i++) {
      if (i === excludeIdx) continue;
      if (!room.pendingPlayerActions.has(i)) return false;
    }
    return true;
  }

  private resolveAfterDiscardActions(room: ActiveRoom): void {
    const round = room.roundState!;
    resolveAfterDiscard(round, room.pendingPlayerActions);
    room.pendingPlayerActions.clear();
    this.broadcastGameState(room);
    this.processGameLoop(room);
  }

  // ========== 局終了処理 ==========

  private handleRoundComplete(room: ActiveRoom): void {
    const round = room.roundState!;
    const game = room.gameState!;
    const result = round.result!;
    const completedRoundWind = game.currentRound.roundWind;
    const completedRoundNumber = game.currentRound.roundNumber;

    this.appendRoundResultEvent(room, result, round);
    const roundEventSnapshot = room.currentRoundEventData
      ? {
          ...room.currentRoundEventData,
          events: [...room.currentRoundEventData.events],
        }
      : null;

    processRoundResult(game, result);

    void (async () => {
      try {
        const roundId = await this.persistRoundResult(
          room,
          round,
          result,
          completedRoundWind,
          completedRoundNumber,
        );
        if (roundId && roundEventSnapshot) {
          await this.persistRoundEvent(roundId, JSON.stringify(roundEventSnapshot));
        }
      } catch (error) {
        console.error("Failed to persist online round result", error);
      }
    })();

    // 結果を送信
    const resultDto = this.toRoundResultDto(result);
    for (const p of room.players) {
      if (!p.socketId || !p.isConnected) continue;
      const view = this.buildPlayerView(room, p.seatIndex);
      view.roundResult = resultDto;
      this.io.to(p.socketId).emit("game:roundResult", { view, result: resultDto });
    }

    // ゲーム終了チェック
    if (game.phase === GamePhase.Finished) {
      const gameResult = calculateFinalResult(game);
      room.gameResult = gameResult;
      room.status = "finished";
      void this.persistGameFinished(room, gameResult).catch((error) => {
        console.error("Failed to persist online game result", error);
      });
      const gameResultDto = this.toGameResultDto(room, gameResult);
      for (const p of room.players) {
        if (!p.socketId || !p.isConnected) continue;
        const view = this.buildPlayerView(room, p.seatIndex);
        view.gameResult = gameResultDto;
        this.io.to(p.socketId).emit("game:gameResult", { view, result: gameResultDto });
      }
      this.cleanupRoom(room);
      return;
    }

    // 次の局を5秒後に開始
    setTimeout(() => {
      this.startNewRound(room);
    }, 5000);
  }

  // ========== アクション送信・タイムアウト ==========

  private sendActionsToPlayer(
    room: ActiveRoom,
    seatIndex: number,
    actions: PlayerAction[],
  ): void {
    const player = room.players[seatIndex];
    if (!player) return;

    const actionDtos = actions.map((a) => this.serializeAction(a));
    const view = this.buildPlayerView(room, seatIndex);
    view.availableActions = actionDtos;

    if (player.socketId && player.isConnected) {
      this.io.to(player.socketId).emit("game:stateUpdate", view);
    }

    // タイムアウト設定
    this.clearTimer(room, seatIndex);
    const timer = setTimeout(() => {
      this.handleTimeout(room, seatIndex, actions);
    }, room.actionTimeout * 1000);
    room.actionTimers.set(seatIndex, timer);
  }

  private handleTimeout(room: ActiveRoom, seatIndex: number, actions: PlayerAction[]): void {
    const round = room.roundState;
    if (!round) return;

    // デフォルトアクションを選択
    const defaultAction = this.chooseDefaultAction(actions, seatIndex);

    if (round.phase === RoundPhase.DrawPhase && round.activePlayerIndex === seatIndex) {
      this.appendRoundActionEvent(room, defaultAction, round);
      applyAction(round, defaultAction);
      this.broadcastGameState(room);
      this.processGameLoop(room);
    } else if (
      round.phase === RoundPhase.AfterDiscard ||
      round.phase === RoundPhase.AfterKan
    ) {
      if (!room.pendingPlayerActions.has(seatIndex)) {
        this.appendRoundActionEvent(room, defaultAction, round);
        room.pendingPlayerActions.set(seatIndex, defaultAction);
        if (this.allActionsCollected(room)) {
          if (round.phase === RoundPhase.AfterDiscard) {
            this.resolveAfterDiscardActions(room);
          } else {
            resolveAfterKan(round, room.pendingPlayerActions);
            this.broadcastGameState(room);
            this.processGameLoop(room);
          }
        }
      }
    }
  }

  private chooseDefaultAction(actions: PlayerAction[], seatIndex: number): PlayerAction {
    // スキップがあればスキップ
    const skip = actions.find((a) => a.type === ActionType.Skip);
    if (skip) return skip;

    // DrawPhaseではツモ切り
    const tsumogiri = actions.find(
      (a) => a.type === ActionType.Discard && a.isTsumogiri,
    );
    if (tsumogiri) return tsumogiri;

    // 最後のアクション（フォールバック）
    return actions[actions.length - 1] ?? { type: ActionType.Skip, playerIndex: seatIndex };
  }

  // ========== 状態送信 ==========

  broadcastGameState(room: ActiveRoom): void {
    for (const p of room.players) {
      if (!p.socketId || !p.isConnected) continue;
      const view = this.buildPlayerView(room, p.seatIndex);
      this.io.to(p.socketId).emit("game:stateUpdate", view);
    }
  }

  sendGameStateToPlayer(room: ActiveRoom, seatIndex: number): void {
    const player = room.players[seatIndex];
    if (!player?.socketId || !player.isConnected) return;
    const view = this.buildPlayerView(room, seatIndex);
    this.io.to(player.socketId).emit("game:stateUpdate", view);
  }

  private sendError(socketId: string, message: string): void {
    this.io.to(socketId).emit("game:error", { message });
  }

  // ========== 状態ビルド ==========

  buildPlayerView(room: ActiveRoom, seatIndex: number): PlayerGameView {
    const game = room.gameState;
    const round = room.roundState;

    if (!game || !round) {
      return this.buildEmptyView(room, seatIndex);
    }

    const self = this.buildSelfView(round, seatIndex, room);
    const opponents: OpponentPlayerView[] = [];
    for (let i = 0; i < 4; i++) {
      if (i === seatIndex) continue;
      opponents.push(this.buildOpponentView(round, i, room));
    }

    return {
      roomId: room.roomId,
      gamePhase: game.phase,
      roundWind: game.currentRound.roundWind,
      roundNumber: game.currentRound.roundNumber,
      honba: game.honba,
      riichiSticks: game.riichiSticks,
      dealerIndex: game.dealerIndex,
      initialDealerIndex: game.initialDealerIndex,
      turnCount: round.turnCount,
      roundPhase: round.phase,
      activePlayerIndex: round.activePlayerIndex,
      doraIndicators: round.wall.getDoraIndicators().map(tileToDto),
      remainingTiles: round.wall.remainingDrawCount,
      mySeatIndex: seatIndex,
      self,
      opponents,
      availableActions: [],
    };
  }

  private buildEmptyView(room: ActiveRoom, seatIndex: number): PlayerGameView {
    const self: SelfPlayerView = {
      seatIndex,
      seatWind: "",
      handTiles: [],
      melds: [],
      discards: [],
      isRiichi: false,
      isDoubleRiichi: false,
      score: 0,
      playerName: room.players[seatIndex]?.playerName ?? "",
    };
    return {
      roomId: room.roomId,
      gamePhase: "not-started",
      roundWind: "",
      roundNumber: 0,
      honba: 0,
      riichiSticks: 0,
      dealerIndex: 0,
      initialDealerIndex: 0,
      turnCount: 0,
      roundPhase: "not-started",
      activePlayerIndex: 0,
      doraIndicators: [],
      remainingTiles: 0,
      mySeatIndex: seatIndex,
      self,
      opponents: [],
      availableActions: [],
    };
  }

  private buildSelfView(round: RoundState, seatIndex: number, room: ActiveRoom): SelfPlayerView {
    const player = round.players[seatIndex];
    return {
      seatIndex,
      seatWind: player.seatWind,
      handTiles: player.hand.getTiles().map(tileToDto),
      melds: player.melds.map(meldToDto),
      discards: player.discard.getAllDiscards().map(discardEntryToDto),
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      score: player.score,
      playerName: room.players[seatIndex]?.playerName ?? "",
    };
  }

  private buildOpponentView(
    round: RoundState,
    seatIndex: number,
    room: ActiveRoom,
  ): OpponentPlayerView {
    const player = round.players[seatIndex];
    return {
      seatIndex,
      seatWind: player.seatWind,
      handCount: player.hand.getTiles().length,
      melds: player.melds.map(meldToDto),
      discards: player.discard.getAllDiscards().map(discardEntryToDto),
      isRiichi: player.isRiichi,
      isDoubleRiichi: player.isDoubleRiichi,
      score: player.score,
      playerName: room.players[seatIndex]?.playerName ?? "",
    };
  }

  // ========== アクションバリデーション ==========

  private isValidAction(action: PlayerAction, validActions: PlayerAction[]): boolean {
    return validActions.some((va) => {
      if (va.type !== action.type) return false;
      if (va.playerIndex !== action.playerIndex) return false;

      switch (va.type) {
        case ActionType.Discard:
          return (
            action.type === ActionType.Discard &&
            va.tile.type === action.tile.type &&
            va.tile.id === action.tile.id
          );
        case ActionType.Riichi:
          return (
            action.type === ActionType.Riichi &&
            va.tile.type === action.tile.type &&
            va.tile.id === action.tile.id
          );
        case ActionType.Ankan:
          return action.type === ActionType.Ankan && va.tileType === action.tileType;
        case ActionType.Kakan:
          return (
            action.type === ActionType.Kakan &&
            va.tile.type === action.tile.type &&
            va.tile.id === action.tile.id
          );
        case ActionType.Chi:
          return (
            action.type === ActionType.Chi &&
            va.candidate.calledTile.type === action.candidate.calledTile.type
          );
        default:
          return true; // Tsumo, Ron, Pon, Minkan, Skip, KyuushuKyuuhai
      }
    });
  }

  private createRoundEventData(game: GameState, round: RoundState): RoundEventDataDto {
    // 親は startRound 後に 14 枚持っているため、配牌の 13 枚のみを記録する。
    const initialHands: [TileDto[], TileDto[], TileDto[], TileDto[]] = [0, 1, 2, 3].map(
      (seatIndex) => {
        const tiles = round.players[seatIndex].hand.getTiles();
        const dealTiles = tiles.length === 14 ? tiles.slice(0, 13) : tiles;
        return dealTiles.map(tileToDto);
      },
    ) as [TileDto[], TileDto[], TileDto[], TileDto[]];

    return {
      version: 1,
      roundWind: game.currentRound.roundWind,
      roundNumber: game.currentRound.roundNumber,
      dealerIndex: game.dealerIndex,
      honba: round.honba,
      riichiSticks: round.riichiSticks,
      initialHands,
      events: [],
    };
  }

  private appendRoundActionEvent(room: ActiveRoom, action: PlayerAction, round: RoundState): void {
    if (!room.currentRoundEventData) return;

    const event: ReplayEventDto = {
      type: "action",
      actionType: action.type,
      playerIndex: action.playerIndex,
      roundPhase: round.phase,
    };

    switch (action.type) {
      case ActionType.Discard:
        event.type = "discard";
        event.tile = tileToDto(action.tile);
        event.isTsumogiri = action.isTsumogiri;
        break;
      case ActionType.Riichi:
        event.type = "riichi";
        event.tile = tileToDto(action.tile);
        break;
      case ActionType.Ankan:
        event.type = "ankan";
        event.tileType = action.tileType;
        break;
      case ActionType.Kakan:
        event.type = "kakan";
        event.tile = tileToDto(action.tile);
        break;
      case ActionType.Chi:
        event.type = "chi";
        event.tile = tileToDto(action.candidate.calledTile);
        event.fromPlayerIndex = round.lastDiscardPlayerIndex;
        break;
      case ActionType.Pon:
        event.type = "pon";
        if (round.lastDiscardTile) {
          event.tile = tileToDto(round.lastDiscardTile);
          event.fromPlayerIndex = round.lastDiscardPlayerIndex;
        }
        break;
      case ActionType.Minkan:
        event.type = "minkan";
        if (round.lastDiscardTile) {
          event.tile = tileToDto(round.lastDiscardTile);
          event.fromPlayerIndex = round.lastDiscardPlayerIndex;
        }
        break;
      case ActionType.Tsumo:
        event.type = "tsumo";
        event.ownTiles = round.players[action.playerIndex].hand.getTiles().map(tileToDto);
        break;
      case ActionType.Ron:
        event.type = "ron";
        if (round.lastDiscardTile) {
          event.tile = tileToDto(round.lastDiscardTile);
          event.fromPlayerIndex = round.lastDiscardPlayerIndex;
        }
        event.ownTiles = round.players[action.playerIndex].hand.getTiles().map(tileToDto);
        break;
      case ActionType.KyuushuKyuuhai:
        event.type = "kyuushu_kyuuhai";
        break;
      case ActionType.Skip:
        event.type = "skip";
        break;
      default:
        event.type = "action";
        break;
    }

    room.currentRoundEventData.events.push(event);
  }

  private appendRoundResultEvent(
    room: ActiveRoom,
    result: import("@mahjong-web/domain").RoundResult,
    round: RoundState,
  ): void {
    if (!room.currentRoundEventData) return;

    room.currentRoundEventData.events.push({
      type: "round_result",
      playerIndex: round.activePlayerIndex,
      reason: result.reason,
      scoreChanges: [...result.scoreChanges] as [number, number, number, number],
      tenpaiPlayers: [...result.tenpaiPlayers],
      dealerKeeps: result.dealerKeeps,
      roundPhase: round.phase,
    });
  }

  private appendDrawEvent(room: ActiveRoom, playerIndex: number, tile: import("@mahjong-web/domain").Tile): void {
    if (!room.currentRoundEventData) return;
    room.currentRoundEventData.events.push({
      type: "draw",
      playerIndex,
      tile: tileToDto(tile),
    });
  }

  private isPostMeldDrawPhase(room: ActiveRoom, playerIndex: number): boolean {
    const events = room.currentRoundEventData?.events;
    if (!events || events.length === 0) return false;
    const lastEvent = events[events.length - 1];
    return (
      lastEvent.playerIndex === playerIndex &&
      (lastEvent.type === "chi" || lastEvent.type === "pon" || lastEvent.type === "minkan")
    );
  }

  // ========== シリアライズ / デシリアライズ ==========

  private serializeAction(action: PlayerAction): ActionDto {
    const base: ActionDto = { type: action.type, playerIndex: action.playerIndex };
    switch (action.type) {
      case ActionType.Discard:
        return { ...base, tile: tileToDto(action.tile), isTsumogiri: action.isTsumogiri };
      case ActionType.Riichi:
        return { ...base, tile: tileToDto(action.tile) };
      case ActionType.Ankan:
        return { ...base, tileType: action.tileType };
      case ActionType.Kakan:
        return { ...base, tile: tileToDto(action.tile) };
      case ActionType.Chi:
        return {
          ...base,
          candidate: {
            tiles: [tileToDto(action.candidate.tiles[0]), tileToDto(action.candidate.tiles[1])],
            calledTile: tileToDto(action.candidate.calledTile),
            resultTiles: [
              tileToDto(action.candidate.resultTiles[0]),
              tileToDto(action.candidate.resultTiles[1]),
              tileToDto(action.candidate.resultTiles[2]),
            ],
          },
        };
      default:
        return base;
    }
  }

  private deserializeAction(dto: ActionDto, round: RoundState): PlayerAction | null {
    const playerIndex = dto.playerIndex;
    if (playerIndex < 0 || playerIndex > 3) return null;

    switch (dto.type) {
      case ActionType.Tsumo:
        return { type: ActionType.Tsumo, playerIndex };
      case ActionType.Ron:
        return { type: ActionType.Ron, playerIndex };
      case ActionType.Skip:
        return { type: ActionType.Skip, playerIndex };
      case ActionType.KyuushuKyuuhai:
        return { type: ActionType.KyuushuKyuuhai, playerIndex };
      case ActionType.Pon:
        return { type: ActionType.Pon, playerIndex };
      case ActionType.Minkan:
        return { type: ActionType.Minkan, playerIndex };
      case ActionType.Discard: {
        if (!dto.tile) return null;
        const tile = this.findTileInHand(round, playerIndex, dto.tile);
        if (!tile) return null;
        return {
          type: ActionType.Discard,
          playerIndex,
          tile,
          isTsumogiri: dto.isTsumogiri ?? false,
        };
      }
      case ActionType.Riichi: {
        if (!dto.tile) return null;
        const tile = this.findTileInHand(round, playerIndex, dto.tile);
        if (!tile) return null;
        return { type: ActionType.Riichi, playerIndex, tile };
      }
      case ActionType.Ankan: {
        if (!dto.tileType) return null;
        return { type: ActionType.Ankan, playerIndex, tileType: dto.tileType as Tile["type"] };
      }
      case ActionType.Kakan: {
        if (!dto.tile) return null;
        const tile = this.findTileInHand(round, playerIndex, dto.tile);
        if (!tile) return null;
        return { type: ActionType.Kakan, playerIndex, tile };
      }
      case ActionType.Chi: {
        if (!dto.candidate) return null;
        // ChiCandidateの復元: 手牌から該当する牌を探す
        const player = round.players[playerIndex];
        const handTiles = player.hand.getTiles() as Tile[];
        const t0 = handTiles.find(
          (t) => t.type === dto.candidate!.tiles[0].type && t.id === dto.candidate!.tiles[0].id,
        );
        const t1 = handTiles.find(
          (t) => t.type === dto.candidate!.tiles[1].type && t.id === dto.candidate!.tiles[1].id,
        );
        const calledTile = round.lastDiscardTile;
        if (!t0 || !t1 || !calledTile) return null;
        return {
          type: ActionType.Chi,
          playerIndex,
          candidate: {
            tiles: [t0, t1] as readonly [Tile, Tile],
            calledTile,
            resultTiles: [t0, calledTile, t1] as readonly [Tile, Tile, Tile],
          },
        };
      }
      default:
        return null;
    }
  }

  private findTileInHand(round: RoundState, playerIndex: number, dto: TileDto): Tile | null {
    const player = round.players[playerIndex];
    const handTiles = player.hand.getTiles();
    const found = handTiles.find((t) => t.type === dto.type && t.id === dto.id);
    return found ?? null;
  }

  // ========== DTO変換 ==========

  private toRoundResultDto(result: import("@mahjong-web/domain").RoundResult): RoundResultDto {
    return {
      reason: result.reason,
      wins: result.wins.map((w): WinEntryDto => ({
        winnerIndex: w.winnerIndex,
        loserIndex: w.loserIndex,
        totalHan: w.scoreResult.totalHan,
        totalFu: w.scoreResult.totalFu,
        level: w.scoreResult.level,
        yakuList: w.scoreResult.judgeResult.yakuList.map((y) => ({
          name: y.yaku,
          han: y.han,
        })),
        payment: {
          totalWinnerGain: w.scoreResult.payment.totalWinnerGain,
          ronLoserPayment: w.scoreResult.payment.ronLoserPayment,
          tsumoPaymentDealer: w.scoreResult.payment.tsumoPaymentDealer,
          tsumoPaymentChild: w.scoreResult.payment.tsumoPaymentChild,
        },
      })),
      scoreChanges: [...result.scoreChanges] as [number, number, number, number],
      tenpaiPlayers: [...result.tenpaiPlayers],
      dealerKeeps: result.dealerKeeps,
    };
  }

  private toGameResultDto(room: ActiveRoom, result: GameResult): GameResultDto {
    return {
      finalScores: [...result.finalScores] as [number, number, number, number],
      rankings: [...result.rankings] as [number, number, number, number],
      finalPoints: [...result.finalPoints] as [number, number, number, number],
      playerNames: room.players.map((p) => p.playerName),
    };
  }

  // ========== タイマー管理 ==========

  private clearTimer(room: ActiveRoom, seatIndex: number): void {
    const timer = room.actionTimers.get(seatIndex);
    if (timer) {
      clearTimeout(timer);
      room.actionTimers.delete(seatIndex);
    }
  }

  private clearAllTimers(room: ActiveRoom): void {
    for (const timer of room.actionTimers.values()) {
      clearTimeout(timer);
    }
    room.actionTimers.clear();
  }

  private cleanupRoom(room: ActiveRoom): void {
    this.clearAllTimers(room);
    // ソケットマッピングはクリーンアップ（ゲーム終了後）
    for (const p of room.players) {
      if (p.socketId) {
        this.socketToRoom.delete(p.socketId);
      }
      if (p.userId) {
        this.userToRoom.delete(p.userId);
      }
    }
    // ルーム自体は履歴として少し残すが、最終的に消す
    setTimeout(() => {
      this.rooms.delete(room.roomId);
    }, 60_000);
  }

  // ========== 同期リクエスト ==========

  handleSyncRequest(socketId: string): void {
    const info = this.getPlayerBySocket(socketId);
    if (!info) return;
    this.sendGameStateToPlayer(info.room, info.player.seatIndex);
  }
}

// ===== ユーティリティ関数 =====

function tileToDto(tile: Tile): TileDto {
  return { type: tile.type, id: tile.id, isRedDora: tile.isRedDora };
}

function meldToDto(meld: Meld): MeldDto {
  const dto: MeldDto = {
    type: meld.type,
    tiles: meld.tiles.map(tileToDto),
  };
  if (meld.calledTile) dto.calledTile = tileToDto(meld.calledTile);
  if (meld.fromPlayerIndex !== undefined) dto.fromPlayerIndex = meld.fromPlayerIndex;
  return dto;
}

function discardEntryToDto(
  entry: import("@mahjong-web/domain").DiscardEntry,
): DiscardEntryDto {
  const dto: DiscardEntryDto = {
    tile: tileToDto(entry.tile),
    isTsumogiri: entry.isTsumogiri,
    isRiichiDeclare: entry.isRiichiDeclare,
  };
  if (entry.calledBy !== undefined) {
    dto.calledByPlayerIndex = entry.calledBy;
  }
  return dto;
}
