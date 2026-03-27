# ============================================================
# CodePilot Web — Production Docker Image (multi-stage)
# ============================================================
# Build:  docker build -t codepilot-web .
# Build with specific Claude Code version:
#         docker build --build-arg CLAUDE_CODE_VERSION=1.0.0 -t codepilot-web .
# Run:    docker run -p 3811:3811 -v codepilot-data:/data -v ~/projects:/workspace codepilot-web
# Custom port: docker run -p 8080:8080 -e PORT=8080 -v codepilot-data:/data -v ~/projects:/workspace codepilot-web
# ============================================================

# ---------- Stage 1: install + build ----------
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-slim AS builder

WORKDIR /app

# Use China mirror for apt (Debian bookworm)
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

# Native build tools for better-sqlite3 / zlib-sync
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Use China npm mirror
RUN npm config set registry https://registry.npmmirror.com

# Copy local source (filtered by .dockerignore)
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm ci && npm run build && npm cache clean --force

# ---------- Stage 2: minimal production runtime ----------
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-slim AS runner

WORKDIR /app

# Use China mirror for apt, install runtime deps, clean up in one layer
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends libsqlite3-0 ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

# Use China npm mirror & install Claude Code CLI, clean cache
ARG CLAUDE_CODE_VERSION=latest
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && \
    npm cache clean --force

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Data directory — mount a volume here for persistence
ENV CLAUDE_GUI_DATA_DIR=/data

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs && \
    mkdir -p /data /workspace /home/nextjs/.claude && \
    chown -R nextjs:nodejs /data /workspace /home/nextjs

# Copy standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE ${PORT:-3811}

ENV HOSTNAME=0.0.0.0
ENV PORT=3811

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3811)+'/api/health').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
