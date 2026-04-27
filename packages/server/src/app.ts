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
import { GameManager } from "./game/GameManager.js";

import type { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
    gameManager: GameManager;
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
  app.get("/", async () => ({ status: "ok", name: "mahjong-web-server" }));
  app.get("/api/health", async () => ({ status: "ok" }));

  // --- Socket.IO ハンドラ登録 ---
  // GameManager は ready 後に io が利用可能になってから初期化する
  app.ready().then(() => {
    const gameManager = new GameManager(app.io, app.prisma);
    // decorate は ready 前に行えないため、プロパティとして直接設定
    (app as unknown as Record<string, unknown>)["gameManager"] = gameManager;
    registerSocketHandlers(app.io, gameManager);
  });

  return app;
}
