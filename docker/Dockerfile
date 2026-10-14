# Super Job Agent — server image
# Runs the crew scheduler 24/7 in a container with headless Chromium support.
#
# Build:  docker build -f docker/Dockerfile -t super-job-agent .
# Run:    docker compose -f docker/compose.yml up
#
# FIX (Gap 6.1): Added ALL 10 workspace package manifests before npm ci.
# Previously omitted packages/server, packages/ats-config, packages/analytics,
# packages/mcp — causing npm workspace validation to fail on build.

FROM node:22.13-slim

# Playwright/Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    fonts-liberation wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Step 1: copy ALL workspace manifests for deterministic npm ci caching ──────
# All 10 workspace packages must be present or npm will fail with
# "missing workspace package" during the install phase.
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Core packages
COPY packages/core/package.json packages/core/
COPY packages/applier/package.json packages/applier/
COPY packages/crew/package.json packages/crew/
COPY packages/scraper/package.json packages/scraper/
COPY packages/email-monitor/package.json packages/email-monitor/

# Server-side packages (were missing — gap 6.1 fix)
COPY packages/server/package.json packages/server/
COPY packages/ats-config/package.json packages/ats-config/
COPY packages/analytics/package.json packages/analytics/
COPY packages/mcp/package.json packages/mcp/

# Extension package.json must be present for workspace validation even though
# extension source is NOT included in this server image.
COPY packages/extension/package.json packages/extension/

# ── Step 2: install deps ───────────────────────────────────────────────────────
# The entrypoint executes TypeScript with tsx. Use lockfile exactly so image
# builds are reproducible. --omit=dev skips wxt/tailwind/react browser tools.
RUN npm ci --omit=dev --no-audit --no-fund

# install playwright chromium
RUN npx playwright install chromium

# ── Step 3: copy source ────────────────────────────────────────────────────────
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY packages/applier/src packages/applier/src
COPY packages/applier/tsconfig.json packages/applier/
COPY packages/crew/src packages/crew/src
COPY packages/crew/tsconfig.json packages/crew/
COPY packages/scraper/src packages/scraper/src
COPY packages/scraper/tsconfig.json packages/scraper/
COPY packages/email-monitor/src packages/email-monitor/src
COPY packages/email-monitor/tsconfig.json packages/email-monitor/
COPY packages/ats-config/src packages/ats-config/src
COPY packages/ats-config/tsconfig.json packages/ats-config/
COPY packages/analytics/src packages/analytics/src
COPY packages/analytics/tsconfig.json packages/analytics/
COPY packages/server/src packages/server/src
COPY packages/server/tsconfig.json packages/server/

# copy docker entrypoint + API
COPY docker/ docker/

# copy dashboard (served by the API)
COPY dashboard.html dashboard.html

# persistent data lives here (browser profile, store.json)
RUN mkdir -p /data
ENV SUPERJOB_HOME=/data

EXPOSE 3000

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["both"]
