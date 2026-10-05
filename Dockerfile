# syntax=docker/dockerfile:1

# ---- ベース ----
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 依存パッケージのインストール ----
FROM base AS deps
# better-sqlite3 のビルド済みバイナリが使えない環境向けにビルドツールを入れておく
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall の prisma generate 用に schema もコピーしておく
RUN npm ci

# ---- ビルド ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ が空だと Git に含まれずクローン先に存在しないため、無ければ作る
RUN mkdir -p public
# Prisma クライアント (src/generated) はリポジトリに含めないので、ここで生成する
RUN npx prisma generate
# ビルド中にも認証設定が読み込まれるため、ダミー値を渡す (実行時は .env.production の値を使う)
RUN BETTER_AUTH_SECRET=build-time-placeholder BETTER_AUTH_URL=http://localhost:3000 npm run build

# ---- マイグレーション実行用 (起動時に 1 回だけ prisma migrate deploy を実行) ----
FROM builder AS migrate
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- 本番実行用 ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN mkdir -p /data && chown node:node /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
