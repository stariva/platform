import { expect, spyOn, test } from "bun:test";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { migrate } from "./migrate";

test.each(["110022", "90624", "invalid"])(
  "rejects server version %s before any schema writes",
  async (server_version_num) => {
    const client = new Client();
    const query = spyOn(client, "query").mockResolvedValue({
      rows: [{ server_version_num }],
    });
    try {
      await expect(migrate(client)).rejects.toThrow("PostgreSQL 12 or newer");
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith("SHOW server_version_num");
    } finally {
      query.mockRestore();
    }
  },
);

// Supply a disposable PostgreSQL server whose user can create databases.
test.skipIf(!process.env.MIGRATION_TEST_POSTGRES_URL)(
  "commits enum additions before use, resumes, and rolls back failed migrations",
  async () => {
    const connectionString = process.env.MIGRATION_TEST_POSTGRES_URL;
    const admin = new Client({ connectionString });
    const name = `migration_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const folder = mkdtempSync(join(tmpdir(), "stariva-migrations-"));
    const url = new URL(connectionString ?? "");
    url.pathname = `/${name}`;
    const client = new Client({ connectionString: url.toString() });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      await client.connect();
      // Migration 0000 uses gen_random_uuid(), supplied by pgcrypto on PG12.
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      cpSync(new URL("../../migrations", import.meta.url), folder, {
        recursive: true,
      });
      const journalPath = join(folder, "meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      const last = journal.entries.at(-1);
      const append = (tag: string, sql: string) => {
        journal.entries.push({
          ...last,
          idx: journal.entries.length,
          when: last.when + journal.entries.length,
          tag,
        });
        writeFileSync(journalPath, JSON.stringify(journal));
        writeFileSync(join(folder, `${tag}.sql`), sql);
      };
      append(
        "0014_enum_consumer",
        `CREATE TABLE enum_probe (status product_order_status);
         INSERT INTO enum_probe VALUES ('awaiting_deposit'), ('awaiting_balance'), ('declined');`,
      );
      await migrate(client, folder);
      await migrate(client, folder);
      expect((await client.query("SELECT * FROM enum_probe")).rowCount).toBe(3);
      expect(
        (await client.query("SELECT * FROM drizzle.__drizzle_migrations"))
          .rowCount,
      ).toBe(journal.entries.length);
      append(
        "0015_failure",
        "CREATE TABLE rollback_probe (id integer);--> statement-breakpoint\nSELECT missing_migration_function();",
      );
      await expect(migrate(client, folder)).rejects.toThrow();
      expect(
        (await client.query("SELECT to_regclass('rollback_probe') AS name"))
          .rows[0].name,
      ).toBeNull();
      expect(
        (await client.query("SELECT * FROM drizzle.__drizzle_migrations"))
          .rowCount,
      ).toBe(journal.entries.length - 1);
    } finally {
      await client.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
      rmSync(folder, { recursive: true, force: true });
    }
  },
);
