import { z } from "zod";

import type { FastifyInstance } from "fastify";

const createRoomSchema = z.object({
  gameType: z.enum(["tonpu", "hanchan"]),
  ruleConfig: z.record(z.string(), z.unknown()),
});

export async function roomRoutes(app: FastifyInstance) {
  // POST /api/rooms — ルーム作成
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = createRoomSchema.parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { firebaseUid: request.uid! },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const game = await app.prisma.game.create({
        data: {
          gameType: body.gameType,
          ruleConfig: JSON.stringify(body.ruleConfig),
          gamePlayers: {
            create: {
              userId: user.id,
              seatIndex: 0,
              playerName: user.displayName,
            },
          },
        },
        include: { gamePlayers: true },
      });

      return reply.status(201).send({
        roomId: game.id,
        gameType: game.gameType,
        players: game.gamePlayers.map((p) => ({
          seatIndex: p.seatIndex,
          playerName: p.playerName,
        })),
      });
    },
  );

  // GET /api/rooms/:roomId — ルーム情報取得
  app.get<{ Params: { roomId: string } }>(
    "/:roomId",
    async (request, reply) => {
      const game = await app.prisma.game.findUnique({
        where: { id: request.params.roomId },
        include: { gamePlayers: true },
      });

      if (!game) {
        return reply.code(404).send({ error: "Room not found" });
      }

      return reply.send({
        roomId: game.id,
        gameType: game.gameType,
        status: game.status,
        players: game.gamePlayers.map((p) => ({
          seatIndex: p.seatIndex,
          playerName: p.playerName,
        })),
      });
    },
  );
}
