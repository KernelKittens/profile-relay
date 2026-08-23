FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN npm run build --workspace @bioctl/core \
  && npm run build --workspace @bioctl/web

FROM node:24.19.0-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BIOCTL_CONFIG_DIR=/app/config \
    BIOCTL_DATA_DIR=/app/data
WORKDIR /app

RUN groupadd --system --gid 1001 bioctl \
  && useradd --system --uid 1001 --gid bioctl --home-dir /app bioctl \
  && mkdir -p /app/data \
  && chown -R bioctl:bioctl /app/data

COPY --from=builder --chown=bioctl:bioctl /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=bioctl:bioctl /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=bioctl:bioctl /workspace/apps/web/public ./apps/web/public
COPY --from=builder --chown=bioctl:bioctl /workspace/config ./config

USER bioctl
EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "apps/web/server.js"]
