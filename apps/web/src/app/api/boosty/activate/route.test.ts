import { beforeEach, expect, mock, spyOn, test } from "bun:test";

let limited = false;
let limitFails = false;
let fallbackFails = false;
let result: {
  activatedOrderIds: string[];
  paidOrderIds: string[];
} = { activatedOrderIds: [], paidOrderIds: [] };
const reserveActivationAttempt = mock(async () => {
  if (limitFails) throw new Error("db down");
  return limited ? null : "attempt";
});
const releaseActivationAttempt = mock(async () => {});
const activateBoostyOrders = mock(async () => result);
const requestBoostyActivation = mock(async () => {
  if (fallbackFails) throw new Error("db down");
});
const notifyWorkshopBooked = mock(async (_orderId: string) => {});
const sendLoginEmail = mock(
  async (_email: string, _callbackURL: string, _headers: Headers) => {},
);
const issueBoostyOrderReceipt = mock(async (_orderId: string) => true);
const afterCallbacks: (() => unknown)[] = [];
const after = mock((callback: () => unknown) => {
  afterCallbacks.push(callback);
});

/** Запускает отложенное после ответа (after): выписка чеков. */
async function runAfter() {
  for (const callback of afterCallbacks.splice(0)) await callback();
}

mock.module("@/lib/workshops/activation-attempts", () => ({
  reserveActivationAttempt,
  releaseActivationAttempt,
}));
mock.module("@/lib/workshops/boosty-activation", () => ({
  activateBoostyOrders,
  requestBoostyActivation,
}));
mock.module("@/lib/workshops/boosty-receipt", () => ({
  issueBoostyOrderReceipt,
}));
// Импорт настоящего next/server в моке зависает bun: достаточно своего
// NextResponse.json и after. Маршрут больше ничего из next/server не берёт.
mock.module("next/server", () => ({
  after,
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...init?.headers },
      }),
  },
}));
mock.module("@/lib/workshops/buyer", () => ({
  findOrCreateBuyer: async () => ({ id: "buyer", email: "buyer@example.test" }),
  createLoginRedirect: async () => null,
  sendLoginEmail,
}));
// Модульные моки bun общие для всех файлов: сохраняем тот же набор, что ждут
// маршруты покупки и активации кода
mock.module("@/lib/workshops/notifications", () => ({
  siteUrl: () => "https://example.test",
  notifyWorkshopBooked,
}));

const { POST } = await import("./route");

beforeEach(() => {
  limited = false;
  limitFails = false;
  fallbackFails = false;
  result = { activatedOrderIds: [], paidOrderIds: [] };
  for (const fn of [
    reserveActivationAttempt,
    releaseActivationAttempt,
    activateBoostyOrders,
    requestBoostyActivation,
    notifyWorkshopBooked,
    sendLoginEmail,
    issueBoostyOrderReceipt,
    after,
  ]) {
    fn.mockClear();
  }
  afterCallbacks.length = 0;
});

function activate(body: Record<string, unknown>, ip = "10.0.0.7") {
  return POST(
    new Request("https://example.test/api/boosty/activate", {
      method: "POST",
      headers: { "x-real-ip": ip },
      body: JSON.stringify(body),
    }),
  );
}

test("a matching email opens access and sends the login email", async () => {
  result = { activatedOrderIds: ["order-1"], paidOrderIds: [] };
  const response = await activate({ email: " Buyer@Example.Test " });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(activateBoostyOrders).toHaveBeenCalledWith("buyer@example.test");
  expect(reserveActivationAttempt).toHaveBeenCalledWith("10.0.0.7", "boosty");
  expect(releaseActivationAttempt).toHaveBeenCalledWith("attempt");
  expect(notifyWorkshopBooked).toHaveBeenCalledWith("order-1");
  expect(sendLoginEmail).not.toHaveBeenCalled();
  // Чек Boosty-покупки выписывается после ответа покупателю
  expect(issueBoostyOrderReceipt).not.toHaveBeenCalled();
  await runAfter();
  expect(issueBoostyOrderReceipt).toHaveBeenCalledTimes(1);
  expect(issueBoostyOrderReceipt).toHaveBeenCalledWith("order-1");
});

test("an unknown email keeps the failed attempt and gets the same response", async () => {
  const response = await activate({ email: "nobody@example.test" });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(releaseActivationAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
  expect(sendLoginEmail).not.toHaveBeenCalled();
});

test("an already active email gets a fresh login link", async () => {
  result = { activatedOrderIds: [], paidOrderIds: ["order-1"] };
  const response = await activate({ email: "buyer@example.test" });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(releaseActivationAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
  expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  expect(sendLoginEmail.mock.calls[0]?.[0]).toBe("buyer@example.test");
  expect(sendLoginEmail.mock.calls[0]?.[1]).toBe("/account");
});

test("a failed activation queues a manual request", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  activateBoostyOrders.mockRejectedValueOnce(new Error("db down"));
  try {
    const response = await activate({ email: "buyer@example.test" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, queued: true });
    expect(requestBoostyActivation).toHaveBeenCalledWith("buyer@example.test");
    expect(releaseActivationAttempt).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("a failed manual fallback is reported as a service error", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  activateBoostyOrders.mockRejectedValueOnce(new Error("db down"));
  fallbackFails = true;
  try {
    const response = await activate({ email: "buyer@example.test" });

    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("error");
    expect(releaseActivationAttempt).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("a storage failure in the rate limiter is not reported as a limit", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  limitFails = true;
  try {
    const response = await activate({ email: "buyer@example.test" });

    expect(response.status).toBe(503);
    expect(activateBoostyOrders).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("too many attempts from one IP are refused", async () => {
  limited = true;
  const response = await activate({ email: "buyer@example.test" });

  expect(response.status).toBe(429);
  expect(activateBoostyOrders).not.toHaveBeenCalled();
  expect(releaseActivationAttempt).not.toHaveBeenCalled();
});

test("an invalid email is rejected before the rate limit", async () => {
  const response = await activate({ email: "not-an-email" });

  expect(response.status).toBe(400);
  expect(reserveActivationAttempt).not.toHaveBeenCalled();
  expect(activateBoostyOrders).not.toHaveBeenCalled();
});
