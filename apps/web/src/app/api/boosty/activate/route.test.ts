import { beforeEach, expect, mock, spyOn, test } from "bun:test";

let limited = false;
let result: { orderIds: string[]; alreadyActive: boolean } = {
  orderIds: [],
  alreadyActive: false,
};
const reserveActivationAttempt = mock(async () => (limited ? null : "attempt"));
const releaseActivationAttempt = mock(async () => {});
const activateBoostyOrders = mock(async () => result);
const requestBoostyActivation = mock(async () => {});
const notifyWorkshopBooked = mock(async () => {});

mock.module("@/lib/workshops/activation-attempts", () => ({
  reserveActivationAttempt,
  releaseActivationAttempt,
}));
mock.module("@/lib/workshops/boosty-activation", () => ({
  activateBoostyOrders,
  requestBoostyActivation,
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
  result = { orderIds: [], alreadyActive: false };
  for (const fn of [
    reserveActivationAttempt,
    releaseActivationAttempt,
    activateBoostyOrders,
    requestBoostyActivation,
    notifyWorkshopBooked,
  ]) {
    fn.mockClear();
  }
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
  result = { orderIds: ["order-1"], alreadyActive: false };
  const response = await activate({ email: " Buyer@Example.Test " });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    activated: 1,
    alreadyActive: false,
  });
  expect(activateBoostyOrders).toHaveBeenCalledWith("buyer@example.test");
  expect(reserveActivationAttempt).toHaveBeenCalledWith("10.0.0.7", "boosty");
  expect(releaseActivationAttempt).toHaveBeenCalledWith("attempt");
  expect(notifyWorkshopBooked).toHaveBeenCalledWith("order-1");
});

test("an unknown email keeps the failed attempt", async () => {
  const response = await activate({ email: "nobody@example.test" });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    activated: 0,
    alreadyActive: false,
  });
  expect(releaseActivationAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
});

test("an already active email is reported without another email", async () => {
  result = { orderIds: [], alreadyActive: true };
  const response = await activate({ email: "buyer@example.test" });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    activated: 0,
    alreadyActive: true,
  });
  expect(releaseActivationAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
});

test("a failed activation queues a manual request", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  activateBoostyOrders.mockRejectedValueOnce(new Error("db down"));
  try {
    const response = await activate({ email: "buyer@example.test" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      activated: 0,
      alreadyActive: false,
      queued: true,
    });
    expect(requestBoostyActivation).toHaveBeenCalledWith("buyer@example.test");
    expect(releaseActivationAttempt).not.toHaveBeenCalled();
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
