import { expect, mock, test } from "bun:test";
import type { OzonStockPushResult, WebClient } from "../contract";

// Окружение читается один раз на процесс: задаём секреты всех тестов
const secret = "synthetic-admin-secret-0123456789abcdef";
process.env.JOBS_SECRET = "synthetic-jobs-secret-0123456789abcdef";
process.env.REVALIDATE_SECRET = secret;

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

const { createORPCClient, safe } = await import("@orpc/client");
const { RPCLink } = await import("@orpc/client/fetch");
const { RPCHandler } = await import("@orpc/server/fetch");
const {
  createWebORPCContext,
  OzonRequestFailedError,
  WEB_RPC_PATH,
  webErrorStatusMap,
  webRouter,
} = await import("../index");

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
});
let lastStatus = 0;

// Клиент как у админки, но запросы уходят прямо в обработчик витрины
function client(authorization: string): WebClient {
  return createORPCClient(
    new RPCLink({
      origin: "https://example.test",
      url: WEB_RPC_PATH,
      headers: { authorization },
      fetch: async (url, init) => {
        const request = new Request(url, init);
        const { matched, response } = await handler.handle(request, {
          prefix: WEB_RPC_PATH,
          context: createWebORPCContext({
            headers: request.headers,
            services: {
              runWorkshopReminderSweep: async () => ({
                checked: 0,
                delivered: 0,
                failed: 0,
              }),
            },
          }),
        });
        const result = matched ? response : new Response(null, { status: 404 });
        lastStatus = result.status;
        return result;
      },
    }),
  );
}

test("rejects the jobs secret for admin procedures", async () => {
  pushed = [];
  const [error] = await safe(
    client(`Bearer ${process.env.JOBS_SECRET}`).admin.ozon.pushStock({
      slugs: ["vase"],
    }),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus).toBe(401);
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
  expect(lastStatus).toBe(400);
});

test("reports missing Ozon keys", async () => {
  configured = false;
  const [, , definedError] = await safe(
    client(`Bearer ${secret}`).admin.ozon.pushStock({ slugs: ["vase"] }),
  );
  configured = true;
  expect(definedError?.code).toBe("OZON_NOT_CONFIGURED");
  expect(lastStatus).toBe(503);
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
  expect(lastStatus).toBe(502);
});
