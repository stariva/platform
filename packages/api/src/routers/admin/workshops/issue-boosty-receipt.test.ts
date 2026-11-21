import { beforeEach, expect, mock, test } from "bun:test";
import { orders } from "@stariva/db/schema";

const issueOnStorefront = mock(async (_orderId: string) => true);
mock.module("../../../storefront", () => ({
  issueBoostyReceipt: issueOnStorefront,
}));

process.env.POSTGRES_URL ??= "postgres://postgres@localhost/boosty_test";
const { issueBoostyReceipt } = await import("./issue-boosty-receipt");
delete process.env.POSTGRES_URL;

const handler = issueBoostyReceipt["~orpc"].handler;

beforeEach(() => issueOnStorefront.mockClear());

const orderId = "b7c1b2a0-0000-4000-8000-000000000001";

function request(status: string, paymentId: string | null) {
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === orders ? [{ status, paymentId }] : []),
      }),
    }),
  };
  return handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { id: orderId },
    path: [],
    procedure: issueBoostyReceipt,
    errors: {},
    lastEventId: undefined,
  });
}

test("a paid Boosty order asks the storefront to issue the receipt", async () => {
  const result = await request("paid", "boosty:elka");
  expect(result).toEqual({ issued: true });
  expect(issueOnStorefront).toHaveBeenCalledTimes(1);
  expect(issueOnStorefront).toHaveBeenCalledWith(orderId);
});

test("a non-Boosty order is rejected", async () => {
  await expect(request("paid", "yookassa:1")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(issueOnStorefront).not.toHaveBeenCalled();
});

test("an unpaid Boosty order is not issued a receipt", async () => {
  await expect(request("pending", "boosty:elka")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(issueOnStorefront).not.toHaveBeenCalled();
});
