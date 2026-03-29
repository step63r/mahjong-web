import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import fastifySocketIO from "fastify-socket.io";

import { config } from "./config.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { roomRoutes } from "./routes/rooms.js";
import { statsRoutes } from "./routes/stats.js";
import { registerSocketHandlers } from "./ws/index.js";

import type { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // --- プラグイン登録 ---
  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(cookie);
  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(sensible);

  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(fastifySocketIO, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(prismaPlugin);
  // @ts-expect-error Fastify 5 プラグイン型互換性の既知問題
  await app.register(authPlugin);

  // --- ルート登録 ---
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(roomRoutes, { prefix: "/api/rooms" });
  await app.register(statsRoutes, { prefix: "/api/stats" });

  // --- ヘルスチェック ---
  app.get("/api/health", async () => ({ status: "ok" }));

  // --- Socket.IO ハンドラ登録 ---
  app.ready().then(() => {
    registerSocketHandlers(app.io);
  });

  return app;
}
