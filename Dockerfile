# Nervix API Dockerfile
# Multi-stage build for production deployment

FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY api/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY api/ ./

# Build (if needed)
# RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nervix && \
    adduser -S -u 1001 -G nervix nervix

# Copy dependencies and source from builder
COPY --from=builder --chown=nervix:nervix /app/node_modules ./node_modules
COPY --from=builder --chown=nervix:nervix /app ./

# Create logs directory
RUN mkdir -p logs && chown -R nervix:nervix logs

# Switch to non-root user
USER nervix

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
