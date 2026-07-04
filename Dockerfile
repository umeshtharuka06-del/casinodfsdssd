# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Royal 1 — production image (Next.js web + the long-running workers share one
# image; the running command differs per docker-compose service).
#
# Multi-stage:
#   base       → runtime OS + tini/openssl/curl
#   prod-deps  → production node_modules only (incl. tsx + prisma CLI), slim
#   build-deps → full node_modules (adds tailwind/typescript/@types for the build)
#   builder    → `next build`
#   runner     → final slim image = prod-deps node_modules + built .next
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]

# ── Production dependencies only (smallest runtime node_modules) ─────────────
# tsx (runs the workers) and prisma (generate/migrate) are runtime deps, so
# --omit=dev still includes them; tailwind/typescript/@types are excluded.
FROM base AS prod-deps
# The lockfile is optional: `package-lock.json*` is a glob, so BuildKit copies it
# when present and simply skips it when absent (this repo ships without one and
# relies on `npm install`). A bare `COPY package.json package-lock.json ./` aborts
# the whole build with "failed to solve" when the lockfile does not exist.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund

# ── Full dependencies (build only) ──────────────────────────────────────────
FROM base AS build-deps
# The lockfile is optional: `package-lock.json*` is a glob, so BuildKit copies it
# when present and simply skips it when absent (this repo ships without one and
# relies on `npm install`). A bare `COPY package.json package-lock.json ./` aborts
# the whole build with "failed to solve" when the lockfile does not exist.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# ── Build the Next.js production bundle ─────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build-deps /app/node_modules ./node_modules
COPY . .
# `next build` creates .next/cache; the Image-Optimization sub-dir
# (.next/cache/images) is normally created lazily at runtime. Materialising it
# here guarantees the path exists inside the built artifact, so the runner stage
# copies it (with correct ownership) instead of the non-root runtime user having
# to create it under a root-owned tree.
RUN npm run build \
  && mkdir -p /app/.next/cache/images

# ── Final runtime image ─────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Every runtime file is copied AS the runtime user. Without `--chown`, COPY
# defaults to root:root — and since the container later runs as the unprivileged
# `nextjs` user, root-owned files under /app are not writable by it.
# Slim production node_modules (no build-only packages).
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
# Built app + everything the web server and tsx workers need at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/next-env.d.ts ./next-env.d.ts

# Next.js Image Optimization writes optimized images into .next/cache/images the
# first time an image is requested. WORKDIR /app was created by the base stage as
# root, so even with the copies above the `nextjs` user could not create that
# sub-directory (EACCES: permission denied, mkdir '/app/.next/cache/images').
# Pre-create the cache path, hand the entire /app tree to the runtime user, and
# make the cache tree group-writable (g+rwX). The group-write bit matters when a
# named volume is mounted at /app/.next/cache/images (see docker-compose `web`):
# a fresh volume inherits this directory's ownership/mode, so the runtime user
# can always write to it — even across image rebuilds and redeploys.
RUN mkdir -p /app/.next/cache/images \
  && chown -R nextjs:nodejs /app \
  && chmod -R g+rwX /app/.next/cache

USER nextjs
EXPOSE 3000
# Graceful shutdown: tini (ENTRYPOINT) forwards SIGTERM; web + workers drain.
STOPSIGNAL SIGTERM
# Default command runs the web server. Workers override `command:` in compose.
CMD ["npm", "run", "start"]
