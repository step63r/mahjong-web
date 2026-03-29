import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prisma(app: FastifyInstance) {
  const adapter = new PrismaBetterSqlite3({
    url: process.env["DATABASE_URL"] ?? "file:./prisma/dev.db",
  });
  const client = new PrismaClient({ adapter });

  app.decorate("prisma", client);

  app.addHook("onClose", async () => {
    await client.$disconnect();
  });
}

// @ts-expect-error Fastify 5 + fastify-plugin 型互換性の既知問題
export const prismaPlugin = fp(prisma, { name: "prisma" });
