# Multi-stage build for Nervix Federation
# Pin specific base image version for reproducibility (P3 security fix)
FROM node:22.11.0-slim AS base
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY . .
RUN pnpm run build

# Production
FROM node:22.11.0-slim AS production
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# Install security and health check dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        dumb-init \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/false nodejs

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Security: Read-only root filesystem, tmpfs for /tmp and /run
# Note: Requires docker-compose to override for writable directories
VOLUME ["/app/.cache", "/tmp"]

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use dumb-init for proper signal handling and zombie process cleanup
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
