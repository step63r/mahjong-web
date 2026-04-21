import fp from "fastify-plugin";
import admin from "firebase-admin";
import { createError } from "@fastify/error";
import { config } from "../config.js";

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
  if (admin.apps.length) {
    firebaseInitialized = true;
    return;
  }

  const projectId = config.firebase.projectId;
  const credentialsJson = process.env["FIREBASE_ADMIN_CREDENTIALS_JSON"];
  const credentialsPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"];

  // 本番推奨: サービスアカウント JSON をシークレット環境変数として注入
  if (credentialsJson) {
    try {
      const parsed = JSON.parse(credentialsJson) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId,
      });
      firebaseInitialized = true;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid FIREBASE_ADMIN_CREDENTIALS_JSON: ${message}`);
    }
  }

  // ローカル開発互換: サービスアカウント JSON ファイルパスを利用
  if (credentialsPath) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    firebaseInitialized = true;
    return;
  }

  throw new Error(
    "Firebase Admin credential is not configured. Set FIREBASE_ADMIN_CREDENTIALS_JSON (recommended) or GOOGLE_APPLICATION_CREDENTIALS.",
  );
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
      } catch (error) {
        request.log.warn(
          {
            err: error,
            code:
              typeof error === "object" && error !== null && "code" in error
                ? (error as { code?: string }).code
                : undefined,
          },
          "Firebase ID token verification failed",
        );
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
