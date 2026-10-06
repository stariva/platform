import { describe, expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { Post } from "./schema";

describe("edge db client", () => {
  test.each([undefined, ""])(
    "imports safely and queries fail locally when POSTGRES_URL is %p",
    async (connectionString) => {
      const saved = process.env.POSTGRES_URL;
      const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Unexpected network request"),
      );
      if (connectionString === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = connectionString;

      try {
        const { db, default: defaultDb } = await import(
          `./client.edge?nodb=${crypto.randomUUID()}`
        );
        expect(defaultDb).toBe(db);
        for (const query of [
          () => db.execute(sql`select 1`),
          () => db.select().from(Post),
          () => db.query.Post.findMany(),
          () => db.batch([db.select().from(Post)]),
        ]) {
          await expect((async () => await query())()).rejects.toThrow();
        }
        expect(() => db.$client.query("select 1")).toThrow(
          "POSTGRES_URL environment variable is not set",
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
        if (saved === undefined) delete process.env.POSTGRES_URL;
        else process.env.POSTGRES_URL = saved;
      }
    },
  );

  test("uses Neon with the configured POSTGRES_URL", async () => {
    const saved = process.env.POSTGRES_URL;
    const connectionString =
      "postgres://user:password@ep-test.eu-central-1.aws.neon.tech/db";
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          fields: [{ name: "value", dataTypeID: 23 }],
          rows: [["1"]],
          rowCount: 1,
          command: "SELECT",
        }),
      ),
    );
    process.env.POSTGRES_URL = connectionString;

    try {
      const { db } = await import(
        `./client.edge?configured=${crypto.randomUUID()}`
      );
      const result = await db.execute(sql`select ${1} as value`);
      expect(result.rows).toEqual([{ value: 1 }]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.eu-central-1.aws.neon.tech/sql",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Neon-Connection-String": connectionString,
          }),
          body: JSON.stringify({ query: "select $1 as value", params: ["1"] }),
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      if (saved === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = saved;
    }
  });
});
