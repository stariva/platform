import { expect, mock, test } from "bun:test";

const send = mock(async (..._args: unknown[]) => ({ error: null }));
const smtp = mock(async (_options: unknown) => {});
const env = {
  RESEND_API_KEY: "synthetic-test-key",
  EMAIL_FROM: "test@example.test",
  EMAIL_SANDBOX_ENABLED: false,
  EMAIL_SANDBOX_HOST: "localhost",
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
