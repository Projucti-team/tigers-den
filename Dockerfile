# Production image for VPS / Docker (Next.js standalone + Payload CMS)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure seed directories always exist even if absent in git.
RUN mkdir -p /app/data /app/media
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
# Keep memory low on 4 GB CPX22 hosts (add swap on the server if builds OOM)
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV NEXT_BUILD_WORKERS=1
ENV UV_THREADPOOL_SIZE=2
RUN npm run build:docker

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# libsql native bindings for sqlite adapter (also copied when using Neon — harmless)
COPY --from=deps /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/data ./data-seed
COPY --from=builder /app/media ./media-seed
COPY --chown=nextjs:nodejs deploy/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN mkdir -p /app/data /app/media \
  && chown -R nextjs:nodejs /app/data /app/media /app/data-seed /app/media-seed /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
