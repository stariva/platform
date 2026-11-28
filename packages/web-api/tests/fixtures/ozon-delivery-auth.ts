import { mock } from "bun:test";
import assert from "node:assert/strict";
import { and, eq, type SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

let row: { refreshToken: string } | null = { refreshToken: "r1" };
const events: string[] = [];
const rotatedTo: string[] = [];
let failNextRotationUpdate = false;

function sqlText(command: unknown): string {
  return new PgDialect().sqlToQuery(command as SQL).sql;
}

const tx = {
  execute: async (command: unknown) => {
    const text = sqlText(command);
    if (text.includes("pg_advisory_xact_lock")) events.push("lock");
    return { rows: [] };
  },
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => (row ? [{ ...row }] : []),
      }),
    }),
  }),
  insert: () => ({
    values: (values: { refreshToken: string }) => {
      const apply = async () => {
        row = { refreshToken: values.refreshToken };
        return [];
      };
      return {
        onConflictDoNothing: apply,
        onConflictDoUpdate: apply,
      };
    },
  }),
  update: () => ({
    set: (values: { refreshToken: string }) => ({
      where: () => ({
        returning: async () => {
          if (failNextRotationUpdate) {
            failNextRotationUpdate = false;
            throw new Error("connection lost after OAuth rotation");
          }
          rotatedTo.push(values.refreshToken);
          row = { refreshToken: values.refreshToken };
          return [{ id: "current" }];
        },
      }),
    }),
  }),
};

mock.module("@stariva/db", () => ({ and, eq, sql }));
mock.module("@stariva/db/client", () => ({
  createDatabase: () => ({
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx),
  }),
}));
mock.module("@stariva/config", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));
mock.module("../../src/env", () => ({
  env: {
    OZON_DELIVERY_CLIENT_ID: "client-id",
    OZON_DELIVERY_CLIENT_SECRET: "client-secret",
  },
}));

const {
  getOzonDeliveryAccessToken,
  invalidateOzonDeliveryAccessToken,
  isOzonDeliveryConfigured,
  persistOzonDeliveryRefreshToken,
} = await import("../../src/services/ozon-delivery-auth");

let refreshCount = 0;
const requestedRefreshTokens: string[] = [];
globalThis.fetch = mock(async (_url, init) => {
  refreshCount += 1;
  const refreshToken = new URLSearchParams(String(init?.body)).get(
    "refresh_token",
  );
  assert.ok(refreshToken);
  requestedRefreshTokens.push(refreshToken);
  events.push(`fetch:${refreshToken}`);
  return Response.json({
    access_token: `access-${refreshCount}`,
    refresh_token: `r${refreshCount + 1}`,
    expires_in: 3600,
  });
}) as unknown as typeof fetch;

assert.equal(isOzonDeliveryConfigured(), true);

const first = await getOzonDeliveryAccessToken();
assert.equal(first, "access-1");
assert.deepEqual(requestedRefreshTokens, ["r1"]);
assert.deepEqual(rotatedTo, ["r2"]);
assert.equal(row?.refreshToken, "r2");
assert.ok(events.indexOf("lock") < events.indexOf("fetch:r1"));

// Кэш не делает лишний refresh.
assert.equal(await getOzonDeliveryAccessToken(), "access-1");
assert.equal(refreshCount, 1);

// После 401 следующий refresh обязан использовать уже отротированный токен.
invalidateOzonDeliveryAccessToken(first);
assert.equal(await getOzonDeliveryAccessToken(), "access-2");
assert.deepEqual(requestedRefreshTokens, ["r1", "r2"]);
assert.equal(row?.refreshToken, "r3");

// Одновременные вызовы в одном процессе делят один OAuth refresh.
invalidateOzonDeliveryAccessToken("access-2");
const before = refreshCount;
const [left, right] = await Promise.all([
  getOzonDeliveryAccessToken(),
  getOzonDeliveryAccessToken(),
]);
assert.equal(left, right);
assert.equal(refreshCount, before + 1);

// Ручная переавторизация тоже идёт через lock и сбрасывает access-кэш.
const locksBefore = events.filter((event) => event === "lock").length;
await persistOzonDeliveryRefreshToken("manual-r1");
assert.equal(row?.refreshToken, "manual-r1");
assert.equal(
  events.filter((event) => event === "lock").length,
  locksBefore + 1,
);
const nextAccessToken = `access-${refreshCount + 1}`;
assert.equal(await getOzonDeliveryAccessToken(), nextAccessToken);
assert.equal(requestedRefreshTokens.at(-1), "manual-r1");

// Если соединение с БД умерло уже после ротации у Ozon, новый refresh_token
// сохраняется повторной conditional-write попыткой, а не теряется.
invalidateOzonDeliveryAccessToken(nextAccessToken);
failNextRotationUpdate = true;
const recoveredAccessToken = `access-${refreshCount + 1}`;
assert.equal(await getOzonDeliveryAccessToken(), recoveredAccessToken);
assert.equal(row?.refreshToken, `r${refreshCount + 1}`);
assert.equal(requestedRefreshTokens.at(-1), "r5");
