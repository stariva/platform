import { expect, mock, test } from "bun:test";

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
  POSTBOX_SMTP_HOST: "postbox.example.test",
  POSTBOX_SMTP_PORT: 465,
  POSTBOX_SMTP_USER: "synthetic-key-id",
  POSTBOX_SMTP_PASSWORD: "synthetic-secret",
};
mock.module("./env", () => ({ env }));
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

test("sends through Postbox SMTP when it is the default provider", async () => {
  send.mockClear();
  smtp.mockClear();
  env.EMAIL_PROVIDER = "postbox";
  try {
    await sendEmail(email);
    expect(smtp).toHaveBeenCalledTimes(1);
    expect(smtp.mock.calls[0]?.[0]).toMatchObject({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
    });
    expect(send).not.toHaveBeenCalled();
  } finally {
    env.EMAIL_PROVIDER = "resend";
  }
});

test("falls back to the second provider when the first one fails", async () => {
  send.mockClear();
  smtp.mockClear();
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  send.mockImplementationOnce(async () => ({
    error: { message: "resend is down" },
  }));
  try {
    await sendEmail(email);
    expect(send).toHaveBeenCalledTimes(1);
    expect(smtp).toHaveBeenCalledTimes(1);
  } finally {
    env.EMAIL_FALLBACK_PROVIDER = undefined;
  }
});

test("throws the last error when every provider fails", async () => {
  smtp.mockClear();
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  send.mockImplementationOnce(async () => ({ error: { message: "down" } }));
  smtp.mockImplementationOnce(async () => {
    throw new Error("smtp down");
  });
  try {
    await expect(sendEmail(email)).rejects.toThrow("smtp down");
  } finally {
    env.EMAIL_FALLBACK_PROVIDER = undefined;
  }
});

test("uses the fallback when the primary has no credentials", async () => {
  send.mockClear();
  smtp.mockClear();
  const key = env.RESEND_API_KEY;
  env.EMAIL_FALLBACK_PROVIDER = "postbox";
  env.POSTBOX_SMTP_PASSWORD = "synthetic-secret";
  // Resend client is created at import time, so drop it through the provider flag.
  const { resend } = await import("./send");
  expect(resend).not.toBeNull();
  env.RESEND_API_KEY = key;
  env.EMAIL_PROVIDER = "postbox";
  env.EMAIL_FALLBACK_PROVIDER = "resend";
  try {
    await sendEmail(email);
    expect(smtp).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  } finally {
    env.EMAIL_PROVIDER = "resend";
    env.EMAIL_FALLBACK_PROVIDER = undefined;
  }
});
