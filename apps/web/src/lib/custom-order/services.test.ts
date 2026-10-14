import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTION_COOKIE } from "@/lib/campaign-attribution";
import type { OrderRequest } from "./schema";
import { createCustomOrderServices } from "./services";

const requestId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const touch = {
  utm_source: "instagram",
  utm_campaign: "blogger",
  landing: "/custom",
  at: "2026-10-10T12:00:00.000Z",
};
const order = {
  requestId,
  name: "",
  contact: "test@example.test",
  description: "Абажур по размерам",
  measurements: "50 × 60 см",
  measurementHelp: "true" as const,
  personalDataConsent: "true" as const,
};

function setup(options: { fail?: string } = {}) {
  const saved: Array<{ data: OrderRequest; photo: File | null }> = [];
  const queued: Array<() => Promise<void>> = [];
  const delivered: string[] = [];
  const services = createCustomOrderServices({
    notificationConfigured: () => true,
    saveRequest: async (data, photo) => {
      if (options.fail) throw new Error(options.fail);
      saved.push({ data, photo });
      return { id: requestId, number: 1042 };
    },
    dispatchRequest: async (id) => {
      if (options.fail === "dispatch") throw new Error("telegram down");
      delivered.push(id);
    },
    after: (callback) => {
      queued.push(callback);
    },
  });
  return { services, saved, queued, delivered };
}

function headers(cookie?: string) {
  return new Headers(cookie ? { cookie } : {});
}

test("source comes only from our cookie, without its token", async () => {
  const api = setup();
  const photo = new File(["test-image"], "test.jpg", { type: "image/jpeg" });
  const cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(
    JSON.stringify({ first: touch, last: touch, token: "must-not-store" }),
  )}`;
  const result = await api.services.save(order, photo, headers(cookie));
  assert.deepEqual(result, { id: requestId, number: 1042 });
  assert.equal(api.saved[0]?.data.measurements, "50 × 60 см");
  assert.deepEqual(api.saved[0]?.data.attribution, {
    first: touch,
    last: touch,
  });
  assert.equal(await api.saved[0]?.photo?.text(), "test-image");
});

test("broken campaign cookie never blocks a request", async () => {
  const api = setup();
  await api.services.save(
    order,
    null,
    headers(`${ATTRIBUTION_COOKIE}=not-json`),
  );
  assert.equal(api.saved[0]?.data.attribution, undefined);
});

test("an idempotency conflict is reported, other failures are not hidden", async () => {
  assert.equal(
    await setup({ fail: "request_conflict" }).services.save(
      order,
      null,
      headers(),
    ),
    "conflict",
  );
  await assert.rejects(
    setup({ fail: "database_down" }).services.save(order, null, headers()),
    /database_down/,
  );
});

test("notification waits for the answer and never fails the request", async () => {
  const api = setup();
  api.services.dispatchLater(requestId);
  assert.deepEqual(api.delivered, []);
  await api.queued[0]?.();
  assert.deepEqual(api.delivered, [requestId]);

  const failing = setup({ fail: "dispatch" });
  failing.services.dispatchLater(requestId);
  await failing.queued[0]?.();
});
