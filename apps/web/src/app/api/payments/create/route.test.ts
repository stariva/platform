import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";

const grantAccess = mock(async () => {});
const sendLoginEmail = mock(async () => {
  throw new Error("email unavailable");
});
mock.module("@/lib/account/access", () => ({
  grantAccess,
  hasAccess: async () => false,
}));
mock.module("@/lib/auth/session", () => ({ getSession: async () => null }));
mock.module("@/lib/workshops/buyer", () => ({
  findOrCreateBuyer: async () => ({ id: "buyer", email: "buyer@example.test" }),
  sendLoginEmail,
}));
mock.module("@/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => ({ slug: "free", price: 0 }),
}));
mock.module("@/lib/workshops/notifications", () => ({
  siteUrl: () => "https://example.test",
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
