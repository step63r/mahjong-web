import { z } from "zod";

import type { FastifyInstance } from "fastify";

const createRoomSchema = z.object({
  gameType: z.enum(["tonpu", "hanchan"]),
  ruleConfig: z.record(z.string(), z.unknown()),
});

const joinRoomSchema = z.object({
  playerName: z.string().min(1).max(20),
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
        status: game.status,
        hostSeatIndex: 0,
        players: game.gamePlayers.map((p) => ({
          seatIndex: p.seatIndex,
          playerName: p.playerName,
          isConnected: false,
          userId: p.userId,
        })),
      });
    },
  );

  // POST /api/rooms/:roomId/join — ルーム参加（ゲスト可）
  app.post<{ Params: { roomId: string } }>(
    "/:roomId/join",
    async (request, reply) => {
      const body = joinRoomSchema.parse(request.body);
      const gameId = request.params.roomId;

      const game = await app.prisma.game.findUnique({
        where: { id: gameId },
        include: { gamePlayers: true },
      });

      if (!game) {
        return reply.code(404).send({ error: "Room not found" });
      }

      if (game.status !== "waiting") {
        return reply.code(400).send({ error: "Game already started" });
      }

      if (game.gamePlayers.length >= 4) {
        return reply.code(400).send({ error: "Room is full" });
      }

      // ログインユーザーかゲストか判定
      let userId: string | null = null;
      if (request.uid) {
        const user = await app.prisma.user.findUnique({
          where: { firebaseUid: request.uid },
        });
        userId = user?.id ?? null;
      }

      const nextSeat = game.gamePlayers.length;
      await app.prisma.gamePlayer.create({
        data: {
          gameId,
          userId,
          seatIndex: nextSeat,
          playerName: body.playerName,
        },
      });

      const updated = await app.prisma.game.findUnique({
        where: { id: gameId },
        include: { gamePlayers: true },
      });

      return reply.send({
        roomId: updated!.id,
        gameType: updated!.gameType,
        status: updated!.status,
        hostSeatIndex: 0,
        players: updated!.gamePlayers.map((p) => ({
          seatIndex: p.seatIndex,
          playerName: p.playerName,
          isConnected: false,
          userId: p.userId,
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
        hostSeatIndex: 0,
        players: game.gamePlayers.map((p) => ({
          seatIndex: p.seatIndex,
          playerName: p.playerName,
          isConnected: false,
          userId: p.userId,
        })),
      });
    },
  );
}
