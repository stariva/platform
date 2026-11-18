import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type DeliveryConfig,
  deliverNotification,
  missingEmailSettings,
  type NotificationEmail,
} from "./delivery";

const notification = {
  id: "test-request",
  message: "Тест & <эскиз>",
  photoBase64: null,
  photoType: null,
};
const config: DeliveryConfig = {
  telegramToken: "test",
  telegramChatId: "test",
  emailFrom: "from@example.test",
  emailTo: "to@example.test",
  emailSend: async () => {},
};
function fakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return handler as unknown as typeof fetch;
}
/** emailSend, который запоминает письма и может падать. */
function spyEmailSend(fail?: Error) {
  const mails: NotificationEmail[] = [];
  return {
    mails,
    send: async (mail: NotificationEmail) => {
      if (fail) throw fail;
      mails.push(mail);
    },
  };
}
test("both providers failing HTTP or transport never counts as delivered", async () => {
  const email = spyEmailSend(new Error("email_failed"));
  assert.equal(
    await deliverNotification(
      notification,
      { ...config, emailSend: email.send },
      fakeFetch(() => new Response("failure", { status: 500 })),
    ),
    false,
  );
  assert.equal(
    await deliverNotification(
      notification,
      { ...config, emailSend: email.send },
      fakeFetch(() => {
        throw new Error("offline");
      }),
    ),
    false,
  );
});
test("email alone does not count as delivered when Telegram is configured and fails", async () => {
  const original = console.error;
  console.error = () => {};
  const email = spyEmailSend();
  try {
    assert.equal(
      await deliverNotification(
        notification,
        { ...config, emailSend: email.send },
        fakeFetch(() => Response.json({ ok: false })),
      ),
      false,
    );
  } finally {
    console.error = original;
  }
  assert.equal(email.mails.length, 1);
});
test("a delivered email is enough when Telegram is not configured", async () => {
  const email = spyEmailSend();
  assert.equal(
    await deliverNotification(notification, {
      emailFrom: "from@example.test",
      emailTo: "to@example.test",
      emailSend: email.send,
    }),
    true,
  );
  assert.equal(email.mails[0]?.to, "to@example.test");
});
test("HTTP 200 without a provider acknowledgement is not delivery", async () => {
  assert.equal(
    await deliverNotification(
      notification,
      config,
      fakeFetch(() => Response.json({ error: "failed" })),
    ),
    false,
  );
});
test("missing recipient is not a configured email channel", async () => {
  const email = spyEmailSend();
  assert.equal(
    await deliverNotification(notification, {
      emailFrom: "from@example.test",
      emailSend: email.send,
    }),
    false,
  );
  assert.equal(email.mails.length, 0);
});
test("email retains photo and escapes user content, with stable retry key", async () => {
  const email = spyEmailSend();
  await deliverNotification(
    { ...notification, photoBase64: "dGVzdA==", photoType: "image/png" },
    {
      emailFrom: "from@example.test",
      emailTo: "to@example.test",
      emailSend: email.send,
    },
  );
  const mail = email.mails[0];
  assert.ok(mail?.html.includes("&amp; &lt;эскиз&gt;"));
  assert.equal(mail?.attachments?.[0]?.filename, "inspiration.png");
  assert.deepEqual(mail?.attachments?.[0]?.content, Buffer.from("test"));
  assert.equal(mail?.idempotencyKey, "custom-order/test-request");
});
test("long Telegram messages use complete plain text chunks and failed photo remains pending", async () => {
  const parts: string[] = [];
  const delivered = await deliverNotification(
    {
      ...notification,
      message: "<&>".repeat(1800),
      photoBase64: "dGVzdA==",
      photoType: "image/jpeg",
    },
    { telegramToken: "test", telegramChatId: "test" },
    fakeFetch((url, init) => {
      if (url.endsWith("sendDocument"))
        return new Response("failed", { status: 500 });
      const payload = JSON.parse(String(init?.body));
      assert.ok(payload.text.length <= 3500);
      assert.equal(payload.parse_mode, undefined);
      parts.push(payload.text);
      return Response.json({ ok: true });
    }),
  );
  assert.ok(parts.join("").endsWith("<&>".repeat(1800)));
  assert.equal(delivered, false);
});
test("missing email settings are named for the log", () => {
  assert.deepEqual(missingEmailSettings(config), []);
  assert.deepEqual(missingEmailSettings({ ...config, emailTo: "" }), [
    "ORDER_EMAIL_TO",
  ]);
});
test("a failed channel is logged even when the other one delivered", async () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(
      await deliverNotification(
        notification,
        { ...config, emailSend: spyEmailSend(new Error("email_failed")).send },
        fakeFetch(() => Response.json({ ok: true })),
      ),
      true,
    );
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]?.[1]), /email_failed/);
});
test("Telegram requests go to api.telegram.org", async () => {
  const urls: string[] = [];
  await deliverNotification(
    notification,
    config,
    fakeFetch((url) => {
      urls.push(url);
      return Response.json({ ok: true });
    }),
  );
  assert.ok(urls.includes("https://api.telegram.org/bottest/sendMessage"));
});
test("the log names the Telegram status and description", async () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(
      await deliverNotification(
        notification,
        { telegramToken: "test", telegramChatId: "test" },
        fakeFetch(() =>
          Response.json(
            { ok: false, description: "Bad Request: chat not found" },
            { status: 400 },
          ),
        ),
      ),
      false,
    );
  } finally {
    console.error = original;
  }
  assert.match(String(errors[0]?.[1]), /HTTP 400 Bad Request: chat not found/);
});
