import { expect, mock, spyOn, test } from "bun:test";
import { logger } from "@stariva/config";

const send = mock(async (..._args: unknown[]) => ({
  error: null as { message: string } | null,
}));
const smtp = mock(async (_options: unknown) => {});
const env: Record<string, unknown> = {
  RESEND_API_KEY: "synthetic-test-key",
  EMAIL_FROM: "test@example.test",
  EMAIL_SANDBOX_ENABLED: false,
  EMAIL_SANDBOX_HOST: "localhost",
  EMAIL_PROVIDER: "resend",
  EMAIL_FALLBACK_PROVIDER: undefined,
  POSTBOX_ENDPOINT: "https://postbox.example.test",
  POSTBOX_ACCESS_KEY_ID: "synthetic-key-id",
  POSTBOX_SECRET_ACCESS_KEY: "synthetic-secret",
};
const recordEmail = mock(async (_entry: unknown) => {});
mock.module("./env", () => ({ env }));
mock.module("./log", () => ({ recordEmail }));
mock.module("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
mock.module("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: smtp }) },
}));
const { sendEmail } = await import("./send");

test("passes attachments to Resend only when there are any", async () => {
  const attachments = [
    { filename: "Бриф.pdf", content: Buffer.from("%PDF-1.4") },
    { filename: "Схема.pdf", path: "https://storage.example.test/scheme.pdf" },
  ];
  const email = { to: ["buyer@example.test"], subject: "Test", react: null };
  await sendEmail({ ...email, attachments });
  await sendEmail({ ...email, attachments: [] });
  expect(send.mock.calls[0]?.[0]).toMatchObject({ attachments });
  expect(send.mock.calls[1]?.[0]).not.toHaveProperty("attachments");
  send.mockClear();
});

test("passes the deterministic key as Resend options only", async () => {
  const email = {
    to: ["buyer@example.test"],
    subject: "Test",
    react: null,
    idempotencyKey: "workshop:order:booked:email",
  };
  await sendEmail(email);
  expect(send.mock.calls[0]).toEqual([
    { to: email.to, from: env.EMAIL_FROM, subject: email.subject, react: null },
    { idempotencyKey: email.idempotencyKey },
  ]);
  env.EMAIL_SANDBOX_ENABLED = true;
  try {
    await sendEmail(email);
    expect(smtp).toHaveBeenCalledTimes(1);
    expect(smtp.mock.calls[0]?.[0]).not.toHaveProperty("idempotencyKey");
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    env.EMAIL_SANDBOX_ENABLED = false;
    mock.restore();
  }
});

const email = { to: ["buyer@example.test"], subject: "Test", react: null };

const realFetch = globalThis.fetch;
const postbox = mock(
  async (_url: unknown, _init?: RequestInit) =>
    new Response(JSON.stringify({ MessageId: "synthetic-id" }), {
      status: 200,
    }),
);

function resetMocks() {
  send.mockClear();
  smtp.mockClear();
  postbox.mockClear();
  recordEmail.mockClear();
  globalThis.fetch = postbox as unknown as typeof fetch;
}

function restore() {
  globalThis.fetch = realFetch;
  env.EMAIL_PROVIDER = "resend";
  env.EMAIL_FALLBACK_PROVIDER = undefined;
  env.POSTBOX_SECRET_ACCESS_KEY = "synthetic-secret";
}

test("sends through the Postbox REST API when it is the default provider", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  try {
    await sendEmail(email);
    expect(send).not.toHaveBeenCalled();
    expect(postbox).toHaveBeenCalledTimes(1);
    const [url, init] = postbox.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://postbox.example.test/v2/email/outbound-emails",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=synthetic-key-id\/\d{8}\/ru-central1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(headers).not.toHaveProperty("host");
    expect(JSON.parse(String(init?.body))).toEqual({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: email.to },
      Content: {
        Simple: {
          Subject: { Data: "Test", Charset: "UTF-8" },
          Body: {
            Html: {
              Data: expect.stringContaining("<!DOCTYPE html"),
              Charset: "UTF-8",
            },
          },
        },
      },
    });
  } finally {
    restore();
  }
});

test("sends attachments to Postbox as base64, downloading linked ones", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  postbox.mockImplementation(async (url) =>
    String(url).includes("outbound-emails")
      ? new Response(JSON.stringify({ MessageId: "synthetic-id" }))
      : new Response("%PDF-linked"),
  );
  try {
    await sendEmail({
      ...email,
      attachments: [
        { filename: "Бриф.pdf", content: Buffer.from("%PDF-1.4") },
        { filename: "Схема.pdf", path: "https://storage.example.test/s.pdf" },
      ],
    });
    const sent = postbox.mock.calls.find(([url]) =>
      String(url).includes("outbound-emails"),
    );
    expect(
      JSON.parse(String(sent?.[1]?.body)).Content.Simple.Attachments,
    ).toEqual([
      {
        FileName: "Бриф.pdf",
        RawContent: Buffer.from("%PDF-1.4").toString("base64"),
      },
      {
        FileName: "Схема.pdf",
        RawContent: Buffer.from("%PDF-linked").toString("base64"),
      },
    ]);
  } finally {
    postbox.mockImplementation(
      async () =>
        new Response(JSON.stringify({ MessageId: "synthetic-id" }), {
          status: 200,
        }),
    );
    restore();
  }
});

