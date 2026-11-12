# ============================================================================
# Stage 1: Builder
# Compiles TypeScript source and generates baseline Prisma client
# ============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl

# Install all dependencies (including devDependencies for build)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy TypeScript config, deployment scripts, and source code
COPY tsconfig.json ./
COPY scripts ./scripts/
COPY src ./src/

# Generate Prisma Client and compile TypeScript to dist/
RUN npx prisma generate
RUN npm run build

# ============================================================================
# Stage 2: Production Runner
# Minimal runtime image containing only production dependencies
# ============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime, dumb-init for PID 1 signal forwarding, and curl for healthcheck
RUN apk add --no-cache openssl dumb-init curl

ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency manifests, schema, and migrations
COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

# Install strictly production dependencies and generate runtime Prisma Client
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory and set unprivileged permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Run container as non-root user (UID 1000)
USER node

EXPOSE 5000

# Container liveness healthcheck querying Express /health probe (independent of DB)
# Note: Configure AWS ALB Target Group to query /ready for database-aware traffic routing
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

# Forward OS signals (SIGTERM/SIGINT) cleanly for ECS graceful termination
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Launch production application server
CMD ["node", "dist/server.js"]
