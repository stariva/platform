import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { migrate } from "./migrate";

const migration = readFileSync(
  new URL("../../migrations/0019_product_order_number.sql", import.meta.url),
  "utf8",
);
const statements = migration.split("--> statement-breakpoint");

for (const count of [0, 2505]) {
  test.skipIf(!process.env.MIGRATION_TEST_POSTGRES_URL)(
    `order numbers: ${count} existing orders, committed batches and restart`,
    async () => {
      const connectionString = process.env.MIGRATION_TEST_POSTGRES_URL;
      const admin = new Client({ connectionString });
      const name = `order_number_test_${crypto.randomUUID().replaceAll("-", "")}`;
      const folder = mkdtempSync(join(tmpdir(), "stariva-order-numbers-"));
      const url = new URL(connectionString ?? "");
      url.pathname = `/${name}`;
      const client = new Client({ connectionString: url.toString() });
      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE "${name}"`);
        await client.connect();
        mkdirSync(join(folder, "meta"));
        writeFileSync(
          join(folder, "meta/_journal.json"),
          JSON.stringify({
            entries: [{ idx: 0, when: 1, tag: "0019", breakpoints: true }],
          }),
        );
        writeFileSync(join(folder, "0019.sql"), migration);
        await client.query(`
          CREATE TABLE product_orders (id text PRIMARY KEY, created_at timestamp NOT NULL);
          CREATE TABLE batch_log (tx bigint, size bigint);
          CREATE FUNCTION log_batch() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            INSERT INTO batch_log SELECT txid_current(), count(*) FROM changed;
            RETURN NULL;
          END $$;
          CREATE TRIGGER log_batch AFTER UPDATE ON product_orders
            REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION log_batch();
        `);
        await client.query(
          `
          INSERT INTO product_orders
          SELECT lpad(i::text, 5, '0'), '2026-01-01'::timestamp + (i / 3) * interval '1 second'
          FROM generate_series(1, $1::integer) AS i ORDER BY i DESC
        `,
          [count],
        );

        if (count > 0) {
          // Fail in the second batch: the first batch must remain committed.
          await client.query(statements[0] ?? "");
          await client.query(`
            CREATE FUNCTION fail_batch() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'injected batch failure'; END $$;
            CREATE TRIGGER fail_batch BEFORE UPDATE ON product_orders
              FOR EACH ROW WHEN (NEW.number > 2000) EXECUTE FUNCTION fail_batch();
          `);
          await expect(migrate(client, folder)).rejects.toThrow(
            "injected batch failure",
          );
          expect(
            (
              await client.query(
                "SELECT count(number)::int AS count FROM product_orders",
              )
            ).rows[0].count,
          ).toBe(1000);
          expect(
            (await client.query("SELECT * FROM drizzle.__drizzle_migrations"))
              .rowCount,
          ).toBe(0);
          // The guard must reject remaining NULLs before changing the column.
          await expect(client.query(statements[2] ?? "")).rejects.toThrow(
            "still contains NULL",
          );
          expect(
            (
              await client.query(
                "SELECT attnotnull FROM pg_attribute WHERE attrelid = 'product_orders'::regclass AND attname = 'number'",
              )
            ).rows[0].attnotnull,
          ).toBe(false);
          await client.query("DROP TRIGGER fail_batch ON product_orders");
          await client.query(statements[1] ?? "");
          await client.query(statements[2] ?? "");
          // A failed concurrent build leaves an invalid index to replace on retry.
          await client.query(
            "INSERT INTO product_orders OVERRIDING SYSTEM VALUE VALUES ('duplicate', now(), 1001)",
          );
          await expect(client.query(statements[4] ?? "")).rejects.toThrow();
          expect(
            (
              await client.query(
                "SELECT indisvalid FROM pg_index WHERE indexrelid = 'product_orders_number_idx'::regclass",
              )
            ).rows[0].indisvalid,
          ).toBe(false);
          await client.query(
            "DELETE FROM product_orders WHERE id = 'duplicate'",
          );
          // Retrying after identity setup must not rewind an already used sequence.
          await client.query("SELECT nextval('product_orders_number_seq')");
        }

        await migrate(client, folder);
        await migrate(client, folder);
        expect(
          (await client.query("SELECT * FROM drizzle.__drizzle_migrations"))
            .rowCount,
        ).toBe(1);
        expect(
          (
            await client.query(`
          SELECT count(*)::int AS count FROM (
            SELECT number, row_number() OVER (ORDER BY created_at, id) + 1000 AS expected
            FROM product_orders
          ) AS orders WHERE number IS DISTINCT FROM expected
        `)
          ).rows[0].count,
        ).toBe(0);
        const batches = (
          await client.query(
            "SELECT tx, size::int FROM batch_log WHERE size > 0",
          )
        ).rows;
        expect(batches.map((batch) => batch.size)).toEqual(
          count ? [1000, 1000, 505] : [],
        );
        expect(new Set(batches.map((batch) => batch.tx)).size).toBe(
          batches.length,
        );
        expect(
          (
            await client.query(
              "SELECT indisvalid, indisunique FROM pg_index WHERE indexrelid = 'product_orders_number_idx'::regclass",
            )
          ).rows[0],
        ).toEqual({ indisvalid: true, indisunique: true });
        expect(
          (
            await client.query(
              "INSERT INTO product_orders (id, created_at) VALUES ('new', now()) RETURNING number",
            )
          ).rows[0].number,
        ).toBe(count + 1001 + (count ? 1 : 0));
        await expect(
          client.query(
            "INSERT INTO product_orders OVERRIDING SYSTEM VALUE VALUES ('null', now(), NULL)",
          ),
        ).rejects.toThrow();
        await expect(
          client.query(
            "INSERT INTO product_orders OVERRIDING SYSTEM VALUE SELECT 'duplicate', now(), number FROM product_orders LIMIT 1",
          ),
        ).rejects.toThrow();
      } finally {
        await client.end();
        await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
        await admin.end();
        rmSync(folder, { recursive: true, force: true });
      }
    },
  );
}
