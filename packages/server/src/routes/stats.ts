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

const replayTileSchema = z.object({
  type: z.string().min(1),
  id: z.number().int().min(0),
  isRedDora: z.boolean(),
});

const replayEventSchema = z.object({
  type: z.string().min(1),
  playerIndex: z.number().int().min(0).max(3),
  actionType: z.string().optional(),
  tile: replayTileSchema.optional(),
  tileType: z.string().optional(),
  isTsumogiri: z.boolean().optional(),
  fromPlayerIndex: z.number().int().min(0).max(3).optional(),
  roundPhase: z.string().optional(),
  reason: z.string().optional(),
  scoreChanges: z.tuple([
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
  ]).optional(),
  dealerKeeps: z.boolean().optional(),
  ownTiles: z.array(replayTileSchema).optional(),
  yakuList: z.array(yakuEntrySchema).optional(),
  totalHan: z.number().int().optional(),
  totalFu: z.number().int().optional(),
  loserIndex: z.number().int().min(0).max(3).optional(),
  tenpaiPlayers: z.array(z.boolean()).length(4).optional(),
});

const roundEventDataSchema = z.object({
  version: z.number().int().min(1),
  roundWind: z.string().min(1),
  roundNumber: z.number().int().min(1),
  dealerIndex: z.number().int().min(0).max(3),
  honba: z.number().int().min(0),
  riichiSticks: z.number().int().min(0),
  initialHands: z.tuple([
    z.array(replayTileSchema),
    z.array(replayTileSchema),
    z.array(replayTileSchema),
    z.array(replayTileSchema),
  ]),
  events: z.array(replayEventSchema),
});

const saveCpuGameSchema = z
  .object({
    gameType: z.enum(["cpu_tonpu", "cpu_hanchan"]),
    ruleConfig: z.record(z.string(), z.unknown()),
    selfSeatIndex: z.number().int().min(0).max(3).default(0),
    finishedAt: z.string().datetime().optional(),
    players: z.array(cpuGamePlayerSchema).length(4),
    rounds: z.array(cpuRoundSchema).min(1),
    roundEvents: z.array(roundEventDataSchema).optional(),
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

    if (value.roundEvents && value.roundEvents.length !== value.rounds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roundEvents"],
        message: "roundEvents length must match rounds length",
      });
    }
  });