test("rejects an oversized attachment header before reading the body", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  const pull = mock(() => {});
  const cancel = mock(() => {});
  postbox.mockImplementationOnce(
    async () =>
      new Response(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
        headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      }),
  );
  try {
    await expect(
      sendEmail({
        ...email,
        attachments: [
          { filename: "brief.pdf", path: "https://storage.example.test/b.pdf" },
        ],
      }),
    ).rejects.toThrow("exceeds Postbox's 10 MB size limit");
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(postbox).toHaveBeenCalledTimes(1);
  } finally {
    restore();
  }
});

test.each([undefined, "1", "invalid"])(
  "bounds attachment streams with content-length %s and cancels on overflow",
  async (contentLength) => {
    resetMocks();
    env.EMAIL_PROVIDER = "postbox";
    const chunk = new Uint8Array(5 * 1024 * 1024);
    const pull = mock(
      (controller: ReadableStreamDefaultController<Uint8Array>) => {
        controller.enqueue(
          pull.mock.calls.length <= 2 ? chunk : new Uint8Array(1),
        );
      },
    );
    const cancel = mock(() => {});
    postbox.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream({ pull, cancel }, { highWaterMark: 0 }),
          {
            headers:
              contentLength === undefined
                ? {}
                : { "content-length": contentLength },
          },
        ),
    );
    try {
      await expect(
        sendEmail({
          ...email,
          attachments: [
            {
              filename: "brief.pdf",
              path: "https://storage.example.test/b.pdf",
            },
          ],
        }),
      ).rejects.toThrow("exceeds Postbox's 10 MB size limit");
      expect(pull).toHaveBeenCalledTimes(3);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(postbox).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  },
);

test("rejects oversized in-memory Postbox attachments", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  try {
    await expect(
      sendEmail({
        ...email,
        attachments: [
          {
            filename: "brief.pdf",
            content: Buffer.alloc(10 * 1024 * 1024 + 1),
          },
        ],
      }),
    ).rejects.toThrow("exceeds Postbox's 10 MB size limit");
    expect(postbox).not.toHaveBeenCalled();
  } finally {
    restore();
  }
});

test("falls back and logs recipient count and idempotency key without addresses", async () => {
  resetMocks();
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  const errorLog = spyOn(logger, "error").mockImplementation(() => {});
  const keyedEmail = {
    ...email,
    to: ["buyer@example.test", "other@example.test"],
    idempotencyKey: "workshop:order:booked:email",
  };
  send.mockImplementationOnce(async () => ({
    error: { message: "resend is down" },
  }));
  try {
    await sendEmail(keyedEmail);
    expect(send).toHaveBeenCalledTimes(1);
    expect(postbox).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      "Resend failed to send email",
      expect.any(Error),
      {
        recipientCount: 2,
        idempotencyKey: keyedEmail.idempotencyKey,
        willRetryWith: "Yandex Postbox",
      },
    );
  } finally {
    errorLog.mockRestore();
    restore();
  }
});

test("falls back from Postbox to Resend when Postbox rejects the request", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  env.EMAIL_FALLBACK_PROVIDER = "resend";
  postbox.mockImplementationOnce(
    async () =>
      new Response('{"message":"sender not verified"}', { status: 403 }),
  );
  try {
    await sendEmail({ ...email, idempotencyKey: "workshop:o1:booked:email" });
    expect(postbox).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(recordEmail).toHaveBeenCalledTimes(1);
    expect(recordEmail.mock.calls[0]?.[0]).toMatchObject({
      to: email.to,
      subject: "Test",
      idempotencyKey: "workshop:o1:booked:email",
      attempts: [
        {
          provider: "postbox",
          ok: false,
          error: expect.stringContaining("403"),
        },
        { provider: "resend", ok: true },
      ],
    });
  } finally {
    restore();
  }
});

test("logs a failed send with every attempt when all providers fail", async () => {
  resetMocks();
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  send.mockImplementationOnce(async () => ({ error: { message: "down" } }));
  postbox.mockImplementationOnce(
    async () => new Response("unavailable", { status: 503 }),
  );
  try {
    await expect(sendEmail(email)).rejects.toThrow();
    expect(recordEmail).toHaveBeenCalledTimes(1);
    expect(recordEmail.mock.calls[0]?.[0]).toMatchObject({
      attempts: [
        { provider: "resend", ok: false, error: "Resend error: down" },
        { provider: "postbox", ok: false },
      ],
    });
  } finally {
    restore();
  }
});

test("throws the last error when every provider fails", async () => {
  resetMocks();
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  send.mockImplementationOnce(async () => ({ error: { message: "down" } }));
  postbox.mockImplementationOnce(
    async () => new Response("unavailable", { status: 503 }),
  );
  try {
    await expect(sendEmail(email)).rejects.toThrow("Postbox error: HTTP 503");
  } finally {
    restore();
  }
});

test("skips a provider without credentials and uses the next one", async () => {
  resetMocks();
  env.EMAIL_PROVIDER = "postbox";
  env.EMAIL_FALLBACK_PROVIDER = "resend";
  env.POSTBOX_SECRET_ACCESS_KEY = undefined;
  try {
    await sendEmail(email);
    expect(postbox).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    restore();
  }
});
