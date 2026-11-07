import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";

const grantAccess = mock(async () => {});
const sendLoginEmail = mock(async () => {
  throw new Error("email unavailable");
});
let owned = false;
let price = 0;
mock.module("@/lib/account/access", () => ({ grantAccess }));
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
  getWorkshopBySlug: async () => ({ slug: "free", price }),
}));
// Модульные моки bun общие для всех файлов: перечисляем и то, что ждёт
// маршрут активации кода (redeem/route.test.ts)
mock.module("@/lib/workshops/notifications", () => ({
  siteUrl: () => "https://example.test",
  notifyWorkshopBooked: async () => {},
}));
const { POST } = await import("./route");
afterEach(() => mock.restore());

test("free access survives a login email failure", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(
    new NextRequest("https://example.test/api/payments/create", {
      method: "POST",
      body: JSON.stringify({
        slug: "free",
        email: "buyer@example.test",
        personalDataConsent: true,
      }),
    }),
  );
  expect(grantAccess).toHaveBeenCalledWith("buyer", "free");
  expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ free: true, emailSent: true });
});

async function ownedGuestMessage(workshopPrice: number) {
  owned = true;
  price = workshopPrice;
  spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await POST(
      new NextRequest("https://example.test/api/payments/create", {
        method: "POST",
        body: JSON.stringify({
          slug: "free",
          email: "buyer@example.test",
          personalDataConsent: true,
        }),
      }),
    );
    expect(response.status).toBe(409);
    return (await response.json()).error as string;
  } finally {
    owned = false;
    price = 0;
  }
}

test("does not call an owned free workshop purchased", async () => {
  const message = await ownedGuestMessage(0);
  expect(message).toStartWith("Мастер-класс уже открыт для buyer@example.test");
  expect(message).not.toContain("куплен");
});

test("calls an owned paid workshop purchased", async () => {
  expect(await ownedGuestMessage(990)).toContain("уже куплен");
});