const statsSummaryQuerySchema = z.object({
  gameType: z.enum(["cpu", "online"]).optional(),
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
          game.gamePlayers.map((player: typeof game.gamePlayers[0]) => [player.seatIndex, player.id]),
        );

        for (const [roundIndex, round] of body.rounds.entries()) {
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

          const roundEvent = body.roundEvents?.[roundIndex];
          if (roundEvent) {
            await tx.roundEvent.create({
              data: {
                roundId: createdRound.id,
                eventData: JSON.stringify(roundEvent),
              },
            });
          }
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
      const query = statsSummaryQuerySchema.parse(request.query);

      const user = await app.prisma.user.findUnique({
        where: { firebaseUid: request.uid! },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const gameTypeFilter =
        query.gameType === "cpu"
          ? ({ startsWith: "cpu_" } as const)
          : query.gameType === "online"
            ? ({ startsWith: "online_" } as const)
            : undefined;

      const gamePlayerWhere = {
        userId: user.id,
        finalRank: { not: null },
        ...(gameTypeFilter ? { game: { gameType: gameTypeFilter } } : {}),
      };

      // 全期間の対局一覧（平均値などに使用）
      const allGames = await app.prisma.gamePlayer.findMany({
        where: gamePlayerWhere,
        include: { game: true },
      });

      // 直近10試合の順位（グラフ用）
      const recentGamesDesc = await app.prisma.gamePlayer.findMany({
        where: gamePlayerWhere,
        orderBy: { game: { finishedAt: "desc" } },
        take: 10,
        include: { game: true },
      });
      const recentGames = [...recentGamesDesc].reverse();

      // 順位の集計
      const rankCounts = [0, 0, 0, 0]; // 1位, 2位, 3位, 4位
      let totalScore = 0;

      for (const gp of allGames) {
        if (gp.finalRank != null) {
          rankCounts[gp.finalRank - 1]++;
        }
        if (gp.finalScore != null) {
          totalScore += gp.finalScore;
        }
      }

      const totalGames = allGames.length;
      const averageRank =
        totalGames > 0
          ? allGames.reduce((sum: number, gp: typeof allGames[0]) => sum + (gp.finalRank ?? 0), 0) / totalGames
          : 0;

      // 和了/放銃の統計
      const roundStats = await app.prisma.roundPlayerStat.findMany({
        where: {
          gamePlayer: {
            userId: user.id,
            ...(gameTypeFilter ? { game: { gameType: gameTypeFilter } } : {}),
          },
        },
        select: {
          roundId: true,
          isWinner: true,
          isLoser: true,
          scoreDelta: true,
          yakuList: true,
          han: true,
        },
      });

      const wins = roundStats.filter((s: typeof roundStats[0]) => s.isWinner);
      const losses = roundStats.filter((s: typeof roundStats[0]) => s.isLoser);

      const averageWinScore =
        wins.length > 0
          ? Math.round(wins.reduce((sum: number, stat: typeof wins[0]) => sum + stat.scoreDelta, 0) / wins.length)
          : 0;

      const averageWinHan =
        wins.length > 0
          ? Math.round((wins.reduce((sum: number, stat: typeof wins[0]) => sum + (stat.han ?? 0), 0) / wins.length) * 100) /
            100
          : 0;

      // 放銃打点は見やすさのため正値（失点の絶対値）で返す
      const averageLossScore =
        losses.length > 0
          ? Math.round(
              losses.reduce((sum: number, stat: typeof losses[0]) => sum + Math.abs(stat.scoreDelta), 0) /
                losses.length,
            )
          : 0;

      // 放銃時の飜数は、同じ roundId の勝者ハンド飜数から推定
      const winnerHanByRound = new Map<string, number[]>();
      for (const win of wins) {
        if (win.han == null) continue;
        const list = winnerHanByRound.get(win.roundId) ?? [];
        list.push(win.han);
        winnerHanByRound.set(win.roundId, list);
      }

      const lossHans: number[] = [];
      for (const loss of losses) {
        const winnerHans = winnerHanByRound.get(loss.roundId);
        if (!winnerHans || winnerHans.length === 0) continue;
        const avgHanInRound =
          winnerHans.reduce((sum, han) => sum + han, 0) / winnerHans.length;
        lossHans.push(avgHanInRound);
      }

      const averageLossHan =
        lossHans.length > 0
          ? Math.round(
              (lossHans.reduce((sum, han) => sum + han, 0) / lossHans.length) * 100,
            ) / 100
          : 0;

      const yakuCounts = new Map<string, number>();
      for (const win of wins) {
        if (!win.yakuList) continue;
        try {
          const parsed = JSON.parse(win.yakuList) as unknown;
          if (!Array.isArray(parsed)) continue;

          for (const entry of parsed) {
            if (typeof entry !== "object" || entry === null) continue;
            const record = entry as Record<string, unknown>;
            const rawName =
              typeof record["name"] === "string"
                ? record["name"]
                : typeof record["yaku"] === "string"
                  ? record["yaku"]
                  : null;
            if (!rawName) continue;
            yakuCounts.set(rawName, (yakuCounts.get(rawName) ?? 0) + 1);
          }
        } catch {
          // 破損データは集計から除外
        }
      }

      return reply.send({
        gameType: query.gameType ?? "all",
        totalGames,
        rankCounts,
        averageRank: Math.round(averageRank * 100) / 100,
        totalScore,
        recentRanks: recentGames.map((gp, index) => ({
          order: index + 1,
          gameId: gp.gameId,
          finishedAt: gp.game.finishedAt,
          rank: gp.finalRank,
        })),
        winCount: wins.length,
        lossCount: losses.length,
        averageWinScore,
        averageWinHan,
        averageLossScore,
        averageLossHan,
        yakuStats: Array.from(yakuCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        // 既存クライアント互換のため残す（負値）
        averageLossScoreDelta:
          losses.length > 0
            ? Math.round(
                losses.reduce((s: number, l: typeof losses[0]) => s + l.scoreDelta, 0) / losses.length,
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
        games.map((gp: typeof games[0]) => ({
          gameId: gp.gameId,
          gameType: gp.game.gameType,
          finishedAt: gp.game.finishedAt,
          myRank: gp.finalRank,
          myScore: gp.finalScore,
          players: gp.game.gamePlayers.map((p: typeof gp.game.gamePlayers[0]) => ({
            playerName: p.playerName,
            finalScore: p.finalScore,
            finalRank: p.finalRank,
          })),
        })),
      );
    },
  );
}
