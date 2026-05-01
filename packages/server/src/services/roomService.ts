import type { FastifyInstance } from "fastify";

type PrismaClient = FastifyInstance["prisma"];

export class RoomService {
  constructor(private prisma: PrismaClient) {}

  async createRoom(
    userId: string,
    playerName: string,
    gameType: string,
    ruleConfig: string,
  ) {
    return this.prisma.game.create({
      data: {
        gameType,
        ruleConfig,
        gamePlayers: {
          create: {
            userId,
            seatIndex: 0,
            playerName,
          },
        },
      },
      include: { gamePlayers: true },
    });
  }

  async joinRoom(gameId: string, userId: string | null, playerName: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });

    if (!game) throw new Error("Room not found");
    if (game.status !== "waiting") throw new Error("Game already started");
    if (game.gamePlayers.length >= 4) throw new Error("Room is full");

    const nextSeat = game.gamePlayers.length;

    return this.prisma.gamePlayer.create({
      data: {
        gameId,
        userId,
        seatIndex: nextSeat,
        playerName,
      },
    });
  }

  async getRoom(gameId: string) {
    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });
  }

  async startGame(gameId: string) {
    return this.prisma.game.update({
      where: { id: gameId },
      data: { status: "playing" },
    });
  }

  async finishGame(
    gameId: string,
    results: Array<{
      gamePlayerId: string;
      finalScore: number;
      finalRank: number;
      ratingDelta: number;
    }>,
  ) {
    return this.prisma.$transaction(async (tx: {
      game: PrismaClient["game"];
      gamePlayer: PrismaClient["gamePlayer"];
    }) => {
      await tx.game.update({
        where: { id: gameId },
        data: { status: "finished", finishedAt: new Date() },
      });

      for (const r of results) {
        await tx.gamePlayer.update({
          where: { id: r.gamePlayerId },
          data: {
            finalScore: r.finalScore,
            finalRank: r.finalRank,
            ratingDelta: r.ratingDelta,
          },
        });
      }
    });
  }
}
