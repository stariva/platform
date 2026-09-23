import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverNotification, type DeliveryConfig } from "./delivery";
const notification = { id: "test-request", message: "Тест & <эскиз>", photoBase64: null, photoType: null };
const config: DeliveryConfig = { telegramToken: "test", telegramChatId: "test", emailKey: "test", emailFrom: "from@example.test", emailTo: "to@example.test" };
function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch { return handler as unknown as typeof fetch; }
test("both providers failing HTTP or transport never counts as delivered", async () => {
  assert.equal(await deliverNotification(notification, config, fakeFetch(() => new Response("failure", { status: 500 }))), false);
  assert.equal(await deliverNotification(notification, config, fakeFetch(() => { throw new Error("offline"); })), false);
});
test("a validated email receipt is enough when Telegram fails", async () => {
  assert.equal(await deliverNotification(notification, config, fakeFetch(url => url.includes("resend") ? Response.json({ id: "receipt" }) : Response.json({ ok: false }))), true);
});
test("HTTP 200 without a provider acknowledgement is not delivery", async () => {
  assert.equal(await deliverNotification(notification, config, fakeFetch(() => Response.json({ error: "failed" }))), false);
});
test("missing recipient is not a configured email channel", async () => {
  let called = false;
  assert.equal(await deliverNotification(notification, { emailKey: "test", emailFrom: "from@example.test" }, fakeFetch(() => { called = true; return Response.json({ id: "receipt" }); })), false);
  assert.equal(called, false);
});
test("email retains photo and escapes user content, with stable retry key", async () => {
  await deliverNotification({ ...notification, photoBase64: "dGVzdA==", photoType: "image/png" }, { emailKey: "test", emailFrom: "from@example.test", emailTo: "to@example.test" }, fakeFetch((_url, init) => {
    const payload = JSON.parse(String(init?.body));
    assert.ok(payload.html.includes("&amp; &lt;эскиз&gt;"));
    assert.equal(payload.attachments[0].content, "dGVzdA==");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "custom-order/test-request");
    return Response.json({ id: "receipt" });
  }));
});
test("long Telegram messages use complete plain text chunks and failed photo remains pending", async () => {
  const parts: string[] = [];
  const delivered = await deliverNotification({ ...notification, message: "<&>".repeat(1800), photoBase64: "dGVzdA==", photoType: "image/jpeg" }, { telegramToken: "test", telegramChatId: "test" }, fakeFetch((url, init) => {
    if (url.endsWith("sendDocument")) return new Response("failed", { status: 500 });
    const payload = JSON.parse(String(init?.body));
    assert.ok(payload.text.length <= 3500);
    assert.equal(payload.parse_mode, undefined);
    parts.push(payload.text);
    return Response.json({ ok: true });
  }));
  assert.ok(parts.join("").endsWith("<&>".repeat(1800)));
  assert.equal(delivered, false);
});
