# ─────────────────────────────────────────────────────────────────────────────
# PoolDN — production image
#
# Debian slim (not alpine) on purpose: prisma.config.ts pins the *classic*
# query engine, so the container needs a glibc + openssl 3 base to match the
# engine binary `prisma generate` downloads.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22-bookworm-slim

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .

# NEXT_PUBLIC_* are inlined at build time, so the public origin must be known
# here — not at run time. Rebuild the image if the domain changes.
ARG NEXT_PUBLIC_APP_URL=https://pooldn.com
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# `next build` and `prisma generate` never open a connection, but
# prisma.config.ts declares DATABASE_URL as required and Prisma refuses to
# construct a client without a syntactically valid URL. Not used at run time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public


# Regenerate the Prisma client inside the image — the committed one carries a
# darwin-arm64 engine. No database connection is needed for `generate`.
RUN npx prisma generate

# lib/graphql/generated is gitignored; it ships in the build context when the
# host has run codegen. Regenerate it when building from a clean checkout.
RUN if [ ! -f lib/graphql/generated/index.ts ]; then npm run codegen; fi

RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8084

# Runtime dependencies only, plus the two CLIs the entrypoint needs:
# `prisma` to apply migrations and `tsx` to run the TypeScript admin
# bootstrap (the generated Prisma client is TypeScript, so plain node
# cannot import it). Versions pinned to package-lock.json.
COPY package.json package-lock.json ./
# `--include=dev` on the second install is required, not cosmetic: prisma and
# tsx are listed under devDependencies, and with NODE_ENV=production npm
# prunes them straight back out even when they are named explicitly.
RUN npm ci --omit=dev \
    && npm install --no-save --include=dev prisma@6.19.3 tsx@4.22.4 \
    && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/next.config.ts ./next.config.ts
# prisma.config.ts is deliberately NOT copied: it imports `dotenv`, a dev
# dependency. The CLI falls back to --schema + DATABASE_URL from the
# environment, which is exactly what compose supplies.
COPY prisma ./prisma
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# User uploads live on a bind/volume mount at /app/uploads (see
# lib/upload/storage.ts — UPLOADS_ROOT is process.cwd()/uploads).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /app/.next
USER node

EXPOSE 8084
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["npx", "next", "start", "-p", "8084"]
