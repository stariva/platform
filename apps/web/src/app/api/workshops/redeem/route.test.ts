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
const reserveAccessCodeAttempt = mock(async () => (limited ? null : "attempt"));
const releaseAccessCodeAttempt = mock(async () => {});
const findAccessCode = mock(async () => found);
const redeemAccessCode = mock(
  async (): Promise<{ id: string } | null> => ({
    id: "order",
  }),
);
const notifyWorkshopBooked = mock(async () => {});
const sendLoginEmail = mock(async () => {});

mock.module("@/lib/workshops/access-codes", () => ({
  findAccessCode,
  reserveAccessCodeAttempt,
  releaseAccessCodeAttempt,
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
// @/lib/visitor не подменяем: мок попал бы в другие файлы. Частный IP
// не уходит в геопоиск.
const { POST } = await import("./route");

beforeEach(() => {
  found = code;
  owned = false;
  limited = false;
  for (const fn of [
    findAccessCode,
    reserveAccessCodeAttempt,
    releaseAccessCodeAttempt,
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
      headers: { "x-real-ip": "10.0.0.7" },
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
  expect(reserveAccessCodeAttempt).toHaveBeenCalledWith("10.0.0.7");
  expect(releaseAccessCodeAttempt).toHaveBeenCalledWith("attempt");
  expect(notifyWorkshopBooked).toHaveBeenCalledWith("order");
});

test("an unknown code is counted against the IP", async () => {
  found = null;
  const response = await redeem({ code: "111 222" });
  expect(response.status).toBe(404);
  expect(reserveAccessCodeAttempt).toHaveBeenCalledWith("10.0.0.7");
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("a code with missing digits is rejected before any lookup", async () => {
  const response = await redeem({ code: "482 71" });
  expect(response.status).toBe(400);
  expect(reserveAccessCodeAttempt).not.toHaveBeenCalled();
  expect(findAccessCode).not.toHaveBeenCalled();
});

test("too many wrong codes from one IP are refused", async () => {
  limited = true;
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(429);
  expect(findAccessCode).not.toHaveBeenCalled();
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("an already redeemed code is not reused", async () => {
  found = { ...code, redeemedAt: new Date() };
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
  expect(redeemAccessCode).not.toHaveBeenCalled();
});

test("an owner of the course keeps the code and gets a login email", async () => {
  owned = true;
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect(redeemAccessCode).not.toHaveBeenCalled();
  expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
});

test("a concurrent ownership conflict keeps the attempt and returns already owned", async () => {
  redeemAccessCode.mockRejectedValueOnce(new Error("course_already_owned"));
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect((await response.json()).alreadyOwned).toBe(true);
  expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
});

test("a concurrent redemption does not release the failed attempt", async () => {
  redeemAccessCode.mockResolvedValueOnce(null);
  const response = await redeem({ code: "482 719" });
  expect(response.status).toBe(409);
  expect((await response.json()).used).toBe(true);
  expect(releaseAccessCodeAttempt).not.toHaveBeenCalled();
  expect(notifyWorkshopBooked).not.toHaveBeenCalled();
});

test("a guest must agree to personal data processing", async () => {
  const response = await redeem({
    code: "482 719",
    personalDataConsent: false,
  });
  expect(response.status).toBe(400);
  expect(redeemAccessCode).not.toHaveBeenCalled();
});
