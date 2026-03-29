import { z } from "zod";

import type { FastifyInstance } from "fastify";

const loginSchema = z.object({
  idToken: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — Firebase ID トークンでログイン/ユーザー登録
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // Firebase トークン検証
    const authHeader = `Bearer ${body.idToken}`;
    request.headers.authorization = authHeader;
    await app.authenticate(request);

    const uid = request.uid!;
    const firebaseUser = request.firebaseUser!;

    // ユーザーの upsert
    const user = await app.prisma.user.upsert({
      where: { firebaseUid: uid },
      update: {
        displayName: firebaseUser.name ?? "名無し",
        photoUrl: firebaseUser.picture ?? null,
      },
      create: {
        firebaseUid: uid,
        displayName: firebaseUser.name ?? "名無し",
        photoUrl: firebaseUser.picture ?? null,
      },
    });

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
    });
  });

  // GET /api/auth/me — ログイン中のユーザー情報取得
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

      return reply.send({
        id: user.id,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
      });
    },
  );
}
