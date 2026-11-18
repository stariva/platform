---
name: orpc-feature
description: Use when adding or changing an oRPC procedure in Stariva, wiring it through the web/mobile contract or the admin app router, writing router tests, or debugging oRPC errors.
---

# oRPC-процедура end-to-end

В репо два независимых oRPC-слоя. Сначала определи, какой нужен.

## A. Витрина и мобильное приложение — `@stariva/web-api`

Contract-first. Обслуживается `apps/web/src/app/api/rpc`, клиент — `apps/mobile/src/lib/api.ts` (`WEB_RPC_PATH = "/api/rpc"`).

1. **Контракт**: `packages/web-api/src/contract/<domain>.ts`
   - `oc` из `@orpc/contract`, схемы Zod, `error("CODE", { message })`.
   - Экспорт из `contract/index.ts` и добавление в `webContract`.
2. **Процедуры**: `packages/web-api/src/procedures.ts`
   - `jobs` (Bearer `JOBS_SECRET`), `admin` (`REVALIDATE_SECRET`), `forms` (публично), `orders`, `checkout`, `account` (+session).
3. **Роутер**: `packages/web-api/src/router/<domain>.ts`
   - `account.myCourses.handler(async ({ input, context, errors }) => ...)`.
   - Регистрация в `router/index.ts`.
4. **Зависимости**: если нужен новый сервис — добавь в `WebServices` (`orpc.ts`), реализуй в контексте `apps/web` и в `idleServices` (`testing/wire-client.ts`).
5. **Тест**: `packages/web-api/src/router/<domain>.test.ts`
   - `mock.module` сервисов, `wireClient({ session })`, `lastStatus()`, `safe()`.
   - Запуск: `bun test packages/web-api/src/router/<domain>.test.ts`.
6. **Мобилка**: `api.<domain>.<procedure>(input)`; ошибки — через `errorMessage(error, fallback)`.

## B. Админка — `@stariva/api`

- Базовые процедуры: `publicProcedure`, `protectedProcedure`, `adminProcedure` в `packages/api/src/orpc.ts`.
- Роутеры: `packages/api/src/routers/<domain>/...`, регистрация в `routers/index.ts`.
- Обработчик: `apps/app/src/app/api/orpc/[[...rest]]/route.ts`.
- Клиент: `apps/app/src/orpc/server.ts` (RSC) и `apps/app/src/orpc/react.tsx` (браузер, TanStack Query).
- Тесты: рядом с процедурой `*.test.ts`; запуск `bun test <path>`.

## Общие правила

- Вход валидируется Zod; не доверяй `input`.
- Ошибки — типизированные коды, не строки.
- Не теряй middleware: `adminProcedure` / `protectedProcedure` / `withSession`.
- Бизнес-логику держи в `services/`, роутер — тонкий.
- Не дублируй типы: выводи из контракта/роутера.
- После изменений: `bun typecheck` и точечные тесты.
