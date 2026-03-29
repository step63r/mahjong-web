import fp from "fastify-plugin";
import admin from "firebase-admin";
import { createError } from "@fastify/error";

import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    uid?: string;
    firebaseUser?: admin.auth.DecodedIdToken;
  }
}

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;
  // 開発環境では Firebase エミュレータを使う場合、
  // FIREBASE_AUTH_EMULATOR_HOST 環境変数を設定する
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  firebaseInitialized = true;
}

async function auth(app: FastifyInstance) {
  initFirebase();

  // Firebase ID トークンを検証するデコレータ
  app.decorateRequest("uid", undefined);
  app.decorateRequest("firebaseUser", undefined);

  // 認証が必要なルート用の preHandler
  app.decorate(
    "authenticate",
    async (request: FastifyRequest) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        throw createError("UNAUTHORIZED", "Missing or invalid Authorization header", 401)();
      }

      const token = authHeader.slice(7);
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        request.uid = decoded.uid;
        request.firebaseUser = decoded;
      } catch {
        throw createError("UNAUTHORIZED", "Invalid Firebase ID token", 401)();
      }
    },
  );
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

// @ts-expect-error Fastify 5 + fastify-plugin 型互換性の既知問題
export const authPlugin = fp(auth, {
  name: "auth",
  dependencies: ["prisma"],
});
