---
name: drizzle-migrations
description: Use when changing the Postgres schema or Drizzle setup in packages/db, adding or altering tables/columns/indexes, writing or reviewing migrations, or debugging db:migrate on Neon.
---

# Миграции Drizzle (Stariva)

## Что читать сначала

- `packages/db/src/schema/index.ts` — точка входа схемы; домены лежат в `schema/<domain>/`.
- `packages/db/drizzle.config.ts` — `casing: "snake_case"`, `out: ./migrations`, `POSTGRES_URL`.
- Последние 2–3 файла в `packages/db/migrations/` — стиль и нумерация.
- `packages/db/src/scripts/migrate.ts` — раннер: транзакционные и нетранзакционные миграции.

## Правила

- Миграции append-only. Файл, который уже применялся, не редактируем и не удаляем.
- `bun db:push` — только для локальной или одноразовой БД. Для общей/прод — `bun db:generate` + `bun db:migrate`.
- Схема — источник истины. SQL генерирует drizzle-kit; руками правим только осознанно и с объяснением.
- `POSTGRES_URL` у Neon pooled (`:6543`); `drizzle.config.ts` сам подставляет `:5432` для миграций. Не хардкодить URL.
- Роль приложения — `stariva`. `migrate.ts` после прогона чинит ownership объектов `public`, если они принадлежат другой роли.

## Цикл

1. `git status` — убедись, что не в чужом worktree и нет незакоммиченных миграций.
2. Поменяй схему в `packages/db/src/schema/...`; при новом домене экспорти из `schema/index.ts`.
3. `bun db:generate` — появится `migrations/00XX_*.sql` и обновится `migrations/meta/`.
4. Прочитай SQL целиком. Проверь:
   - типы (`timestamptz`, деньги — `numeric`, не `real`/`money`);
   - `NOT NULL` и дефолты;
   - FK и `ON DELETE` (историю не каскадим);
   - индексы на FK и реальные фильтры/сортировки;
   - блокировки и переписывание таблицы.
5. Если нужен `CREATE INDEX CONCURRENTLY` или другой statement вне транзакции — первой строкой файла:
   `-- migrate:non-transactional`
   Такая миграция должна быть перезапускаемой: раннер журналирует её вручную.
   Это единственная допустимая ручная правка сгенерированного файла; остальные изменения — только через схему и `db:generate`.
6. Примени: `bun db:migrate`.
7. Проверь результат: `bun db:studio` или SQL-запрос; для тяжёлых запросов — `EXPLAIN`.
8. Тесты: `bun test packages/db/src/scripts/migrate.test.ts` и профильные `*.test.ts`.

## Опасные изменения на живой таблице

- Удаление/переименование колонки или смена типа — expand/contract в несколько релизов.
- `NOT NULL` на существующей колонке — сначала `CHECK ... NOT VALID`, `VALIDATE CONSTRAINT`, потом `SET NOT NULL`.
- Новый FK/CHECK — `NOT VALID`, затем `VALIDATE CONSTRAINT`.
- Индекс на большой таблице — `CONCURRENTLY`, отдельным файлом.
- Бэкофилл — батчами по PK, вне схемной миграции, с возможностью продолжить.

## Запрещено

- `bun --filter @stariva/db drop` на общей БД.
- Ручная правка `migrations/meta/_journal.json`.
- `db:push` на прод.
- Секреты и реальные данные в SQL, логах и тестах.
