import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

describe("db client without POSTGRES_URL", () => {
  test("importing does not throw and queries reject with a clear error", async () => {
    const saved = process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL;
    try {
      // Query string forces a fresh module instance evaluated with the env above.
      const { db } = await import(`./client?nodb=${Date.now()}`);
      await expect(db.transaction(async () => {})).rejects.toThrow(
        "POSTGRES_URL environment variable is not set",
      );
      await expect(
        (async () => await db.execute(sql`select 1`))(),
      ).rejects.toThrow("Failed query");
    } finally {
      if (saved !== undefined) process.env.POSTGRES_URL = saved;
    }
  });
});
