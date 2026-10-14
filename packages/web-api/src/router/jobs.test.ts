import { expect, mock, test } from "bun:test";
import type { ReminderSweepResult, WebClient } from "../contract";

// Окружение читается один раз на процесс: задаём секреты всех тестов
const secret = "synthetic-jobs-secret-0123456789abcdef";
process.env.JOBS_SECRET = secret;
process.env.REVALIDATE_SECRET = "synthetic-admin-secret-0123456789abcdef";

const storage = await import("@stariva/storage");
mock.module("@stariva/storage", () => ({
  ...storage,
  isStorageConfigured: () => true,
}));

let extended = true;
mock.module("../services/video-renditions", () => ({
  getReadyRendition: async () => null,
  claimNextVideo: async () => null,
  getAttemptHlsPrefix: async () => "workshops/test/hls/lesson/attempt",
  extendRenditionLease: async () => extended,
  completeRendition: async () => "ready",
  failRendition: async () => {},
}));

const { createORPCClient, safe } = await import("@orpc/client");
const { RPCLink } = await import("@orpc/client/fetch");
const { RPCHandler } = await import("@orpc/server/fetch");
const {
  AttemptLostError,
  RemindersFailedError,
  createWebORPCContext,
  WEB_RPC_PATH,
  webErrorStatusMap,
  webRouter,
} = await import("../index");

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
});
let lastStatus = 0;
let sweep: ReminderSweepResult = { checked: 0, delivered: 0, failed: 0 };
let sweeps = 0;
const services = {
  runWorkshopReminderSweep: async () => {
    sweeps++;
    return sweep;
  },
};

// Клиент как у воркера, но запросы уходят прямо в обработчик витрины:
// проверяем весь путь по проводу, включая коды ошибок и HTTP-статусы
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
            services,
          }),
        });
        const result = matched ? response : new Response(null, { status: 404 });
        lastStatus = result.status;
        return result;
      },
    }),
  );
}

const attempt = { videoKey: "workshops/test/lesson.mp4", attemptId: 1 };

test("rejects a wrong jobs secret", async () => {
  const [error] = await safe(
    client("Bearer wrong").jobs.videos.heartbeat(attempt),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus).toBe(401);
});

test("heartbeat tells a stale worker its attempt is lost", async () => {
  const api = client(`Bearer ${secret}`).jobs.videos;

  extended = true;
  const [ok] = await safe(api.heartbeat(attempt));
  expect(ok).toBeNull();

  extended = false;
  const [error, , definedError] = await safe(api.heartbeat(attempt));
  expect(error).toBeInstanceOf(AttemptLostError);
  expect(definedError?.code).toBe("ATTEMPT_LOST");
  expect(lastStatus).toBe(409);
});

test("upload urls accept only HLS file names", async () => {
  const [error] = await safe(
    client(`Bearer ${secret}`).jobs.videos.uploadUrls({
      ...attempt,
      files: ["../index.m3u8"],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(lastStatus).toBe(400);
});

test("claim returns null when nothing is queued", async () => {
  expect(await client(`Bearer ${secret}`).jobs.videos.claim()).toEqual({
    job: null,
  });
});

test("reminder sweep requires the jobs secret", async () => {
  sweeps = 0;
  const [error] = await safe(client("Bearer wrong").jobs.reminders.sweep());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(sweeps).toBe(0);
});

test("reminder sweep returns the summary", async () => {
  sweep = { checked: 3, delivered: 2, failed: 0 };
  expect(await client(`Bearer ${secret}`).jobs.reminders.sweep()).toEqual(
    sweep,
  );
  expect(lastStatus).toBe(200);
});

test("reminder sweep fails so Hatchet retries undelivered messages", async () => {
  sweep = { checked: 3, delivered: 1, failed: 2 };
  const [error, , definedError] = await safe(
    client(`Bearer ${secret}`).jobs.reminders.sweep(),
  );
  expect(error).toBeInstanceOf(RemindersFailedError);
  expect(definedError?.code).toBe("REMINDERS_FAILED");
  expect(definedError?.data).toEqual(sweep);
  expect(lastStatus).toBe(500);
});
