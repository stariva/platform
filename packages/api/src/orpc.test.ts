import { afterEach, beforeEach, expect, test } from "bun:test";
import { call } from "@orpc/server";

// Importing orpc creates a pool; these tests never touch the database.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/orpc_test";
const { adminProcedure, isAdminEmail, isAdminUser } = await import("./orpc");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

const originalAdmins = process.env.ADMIN_EMAILS;
beforeEach(() => {
  process.env.ADMIN_EMAILS = " Owner@Example.com , ops@example.com,";
});
afterEach(() => {
  if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdmins;
});

const ping = adminProcedure.handler(() => "ok");

function asUser(user: { email: string; emailVerified: boolean } | null) {
  const session = user
    ? ({ user: { id: "u1", name: "U", ...user }, session: {} } as never)
    : null;
  return call(ping, undefined, {
    context: { session, headers: new Headers(), db: {} as never },
  });
}

test("isAdminEmail matches the list case- and space-insensitively", () => {
  expect(isAdminEmail("owner@example.com")).toBe(true);
  expect(isAdminEmail(" OPS@EXAMPLE.COM ")).toBe(true);
  expect(isAdminEmail("someone@example.com")).toBe(false);
  expect(isAdminEmail("")).toBe(false);
});

test("isAdminUser requires a verified email", () => {
  expect(isAdminUser({ email: "owner@example.com", emailVerified: true })).toBe(
    true,
  );
  expect(
    isAdminUser({ email: "owner@example.com", emailVerified: false }),
  ).toBe(false);
});

test("an empty ADMIN_EMAILS grants nobody admin", () => {
  process.env.ADMIN_EMAILS = "";
  expect(isAdminUser({ email: "owner@example.com", emailVerified: true })).toBe(
    false,
  );
});

test("adminProcedure lets a verified admin through", async () => {
  expect(
    await asUser({ email: "OWNER@example.com", emailVerified: true }),
  ).toBe("ok");
});

test("adminProcedure rejects anonymous requests", async () => {
  await expect(asUser(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("adminProcedure rejects an admin email that is not verified", async () => {
  await expect(
    asUser({ email: "owner@example.com", emailVerified: false }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("adminProcedure rejects a verified non-admin", async () => {
  await expect(
    asUser({ email: "customer@example.com", emailVerified: true }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
