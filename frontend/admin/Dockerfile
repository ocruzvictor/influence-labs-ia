# syntax=docker/dockerfile:1.7

# ─── deps ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ─── builder ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders so Zod env validation doesn't fail during `next build`.
# Real values are injected at runtime from docker-compose / VPS env.
ENV NODE_ENV=production \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    ADMIN_JWT_SECRET=build_only_placeholder_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    RESEND_API_KEY=re_buildplaceholder \
    RESEND_FROM_EMAIL=build@example.com \
    ADMIN_PUBLIC_URL=https://build.example.com
RUN npm run build

# ─── runner ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3002
CMD ["node", "server.js"]
