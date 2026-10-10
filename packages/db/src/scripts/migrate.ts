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

if (import.meta.main) {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Missing POSTGRES_URL");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await migrate(client);
    console.log("Migrations complete");
  } catch (err) {
    console.error("Migrations failed", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}
