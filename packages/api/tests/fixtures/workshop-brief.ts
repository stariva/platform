import { mock } from "bun:test";
import assert from "node:assert/strict";
import { call, os } from "@orpc/server";
import type { Database, SQL } from "@stariva/db";
import { PgDialect } from "drizzle-orm/pg-core";

const scenario = process.argv[2];
const adminProcedure = os.$context<{ db: Database }>();
mock.module("../../src/orpc", () => ({ adminProcedure }));
const logError = mock(() => {});
mock.module("@stariva/config", () => ({
  env: {},
  logger: { error: logError },
}));
const providerError = new Error("provider down");
const email = mock(async ({ to }: { to: string; idempotencyKey?: string }) => {
  if (scenario === "single-send-fails" || to === "failed@example.test") {
    throw providerError;
  }
});
mock.module("@stariva/emails", () => ({ sendWorkshopBriefEmail: email }));
const load = mock(async () => [
  { label: "Бриф", filename: "brief.pdf", content: Buffer.from("%PDF") },
]);
mock.module("@stariva/storage", () => ({ loadWorkshopMaterials: load }));

const { sendBrief, sendMissingBriefs } = await import(
  "../../src/routers/admin/workshops/brief"
);
const recipient = {
  orderId: "order-1",
  slug: "synthetic-workshop",
  accessToken: "synthetic-access",
  to: "buyer@example.test",
  status: "paid",
};
const second = { ...recipient, orderId: "order-2", to: "failed@example.test" };
const workshop = {
  title: "Test",
  materialFiles: [{ label: "Бриф", key: "workshops/test/materials/brief.pdf" }],
};
const markError = new Error("database down");
let markFails =
  scenario === "single-mark-fails" || scenario === "bulk-recovery";
const marked: string[] = [];
const predicates: ReturnType<PgDialect["sqlToQuery"]>[] = [];
let rows: unknown[][] = [];
const upsert = mock(async () => {
  if (markFails) throw markError;
});
const db = {
  select: () => {
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: (condition: SQL) => {
        predicates.push(new PgDialect().sqlToQuery(condition));
        const result = Promise.resolve(rows.shift() ?? []);
        return Object.assign(result, { orderBy: () => result });
      },
    };
    return query;
  },
  insert: () => ({
    values: (value: {
      orderId: string;
      kind: string;
      channel: string;
      leaseUntil: null;
    }) => {
      assert.equal(value.kind, "brief");
      assert.equal(value.channel, "email");
      assert.equal(value.leaseUntil, null);
      marked.push(value.orderId);
      return { onConflictDoUpdate: upsert };
    },
  }),
} as unknown as Database;
const context = { db };

if (scenario?.startsWith("single")) {
  rows = [[recipient], [workshop]];
  const result = call(sendBrief, { orderId: recipient.orderId }, { context });
  if (scenario === "single-send-fails") {
    await assert.rejects(result, {
      code: "BAD_GATEWAY",
      message: "Письмо не ушло, попробуйте ещё раз",
    });
    assert.equal(upsert.mock.calls.length, 0);
    assert.deepEqual(logError.mock.calls[0], [
      "workshops.brief.send_failed",
      providerError,
      { orderId: recipient.orderId },
    ]);
  } else {
    assert.deepEqual(await result, {
      to: recipient.to,
      recorded: !markFails,
      warning: markFails ? "Письмо отправлено, но отметка не сохранена" : null,
    });
    assert.equal(upsert.mock.calls.length, 1);
    assert.equal(email.mock.calls[0]?.[0].idempotencyKey, undefined);
    if (markFails) {
      assert.deepEqual(logError.mock.calls[0], [
        "workshops.brief.mark_failed",
        markError,
        { orderId: recipient.orderId },
      ]);
    }
  }
} else {
  const input = { workshop: recipient.slug };
  rows = [
    [workshop],
    [recipient, second, { ...recipient, orderId: "order-3", to: null }],
  ];
  const result = await call(sendMissingBriefs, input, { context });
  assert.deepEqual(result, {
    sent: 1,
    failed: [second.to, "заказ order-3: нет email"],
    unmarked: markFails
      ? [{ orderId: recipient.orderId, to: recipient.to }]
      : [],
    recovered: 0,
  });
  assert.equal(
    email.mock.calls[0]?.[0].idempotencyKey,
    "workshop:order-1:brief:email",
  );
  if (scenario === "bulk-recovery") {
    // Recovery works during a storage outage and never contacts the mail provider.
    load.mockImplementation(async () => {
      throw new Error("storage down");
    });
    const recovery = { ...input, recordOnlyOrderIds: [recipient.orderId] };
    rows = [[recipient]];
    assert.deepEqual(await call(sendMissingBriefs, recovery, { context }), {
      sent: 0,
      failed: [],
      unmarked: result.unmarked,
      recovered: 0,
    });
    markFails = false;
    rows = [[recipient]];
    assert.deepEqual(await call(sendMissingBriefs, recovery, { context }), {
      sent: 0,
      failed: [],
      unmarked: [],
      recovered: 1,
    });
    const predicate = predicates.at(-1);
    assert.ok(predicate?.sql.includes('"orders"."id" in'));
    assert.ok(predicate?.params.includes(recipient.orderId));
    assert.ok(predicate?.params.includes(recipient.slug));
    assert.ok(predicate?.sql.includes('"orders"."status" = \'paid\''));
    assert.equal(email.mock.calls.length, 2);
    assert.equal(load.mock.calls.length, 1);
    assert.deepEqual(marked, [
      recipient.orderId,
      recipient.orderId,
      recipient.orderId,
    ]);
    // A second recovery after the marker was saved selects no recipients.
    rows = [[]];
    assert.deepEqual(await call(sendMissingBriefs, recovery, { context }), {
      sent: 0,
      failed: [],
      unmarked: [],
      recovered: 0,
    });
    await assert.rejects(
      call(
        sendMissingBriefs,
        { ...input, recordOnlyOrderIds: [] },
        { context },
      ),
      { code: "BAD_REQUEST" },
    );
    assert.equal(email.mock.calls.length, 2);
  } else {
    rows = [[workshop], [second]];
    await call(sendMissingBriefs, input, { context });
    assert.equal(
      email.mock.calls[1]?.[0].idempotencyKey,
      email.mock.calls[2]?.[0].idempotencyKey,
    );
  }
}
