import { expect, mock, test } from "bun:test";
import type { WebClient } from "../contract";

const secret = "synthetic-jobs-secret-0123456789abcdef";
process.env.JOBS_SECRET = secret;

const storage = await import("@stariva/storage");
mock.module("@stariva/storage", () => ({
  ...storage,
  isStorageConfigured: () => true,
}));

let extended = true;
mock.module("../services/video-renditions", () => ({
  getReadyRendition: async () => null,
  claimNextVideo: async () => null,
  extendRenditionLease: async () => extended,
  completeRendition: async () => "ready",
  failRendition: async () => {},
}));

const { createORPCClient, safe } = await import("@orpc/client");
const { RPCLink } = await import("@orpc/client/fetch");
const { RPCHandler } = await import("@orpc/server/fetch");
const { createWebORPCContext, WEB_RPC_PATH, webRouter } = await import(
  "../index"
);

const handler = new RPCHandler(webRouter);

// Клиент как у воркера, но запросы уходят прямо в обработчик витрины:
// проверяем весь путь по проводу, включая коды ошибок
function client(authorization: string): WebClient {
  return createORPCClient(
    new RPCLink({
      url: `https://example.test${WEB_RPC_PATH}`,
      headers: { authorization },
      fetch: async (request) => {
        const { response } = await handler.handle(request, {
          prefix: WEB_RPC_PATH,
          context: createWebORPCContext({ headers: request.headers }),
        });
        return response ?? new Response("Not found", { status: 404 });
      },
    }),
  );
}

const attempt = { videoKey: "workshops/test/lesson.mp4", attemptId: 1 };

test("rejects a wrong jobs secret", async () => {
  const { error } = await safe(
    client("Bearer wrong").jobs.videos.heartbeat(attempt),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED", status: 401 });
});

test("heartbeat tells a stale worker its attempt is lost", async () => {
  const api = client(`Bearer ${secret}`).jobs.videos;

  extended = true;
  expect((await safe(api.heartbeat(attempt))).error).toBeNull();

  extended = false;
  const { error, isDefined } = await safe(api.heartbeat(attempt));
  expect(isDefined).toBe(true);
  expect(error).toMatchObject({ code: "ATTEMPT_LOST", status: 409 });
});

test("upload urls accept only HLS file names", async () => {
  const { error } = await safe(
    client(`Bearer ${secret}`).jobs.videos.uploadUrls({
      ...attempt,
      files: ["../index.m3u8"],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST", status: 400 });
});

test("claim returns null when nothing is queued", async () => {
  const result = await client(`Bearer ${secret}`).jobs.videos.claim(undefined);
  expect(result).toEqual({ job: null });
});
