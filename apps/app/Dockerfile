# Build context is the monorepo root: docker build -f apps/app/Dockerfile .
FROM oven/bun:1.4.2-alpine AS base
RUN apk add --no-cache libc6-compat

# 1. Prune the monorepo down to what @stariva/app actually needs
FROM base AS pruner
WORKDIR /repo
RUN bun add -g turbo@2.11.4
COPY . .
RUN turbo prune @stariva/app --docker

# 2. Install deps from the pruned lockfile, then build with the full pruned source
FROM base AS builder
WORKDIR /repo
RUN apk add --no-cache python3 make g++
COPY --from=pruner /repo/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY .env.example .env
ENV APP_URL=https://app.stariva.ru
ENV NEXT_PUBLIC_APP_URL=https://app.stariva.ru
RUN bun run build --filter=@stariva/app

# 3. Minimal runtime image, just the Next.js standalone output
FROM base AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/public ./apps/app/public
USER nextjs
ENV NODE_ENV=production
ENV APP_URL=https://app.stariva.ru
ENV NEXT_PUBLIC_APP_URL=https://app.stariva.ru
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "--smol", "apps/app/server.js"]
