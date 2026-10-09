# Build context is the monorepo root: docker build -f apps/jobs/Dockerfile .
FROM oven/bun:1.4.2-alpine AS base
RUN apk add --no-cache libc6-compat

# 1. Prune the monorepo down to what @stariva/jobs actually needs
FROM base AS pruner
WORKDIR /repo
RUN bun add -g turbo@2.11.7
COPY . .
RUN turbo prune @stariva/jobs --docker

# 2. Install production deps only — bun runs the TypeScript sources directly,
#    so there is no build step
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
# --ignore-scripts: корневой postinstall запускает sherif (devDependency),
# которого нет в production-установке, и сборка падает с exit 127
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=pruner /repo/out/full/ .

# 3. Runtime image: a long-running Hatchet worker, no HTTP port
FROM base AS runner
WORKDIR /repo
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs
COPY --from=installer --chown=worker:nodejs /repo ./
USER worker
ENV NODE_ENV=production
WORKDIR /repo/apps/jobs
CMD ["bun", "--smol", "src/index.ts"]
