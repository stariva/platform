import { expect, mock, test } from "bun:test";
import type { OzonStockPushResult, WebClient } from "../contract";
import { JOBS_SECRET, ADMIN_SECRET as secret } from "../testing/setup";

let configured = true;
let pushed: string[][] = [];
let push = async (slugs: string[]): Promise<OzonStockPushResult> => ({
  updated: ["offer-1"],
  syncedSlugs: slugs,
  failed: [],
  hidden: [123],
});
mock.module("../services/ozon-stock", () => ({
  isOzonSellerConfigured: () => configured,
  pushStockToOzon: async (slugs: string[]) => {
    pushed.push(slugs);
    return push(slugs);
  },
}));

const { safe } = await import("@orpc/client");
const { OzonRequestFailedError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

/** Клиент как у админки: секрет в Authorization. */
function client(authorization: string): WebClient {
  return wireClient({ authorization });
}

test("rejects the jobs secret for admin procedures", async () => {
  pushed = [];
  const [error] = await safe(
    client(`Bearer ${JOBS_SECRET}`).admin.ozon.pushStock({
      slugs: ["vase"],
    }),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
  expect(pushed).toEqual([]);
});

test("pushes stock for the given slugs", async () => {
  pushed = [];
  const result = await client(`Bearer ${secret}`).admin.ozon.pushStock({
    slugs: ["vase"],
  });
  expect(result.syncedSlugs).toEqual(["vase"]);
  expect(pushed).toEqual([["vase"]]);
});

test("refuses an empty slug list", async () => {
  const [error] = await safe(
    client(`Bearer ${secret}`).admin.ozon.pushStock({ slugs: [] }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(lastStatus()).toBe(400);
});

test("reports missing Ozon keys", async () => {
  configured = false;
  const [, , definedError] = await safe(
    client(`Bearer ${secret}`).admin.ozon.pushStock({ slugs: ["vase"] }),
  );
  configured = true;
  expect(definedError?.code).toBe("OZON_NOT_CONFIGURED");
  expect(lastStatus()).toBe(503);
});

test("hides Ozon failure details behind a typed error", async () => {
  push = async () => {
    throw new Error("ozon_seller_request_failed_500: secret detail");
  };
  const [error] = await safe(
    client(`Bearer ${secret}`).admin.ozon.pushStock({ slugs: ["vase"] }),
  );
  expect(error).toBeInstanceOf(OzonRequestFailedError);
  expect(String(error)).not.toContain("secret detail");
  expect(lastStatus()).toBe(502);
});
