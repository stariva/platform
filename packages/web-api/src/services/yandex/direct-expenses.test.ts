import { expect, test } from "bun:test";
import type { SQL } from "@stariva/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { syncDirectExpenses } from "./direct-expenses";

const dialect = new PgDialect();

function recorder(insertedRows = 0) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = {
    execute: async (query: SQL) => {
      queries.push(dialect.sqlToQuery(query));
      return { rows: Array.from({ length: insertedRows }, () => ({})) };
    },
  } as unknown as Parameters<typeof syncDirectExpenses>[0];
  return { db, queries };
}

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

test("сначала убирает лишние дни, потом пишет расходы Директа", async () => {
  const { db, queries } = recorder(3);
  const result = await syncDirectExpenses(db, {
    from: "2026-10-11",
    to: "2026-10-24",
  });

  expect(result).toEqual({ days: 3 });
  expect(queries).toHaveLength(2);
  const [remove, upsert] = queries.map((query) => flat(query.sql));
  expect(remove).toStartWith("delete from ad_expenses e");
  expect(remove).toContain("e.source = 'yandex_direct'");
  expect(upsert).toStartWith("insert into ad_expenses");
  expect(upsert).toContain(
    "on conflict (campaign_id, spent_on) where source = 'yandex_direct'",
  );
  // Ручной расход за день главнее
  expect(upsert).toContain("m.source = 'manual'");
  expect(queries[1]?.params).toEqual(["2026-10-11", "2026-10-24"]);
});

test("по одной кампании — за всю историю", async () => {
  const { db, queries } = recorder();
  await syncDirectExpenses(db, { campaignId: "camp-1" });

  const [remove, upsert] = queries;
  expect(flat(remove?.sql ?? "")).toContain("and e.campaign_id = $1");
  expect(flat(upsert?.sql ?? "")).toContain("and c.id = $1");
  expect(remove?.params).toEqual(["camp-1", "camp-1"]);
  expect(upsert?.params).toEqual(["camp-1"]);
  expect(flat(upsert?.sql ?? "")).not.toContain("s.date >=");
});
