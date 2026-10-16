import { expect, test } from "bun:test";
import { Client } from "pg";
import { migrate } from "./migrate";

const constraint = "crm_sales_request_number_custom_order_requests_number_fk";

async function waitForLock(observer: Client, pid: number) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const { rows } = await observer.query(
      "SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await Bun.sleep(10);
  }
  throw new Error("Concurrent query did not wait for the foreign key lock");
}

// Requires a disposable PostgreSQL server whose user can create databases.
test.skipIf(!process.env.MIGRATION_TEST_POSTGRES_URL)(
  "request FK serializes sales and request deletion in either order",
  async () => {
    const connectionString = process.env.MIGRATION_TEST_POSTGRES_URL;
    const admin = new Client({ connectionString });
    const name = `crm_request_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const url = new URL(connectionString ?? "");
    url.pathname = `/${name}`;
    const first = new Client({ connectionString: url.toString() });
    const second = new Client({ connectionString: url.toString() });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      await first.connect();
      await second.connect();
      await first.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      await migrate(first);
      await migrate(first);
      const { rows: constraints } = await first.query(
        "SELECT confdeltype, convalidated FROM pg_constraint WHERE conname = $1",
        [constraint],
      );
      expect(constraints).toEqual([{ confdeltype: "r", convalidated: true }]);
      await first.query("SET statement_timeout = '5s'");
      await second.query("SET statement_timeout = '5s'");
      const { rows: sessions } = await second.query(
        "SELECT pg_backend_pid() AS pid",
      );
      const pid = sessions[0].pid;
      await first.query(
        "INSERT INTO crm_clients (id, name) VALUES ('client', 'Test')",
      );
      const insertSale = `INSERT INTO crm_sales
        (id, client_id, sold_on, amount, description, request_number)
        VALUES ($1, 'client', '2026-10-16', 0, 'Test', $2)`;

      // Standalone sales remain valid; non-existent request numbers do not.
      await first.query(insertSale, ["standalone", null]);
      await expect(
        first.query(insertSale, ["orphan", 999]),
      ).rejects.toMatchObject({
        code: "23503",
        constraint,
      });

      for (const saleFirst of [true, false]) {
        const id = saleFirst ? "sale-first" : "delete-first";
        const { rows } = await first.query(
          `INSERT INTO custom_order_requests (id, fingerprint, data, message)
           VALUES ($1, 'test', '{}', 'Test') RETURNING number`,
          [id],
        );
        const number = rows[0].number;
        await first.query("BEGIN");
        if (saleFirst) {
          await first.query(insertSale, [id, number]);
        } else {
          await first.query(
            "DELETE FROM custom_order_requests WHERE number = $1",
            [number],
          );
        }
        // Observe a real blocked query before committing the winning transaction.
        const pending = (
          saleFirst
            ? second.query(
                "DELETE FROM custom_order_requests WHERE number = $1",
                [number],
              )
            : second.query(insertSale, [id, number])
        ).then(
          () => undefined,
          (error: unknown) => error,
        );
        try {
          await waitForLock(admin, pid);
          await first.query("COMMIT");
          expect(await pending).toMatchObject({
            code: saleFirst
              ? expect.stringMatching(/^(23503|23001)$/)
              : "23503",
            constraint,
          });
        } finally {
          await first.query("ROLLBACK");
          await pending;
        }
        if (saleFirst) {
          expect(
            (await first.query("SELECT id FROM crm_sales WHERE id = $1", [id]))
              .rowCount,
          ).toBe(1);
          expect(
            (
              await first.query(
                "SELECT number FROM custom_order_requests WHERE number = $1",
                [number],
              )
            ).rowCount,
          ).toBe(1);
          await first.query("DELETE FROM crm_sales WHERE id = $1", [id]);
          expect(
            (
              await first.query(
                "DELETE FROM custom_order_requests WHERE number = $1",
                [number],
              )
            ).rowCount,
          ).toBe(1);
        } else {
          expect(
            (await first.query("SELECT id FROM crm_sales WHERE id = $1", [id]))
              .rowCount,
          ).toBe(0);
          expect(
            (
              await first.query(
                "SELECT number FROM custom_order_requests WHERE number = $1",
                [number],
              )
            ).rowCount,
          ).toBe(0);
        }
      }
    } finally {
      await first.end();
      await second.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
    }
  },
  20000,
);
