import assert from "node:assert/strict";
import { test } from "node:test";
import { orderRequestSchema } from "./schema";

test("durable inbox: atomic duplicate protection, lease and retry after failure", {
  skip: !process.env.CUSTOM_ORDER_TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.CUSTOM_ORDER_TEST_DATABASE_URL ?? "");
  // Refuse to run this fixture against anything except the dedicated local test DB.
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/stariva_custom_order_test");
  process.env.POSTGRES_URL = url.href;
  const { db, customOrderRequests } = await import("@stariva/db");
  const { eq, sql } = await import("drizzle-orm");
  const { saveRequest, dispatchRequest } = await import("./inbox");
  const id = crypto.randomUUID();
  const data = orderRequestSchema.parse({
    requestId: id,
    contact: "test@example.test",
    description: "Тестовый абажур, не отправлять",
    personalDataConsent: "true",
    attribution: { utm_source: "test" },
  });
  const photo = new File(["synthetic-photo"], "test.jpg", {
    type: "image/jpeg",
  });
  assert.deepEqual(
    await Promise.all([saveRequest(data, photo), saveRequest(data, photo)]),
    [id, id],
  );
  const read = async () =>
    (
      await db
        .select()
        .from(customOrderRequests)
        .where(eq(customOrderRequests.id, id))
    )[0];
  assert.equal(
    (await read())?.photoBase64,
    Buffer.from("synthetic-photo").toString("base64"),
  );
  await assert.rejects(
    saveRequest({ ...data, contact: "other@example.test" }, photo),
    /request_conflict/,
  );
  let calls = 0;
  const fail = async () => {
    calls++;
    return false;
  };
  await Promise.all([dispatchRequest(id, fail), dispatchRequest(id, fail)]);
  assert.equal(calls, 1);
  assert.equal((await read())?.deliveredAt, null);
  assert.equal((await read())?.attempts, 1);
  assert.ok(((await read())?.nextAttemptAt.getTime() ?? 0) > Date.now());
  assert.equal((await read())?.lockedUntil, null);
  // Failed notification retains all data and becomes deliverable after backoff.
  await db
    .update(customOrderRequests)
    .set({ nextAttemptAt: sql`now() - interval '1 minute'` })
    .where(eq(customOrderRequests.id, id));
  await dispatchRequest(id, async () => {
    calls++;
    return true;
  });
  assert.ok((await read())?.deliveredAt);
  await dispatchRequest(id, fail);
  assert.equal(calls, 2);
  assert.equal((await read())?.data.contact, "test@example.test");
});
