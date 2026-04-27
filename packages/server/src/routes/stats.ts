import { z } from "zod";

import type { FastifyInstance } from "fastify";

const yakuEntrySchema = z.object({
  name: z.string().min(1),
  han: z.number().int().min(0).optional(),
});

const cpuRoundPlayerStatSchema = z.object({
  seatIndex: z.number().int().min(0).max(3),
  isWinner: z.boolean(),
  isLoser: z.boolean(),
  scoreDelta: z.number().int(),
  yakuList: z.array(yakuEntrySchema).optional(),
  han: z.number().int().min(0).optional(),
  fu: z.number().int().min(0).optional(),
});

const cpuRoundSchema = z.object({
  roundWind: z.number().int().min(0),
  roundNumber: z.number().int().min(0),
  honba: z.number().int().min(0),
  resultType: z.string().min(1),
  stats: z.array(cpuRoundPlayerStatSchema).length(4),
});

const cpuGamePlayerSchema = z.object({
  seatIndex: z.number().int().min(0).max(3),
  playerName: z.string().min(1).max(20),
  finalScore: z.number().int(),
  finalRank: z.number().int().min(1).max(4),
});

const saveCpuGameSchema = z
  .object({
    gameType: z.enum(["cpu_tonpu", "cpu_hanchan"]),
    ruleConfig: z.record(z.string(), z.unknown()),
    selfSeatIndex: z.number().int().min(0).max(3).default(0),
    finishedAt: z.string().datetime().optional(),
    players: z.array(cpuGamePlayerSchema).length(4),
    rounds: z.array(cpuRoundSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const seatSet = new Set(value.players.map((p) => p.seatIndex));
    if (seatSet.size !== value.players.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "players.seatIndex must be unique",
      });
    }

    const hasSelfSeat = value.players.some((p) => p.seatIndex === value.selfSeatIndex);
    if (!hasSelfSeat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "selfSeatIndex does not exist in players",
      });
    }

    const rankSet = new Set(value.players.map((p) => p.finalRank));
    if (rankSet.size !== value.players.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "players.finalRank must be unique",
      });
    }

    value.rounds.forEach((round, roundIndex) => {
      const statSeatSet = new Set(round.stats.map((s) => s.seatIndex));
      if (statSeatSet.size !== round.stats.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rounds", roundIndex, "stats"],
          message: "round.stats.seatIndex must be unique",
        });
      }

      for (const stat of round.stats) {
        if (!seatSet.has(stat.seatIndex)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rounds", roundIndex, "stats"],
            message: `Unknown seatIndex in stats: ${stat.seatIndex}`,
          });
        }
      }
    });
  });

export async function statsRoutes(app: FastifyInstance) {
  // POST /api/stats/games/cpu — CPU戦の戦績を保存
  app.post(
    "/games/cpu",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = saveCpuGameSchema.parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { firebaseUid: request.uid! },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const finishedAt = body.finishedAt ? new Date(body.finishedAt) : new Date();

      const created = await app.prisma.$transaction(async (tx) => {
        const game = await tx.game.create({
          data: {
            gameType: body.gameType,
            status: "finished",
            ruleConfig: JSON.stringify(body.ruleConfig),
            finishedAt,
            gamePlayers: {
              create: body.players.map((player) => ({
                seatIndex: player.seatIndex,
                playerName: player.playerName,
                finalScore: player.finalScore,
                finalRank: player.finalRank,
                userId: player.seatIndex === body.selfSeatIndex ? user.id : null,
              })),
            },
          },
          include: {
            gamePlayers: true,
          },
        });

        const gamePlayerIdBySeat = new Map(
          game.gamePlayers.map((player) => [player.seatIndex, player.id]),
        );

        for (const round of body.rounds) {
          const createdRound = await tx.round.create({
            data: {
              gameId: game.id,
              roundWind: round.roundWind,
              roundNumber: round.roundNumber,
              honba: round.honba,
              resultType: round.resultType,
            },
          });

          await tx.roundPlayerStat.createMany({
            data: round.stats.map((stat) => {
              const gamePlayerId = gamePlayerIdBySeat.get(stat.seatIndex);
              if (!gamePlayerId) {
                throw new Error(`Unknown seatIndex: ${stat.seatIndex}`);
              }

              return {
                roundId: createdRound.id,
                gamePlayerId,
                isWinner: stat.isWinner,
                isLoser: stat.isLoser,
                scoreDelta: stat.scoreDelta,
                yakuList: stat.yakuList ? JSON.stringify(stat.yakuList) : null,
                han: stat.han,
                fu: stat.fu,
              };
            }),
          });
        }

        return {
          gameId: game.id,
          roundCount: body.rounds.length,
        };
      });

      return reply.code(201).send({
        gameId: created.gameId,
        roundCount: created.roundCount,
      });
    },
  );

  // GET /api/stats/me — 自分の戦績サマリー
  app.get(
    "/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { firebaseUid: request.uid! },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      // 直近の対局一覧（最大20件）
      const recentGames = await app.prisma.gamePlayer.findMany({
        where: { userId: user.id, finalRank: { not: null } },
        orderBy: { game: { finishedAt: "desc" } },
        take: 20,
        include: { game: true },
      });

      // 順位の集計
      const rankCounts = [0, 0, 0, 0]; // 1位, 2位, 3位, 4位
      let totalScore = 0;

      for (const gp of recentGames) {
        if (gp.finalRank != null) {
          rankCounts[gp.finalRank - 1]++;
        }
        if (gp.finalScore != null) {
          totalScore += gp.finalScore;
        }
      }

      const totalGames = recentGames.length;
      const averageRank =
        totalGames > 0
          ? recentGames.reduce((sum, gp) => sum + (gp.finalRank ?? 0), 0) / totalGames
          : 0;

      // 和了/放銃の統計
      const roundStats = await app.prisma.roundPlayerStat.findMany({
        where: {
          gamePlayer: { userId: user.id },
        },
      });

      const wins = roundStats.filter((s) => s.isWinner);
      const losses = roundStats.filter((s) => s.isLoser);

      return reply.send({
        totalGames,
        rankCounts,
        averageRank: Math.round(averageRank * 100) / 100,
        totalScore,
        winCount: wins.length,
        lossCount: losses.length,
        averageWinHan:
          wins.length > 0
            ? Math.round(
                (wins.reduce((s, w) => s + (w.han ?? 0), 0) / wins.length) * 100,
              ) / 100
            : 0,
        averageLossScoreDelta:
          losses.length > 0
            ? Math.round(
                losses.reduce((s, l) => s + l.scoreDelta, 0) / losses.length,
              )
            : 0,
      });
    },
  );

  // GET /api/stats/me/games — 対局履歴一覧
  app.get(
    "/me/games",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { firebaseUid: request.uid! },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const games = await app.prisma.gamePlayer.findMany({
        where: { userId: user.id, finalRank: { not: null } },
        orderBy: { game: { finishedAt: "desc" } },
        take: 50,
        include: {
          game: {
            include: {
              gamePlayers: {
                orderBy: { finalRank: "asc" },
              },
            },
          },
        },
      });

      return reply.send(
        games.map((gp) => ({
          gameId: gp.gameId,
          gameType: gp.game.gameType,
          finishedAt: gp.game.finishedAt,
          myRank: gp.finalRank,
          myScore: gp.finalScore,
          players: gp.game.gamePlayers.map((p) => ({
            playerName: p.playerName,
            finalScore: p.finalScore,
            finalRank: p.finalRank,
          })),
        })),
      );
    },
  );
}
