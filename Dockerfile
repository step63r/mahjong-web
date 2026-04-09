# ===== Stage 1: ビルド =====
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# 依存関係インストール（client は除外）
RUN npm ci --workspace=packages/domain --workspace=packages/shared --workspace=packages/server --include-workspace-root

# ソース + Prisma スキーマをコピー
COPY tsconfig.base.json ./
COPY packages/domain/ packages/domain/
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Prisma Client 生成
RUN npx prisma generate --schema=packages/server/prisma/schema.prisma

# TypeScript ビルド（domain → shared → server）
RUN npm run build --workspace=packages/domain
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/server

# ===== Stage 2: 実行 =====
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 本番依存のみインストール
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm ci --workspace=packages/domain --workspace=packages/shared --workspace=packages/server --include-workspace-root --omit=dev

# Prisma スキーマ + マイグレーション + 生成済みクライアント
COPY packages/server/prisma/ packages/server/prisma/
COPY packages/server/prisma.config.ts packages/server/
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma

# ビルド成果物をコピー
COPY --from=builder /app/packages/domain/dist packages/domain/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/server/dist packages/server/dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# マイグレーション実行後にサーバー起動
CMD ["sh", "-c", "cd packages/server && npx prisma migrate deploy && cd /app && node packages/server/dist/index.js"]
