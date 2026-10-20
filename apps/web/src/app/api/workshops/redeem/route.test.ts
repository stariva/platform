import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

const code = {
  id: "code",
  code: "482719",
  workshopSlug: "elka",
  channel: "livemaster",
  amount: 249000,
  note: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  redeemedAt: null as Date | null,
  orderId: null,
};

let found: typeof code | null = code;
let owned = false;
let limited = false;
const recordAccessCodeFailure = mock(async () => {});
const redeemAccessCode = mock(async () => ({ id: "order" }));
const notifyWorkshopBooked = mock(async () => {});
const sendLoginEmail = mock(async () => {});

mock.module("@/lib/workshops/access-codes", () => ({
  findAccessCode: async () => found,
  isAccessCodeRateLimited: async () => limited,
  recordAccessCodeFailure,
  redeemAccessCode,
}));
const webApi = await import("@stariva/web-api");
mock.module("@stariva/web-api", () => ({
  ...webApi,
  hasAccess: async () => owned,
}));
mock.module("@/lib/auth/session", () => ({ getSession: async () => null }));
mock.module("@/lib/workshops/buyer", () => ({
  findOrCreateBuyer: async () => ({ id: "buyer", email: "buyer@example.test" }),
  sendLoginEmail,
}));
mock.module("@/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => ({
    slug: "elka",
    title: "Ёлка макраме",
    releaseAt: null,
  }),
}));
// Модульные моки bun общие для всех файлов: siteUrl ждёт payments/create
mock.module("@/lib/workshops/notifications", () => ({
  notifyWorkshopBooked,
  siteUrl: () => "https://example.test",
}));
mock.module("@/lib/visitor", () => ({
  clientIp: () => "203.0.113.7",
  collectVisitor: async () => null,
}));
const { POST } = await import("./route");

beforeEach(() => {
  found = code;
  owned = false;
  limited = false;
  for (const fn of [
    recordAccessCodeFailure,
    redeemAccessCode,
    notifyWorkshopBooked,
    sendLoginEmail,
  ]) {
    fn.mockClear();
  }
});

function redeem(body: Record<string, unknown>) {
  return POST(
    new NextRequest("https://example.test/api/workshops/redeem", {
      method: "POST",
      body: JSON.stringify({
        email: "buyer@example.test",
        personalDataConsent: true,
        ...body,
      }),
    }),
  );
}

test("a valid code opens the course and sends the access email", async () => {
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    email: "buyer@example.test",
    title: "Ёлка макраме",
  });
  expect(redeemAccessCode).toHaveBeenCalledTimes(1);
  expect(notifyWorkshopBooked).toHaveBeenCalledWith("order");
});

test("an unknown code is counted against the IP", async () => {
  found = null;
  const response = await redeem({ code: "111 222" });
  expect(response.status).toBe(404);
  expect(recordAccessCodeFailure).toHaveBeenCalledWith("203.0.113.7");
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("a code with missing digits is rejected before any lookup", async () => {
  const response = await redeem({ code: "482 71" });
  expect(response.status).toBe(400);
  expect(recordAccessCodeFailure).not.toHaveBeenCalled();
});

test("too many wrong codes from one IP are refused", async () => {
  limited = true;
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(429);
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("an already redeemed code is not reused", async () => {
  found = { ...code, redeemedAt: new Date() };
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("an owner of the course keeps the code and gets a login email", async () => {
  owned = true;
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect(redeemAccessCode).not.toHaveBeenCalled();
  expect(sendLoginEmail).toHaveBeenCalledTimes(1);
});

test("a guest must agree to personal data processing", async () => {
  const response = await redeem({
    code: "482 719",
    personalDataConsent: false,
  });
  expect(response.status).toBe(400);
  expect(redeemAccessCode).not.toHaveBeenCalled();
});
