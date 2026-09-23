import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderHandler } from "./request-handler";
import type { OrderRequest } from "./schema";

const requestId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
function request(extra: Record<string, string | Blob | undefined> = {}) {
  const form = new FormData();
  const values: Record<string, string | Blob | undefined> = { requestId, contact: "test@example.test", description: "Абажур по размерам", personalDataConsent: "true", ...extra };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (value instanceof Blob) form.set(key, value, value.type === "image/jpeg" ? "test.jpg" : value.type === "image/png" ? "test.png" : "test.svg");
    else form.set(key, value);
  }
  return new Request("http://localhost/api/custom-order", { method: "POST", body: form });
}
function setup(options: { configured?: boolean; fail?: string } = {}) {
  const saved: Array<{ data: OrderRequest; photo: File | null }> = [];
  const queued: Array<() => Promise<void>> = [];
  const delivered: string[] = [];
  const handler = createOrderHandler({
    notificationConfigured: () => options.configured ?? true,
    saveRequest: async (data, photo) => { if (options.fail) throw new Error(options.fail); saved.push({ data, photo }); return requestId; },
    dispatchRequest: async (id) => { delivered.push(id); },
    after: (callback) => { queued.push(callback); },
  });
  return { handler, saved, queued, delivered };
}
test("acknowledges only persisted complete requests; notification is deferred", async () => {
  const api = setup();
  const response = await api.handler(request({ measurements: "50 × 60 см", measurementHelp: "true", attribution: JSON.stringify({ utm_source: "instagram", utm_campaign: "blogger", token: "must-not-store" }), photo: new Blob(["test-image"], { type: "image/jpeg" }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, requestId });
  assert.equal(api.saved[0]?.data.name, "");
  assert.equal(api.saved[0]?.data.measurements, "50 × 60 см");
  assert.deepEqual(api.saved[0]?.data.attribution, { utm_source: "instagram", utm_campaign: "blogger" });
  assert.equal(await api.saved[0]?.photo?.text(), "test-image");
  assert.equal(api.delivered.length, 0);
  await api.queued[0]?.();
  assert.deepEqual(api.delivered, [requestId]);
});
test("database failure never claims success or starts delivery", async () => {
  const api = setup({ fail: "database_down" });
  const response = await api.handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, undefined);
  assert.equal(api.queued.length, 0);
});
test("unconfigured channels fail explicitly", async () => {
  const api = setup({ configured: false });
  assert.equal((await api.handler(request())).status, 503);
  assert.equal(api.saved.length, 0);
});
test("idempotency conflicts do not acknowledge another payload", async () => {
  const api = setup({ fail: "request_conflict" });
  assert.equal((await api.handler(request())).status, 409);
});
test("invalid consent, invalid campaign, empty contact and honeypot never persist", async () => {
  const api = setup();
  for (const extra of [{ personalDataConsent: "false" }, { attribution: "not-json" }, { contact: " " }, { website: "spam" }]) {
    assert.equal((await api.handler(request(extra))).status, 400);
  }
  assert.equal(api.saved.length, 0);
});
test("rejects oversized and unsupported photos before persistence", async () => {
  const api = setup();
  assert.equal((await api.handler(request({ photo: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/jpeg" }) }))).status, 400);
  assert.equal((await api.handler(request({ photo: new Blob(["svg"], { type: "image/svg+xml" }) }))).status, 400);
  assert.equal(api.saved.length, 0);
});
