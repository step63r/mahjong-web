import type { FastifyInstance } from "fastify";

type PrismaClient = FastifyInstance["prisma"];

export class StatsService {
  constructor(private prisma: PrismaClient) {}

  async getUserSummary(userId: string) {
    const gamePlayers = await this.prisma.gamePlayer.findMany({
      where: { userId, finalRank: { not: null } },
      orderBy: { game: { finishedAt: "desc" } },
      take: 100,
    });

    const totalGames = gamePlayers.length;
    const rankCounts = [0, 0, 0, 0];
    let rankSum = 0;

    for (const gp of gamePlayers) {
      if (gp.finalRank != null) {
        rankCounts[gp.finalRank - 1]++;
        rankSum += gp.finalRank;
      }
    }

    return {
      totalGames,
      rankCounts,
      averageRank: totalGames > 0 ? Math.round((rankSum / totalGames) * 100) / 100 : 0,
    };
  }

  async saveRoundStats(
    roundId: string,
    stats: Array<{
      gamePlayerId: string;
      isWinner: boolean;
      isLoser: boolean;
      scoreDelta: number;
      yakuList?: string;
      han?: number;
      fu?: number;
    }>,
  ) {
    return this.prisma.roundPlayerStat.createMany({
      data: stats.map((s) => ({
        roundId,
        gamePlayerId: s.gamePlayerId,
        isWinner: s.isWinner,
        isLoser: s.isLoser,
        scoreDelta: s.scoreDelta,
        yakuList: s.yakuList,
        han: s.han,
        fu: s.fu,
      })),
    });
  }
}
