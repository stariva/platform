import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { NodePgSession } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { Client } from "pg";

export async function migrate(
  client: Client,
  migrationsFolder = fileURLToPath(
    new URL("../../migrations", import.meta.url),
  ),
) {
  const { rows } = await client.query<{ server_version_num: string }>(
    "SHOW server_version_num",
  );
  const version = Number(rows[0]?.server_version_num);
  if (!Number.isInteger(version) || version < 120000) {
    throw new Error(
      "db:migrate requires PostgreSQL 12 or newer at POSTGRES_URL",
    );
  }

  const config = { migrationsFolder };
  const dialect = new PgDialect();
  const session = new NodePgSession<
    Record<string, never>,
    Record<string, never>
  >(client, dialect, undefined);
  for (const migration of readMigrationFiles(config)) {
    // Drizzle commits each call, including its journal entry. New enum values
    // (such as those in 0013) must commit before later migrations can use them.
    await dialect.migrate([migration], session, config);
  }
}

// Сайт ходит в базу ролью `stariva`. Если миграцию прогнали суперпользователем
// (локальный POSTGRES_URL смотрит в прод под `postgres`), новые объекты
// достаются ему, и у сайта нет к ним доступа («permission denied», 42501).
export const APP_ROLE = "stariva";

const OBJECTS_NOT_OWNED_BY_ROLE = `
  SELECT 'TABLE' AS kind, c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND pg_get_userbyid(c.relowner) <> $1
  UNION ALL
  SELECT 'VIEW', c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'v' AND pg_get_userbyid(c.relowner) <> $1
  UNION ALL
  SELECT 'MATERIALIZED VIEW', c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'm' AND pg_get_userbyid(c.relowner) <> $1
  UNION ALL
  SELECT 'SEQUENCE', c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'S' AND pg_get_userbyid(c.relowner) <> $1
     AND NOT EXISTS (
       SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype IN ('a', 'i')
     )
  UNION ALL
  SELECT 'TYPE', t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typtype = 'e' AND pg_get_userbyid(t.typowner) <> $1`;

/**
 * Передаёт роли приложения всё, что миграции создали в схеме `public`
 * под другим пользователем. Ничего не делает, если подключение уже под этой
 * ролью или такой роли в кластере нет (локальная база без `stariva`).
 * Возвращает перечень переданных объектов.
 */
export async function fixOwnership(
  client: Client,
  role = APP_ROLE,
): Promise<string[]> {
  const { rows: roles } = await client.query<{ is_self: boolean }>(
    "SELECT current_user = rolname AS is_self FROM pg_roles WHERE rolname = $1",
    [role],
  );
  if (roles.length === 0 || roles[0]?.is_self) return [];

  const { rows } = await client.query<{ kind: string; name: string }>(
    `SELECT kind, name FROM (${OBJECTS_NOT_OWNED_BY_ROLE}) o ORDER BY kind, name`,
    [role],
  );
  if (rows.length === 0) return [];

  const owner = client.escapeIdentifier(role);
  const moved: string[] = [];
  await client.query("BEGIN");
  try {
    for (const { kind, name } of rows) {
      const table = `public.${client.escapeIdentifier(name)}`;
      await client.query(`ALTER ${kind} ${table} OWNER TO ${owner}`);
      moved.push(`${kind.toLowerCase()} ${name}`);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  return moved;
}

if (import.meta.main) {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Missing POSTGRES_URL");
  const client = new Client({ connectionString });
  let failed = false;
  try {
    await client.connect();
    try {
      await migrate(client);
      console.log("Migrations complete");
    } finally {
      // Каждая миграция коммитится отдельно, поэтому передаём владение
      // и после частичного прогона: уже применённые объекты остаются в базе.
      const moved = await fixOwnership(client);
      if (moved.length > 0) {
        console.log(`Owner of ${moved.length} object(s) set to ${APP_ROLE}:`);
        for (const item of moved) console.log(`  ${item}`);
      }
    }
  } catch (err) {
    failed = true;
    console.error("Migrations failed", err);
  } finally {
    await client.end();
  }
  if (failed) process.exit(1);
}
