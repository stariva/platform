# Build context is the monorepo root: docker build -f apps/jobs/Dockerfile .
FROM oven/bun:1.4.3-alpine AS base
RUN apk add --no-cache libc6-compat

# 1. Prune the monorepo down to what @stariva/jobs actually needs
FROM base AS pruner
WORKDIR /repo
RUN bun add -g turbo@2.11.7
COPY . .
RUN turbo prune @stariva/jobs --docker

# 2. Install production deps and bundle our sources for Node. The bundle keeps
#    node_modules external: the Hatchet SDK starts its heartbeat thread from a
#    file inside its own package, so it must stay on disk as-is
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
# --ignore-scripts: корневой postinstall запускает sherif (devDependency),
# которого нет в production-установке, и сборка падает с exit 127
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=pruner /repo/out/full/ .
RUN cd apps/jobs && bun run build

# 3. Runtime image: a long-running Hatchet worker, no HTTP port.
#    Воркер работает под Node, а не Bun: SDK держит соединение с движком через
#    @grpc/grpc-js поверх node:http2, а под Bun на хостинге heartbeat'ы уходили
#    в бесконечный таймаут вместо переподключения
FROM node:24-alpine AS runner
WORKDIR /repo
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs
COPY --from=installer --chown=worker:nodejs /repo ./
USER worker
ENV NODE_ENV=production
WORKDIR /repo/apps/jobs
CMD ["node", "dist/index.js"]
