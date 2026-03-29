import type { FastifyInstance } from "fastify";

export async function statsRoutes(app: FastifyInstance) {
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
