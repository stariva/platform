<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Stariva platform

Монорепо на Bun + Turborepo. Витрина и админка — Next.js 16, клиент — Vite + Capacitor 8, API — oRPC 2 beta, БД — Drizzle + Neon Postgres.

## Карта

- `apps/app` — админка/бэк-офис, Next.js App Router. oRPC-роутер из `@stariva/api`, обработчик в `src/app/api/orpc`.
- `apps/web` — витрина stariva.ru, Next.js App Router. Contract-first oRPC из `@stariva/web-api`, обработчик в `src/app/api/rpc`.
- `apps/mobile` — клиент на Vite + React + Capacitor. Ходит в `@stariva/web-api/contract` через `src/lib/api.ts`.
- `apps/jobs` — Trigger.dev задачи.
- `packages/web-api` — контракт (`oc`) + роутеры витрины и мобилки, тесты через `testing/wire-client.ts`.
- `packages/api` — серверные oRPC-процедуры админки (`publicProcedure` / `protectedProcedure` / `adminProcedure`).
- `packages/auth` — Better Auth; `packages/db` — Drizzle-схема и миграции; `packages/validators`, `config`, `ui`, `storage`, `emails`.

## Команды

- `bun dev` — app + зависимости; `bun dev:all` — все приложения.
- `bun check` / `bun check:fix` — Biome (линт + формат).
- `bun typecheck` — tsc по всем пакетам.
- `bun test` — turbo test; точечно — `bun test <path>`.
- `bun db:generate` → `bun db:migrate`; `bun db:studio`.
- `bun lint:ws` — sherif (правила workspace-зависимостей).

## OpenCode

- `/verify` — Biome + typecheck + точечные тесты; `/db-migration` — схема → generate → migrate.
- `db_sql` — read-only SQL (`SELECT`/`WITH`/`EXPLAIN`/`SHOW`), берёт `POSTGRES_URL` из окружения или ближайшего `.env`. Лимит строк по умолчанию 200.
- Субагенты: `reviewer` — ревью без правок; `database-architect` — схема и миграции без применения.
- Скиллы — `.agents/skills`, команды — `.opencode/commands`, агенты и плагины — `.opencode`.

## Правила

- Пакетный менеджер — Bun. Не использовать npm/yarn/pnpm.
- Форматирование и линт — Biome, не ESLint/Prettier.
- Миграции в `packages/db/migrations` append-only: не редактировать применённые файлы, менять схему и запускать `bun db:generate`.
- `db:push` — только для локальной/одноразовой БД. Для общей — `generate` + `migrate`.
- `CREATE INDEX CONCURRENTLY` требует первой строки `-- migrate:non-transactional` (см. `packages/db/src/scripts/migrate.ts`).
- Next.js 16 и Turborepo читать из локальных доков установленных пакетов, а не вспоминать.
- oRPC 2 beta: перед изменением процедур загрузить скилл `orpc-feature` (или `orpc`).
- Секреты (`.env*`, `*.pem`, keystore, `google-services.json`) не читать и не коммитить.
- `.claude/worktrees/**` — отдельные checkout'ы, не трогать и не индексировать.
- Перед сдачей: `/verify` или `bun check` + `bun typecheck` + затронутые тесты. Для UI — скилл `ui-qa`.
- Не коммитить и не пушить без явной просьбы.
