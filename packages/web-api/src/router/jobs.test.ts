import { expect, mock, test } from "bun:test";
import type { ReminderSweepResult, WebClient } from "../contract";
import { JOBS_SECRET as secret } from "../testing/setup";

const storage = await import("@stariva/storage");
mock.module("@stariva/storage", () => ({
  ...storage,
  isStorageConfigured: () => true,
}));

let extended = true;
const claimedVersions: number[] = [];
mock.module("../services/video-renditions", () => ({
  getReadyRendition: async () => null,
  claimNextVideo: async (version: number) => {
    claimedVersions.push(version);
    return null;
  },
  getAttemptHlsPrefix: async () => "workshops/test/hls/lesson/attempt",
  extendRenditionLease: async () => extended,
  completeRendition: async () => "ready",
  failRendition: async () => {},
}));

const storageSweeps: { dryRun?: boolean }[] = [];
mock.module("../services/workshop-storage", () => ({
  sweepWorkshopStorage: async (options: { dryRun?: boolean }) => {
    storageSweeps.push(options);
    return {
      deleted: 2,
      bytes: 30,
      renditions: 1,
      deleteKeys: ["workshops/a/x.mp4", "workshops/a/y.mp4"],
    };
  },
}));

let yandexConfigured = false;
let yandexPending = false;
const metrikaCalls: unknown[][] = [];
const directCalls: unknown[][] = [];
// Остальные экспорты настоящие: мок модуля действует на весь процесс тестов
const metrika = await import("../services/yandex/metrika");
const direct = await import("../services/yandex/direct");
const { MetrikaLogsPendingError } = metrika;
const { DirectReportPendingError } = direct;
mock.module("../services/yandex/metrika", () => ({
  ...metrika,
  isMetrikaConfigured: () => yandexConfigured,
  syncMetrikaGoals: async () => ({ goals: 4 }),
  syncMetrikaLogs: async (...args: unknown[]) => {
    metrikaCalls.push(args);
    if (yandexPending) throw new MetrikaLogsPendingError(1);
    return { rows: 10, requestId: 7 };
  },
}));
mock.module("../services/yandex/direct", () => ({
  ...direct,
  isDirectConfigured: () => yandexConfigured,
  syncDirectReport: async (...args: unknown[]) => {
    directCalls.push(args);
    if (yandexPending) throw new DirectReportPendingError("pending");
    return { rows: 3, goals: 2 };
  },
}));

const { safe } = await import("@orpc/client");
const { AttemptLostError, RemindersFailedError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");
const { recentRange } = await import("../services/yandex/common");

let sweep: ReminderSweepResult = { checked: 0, delivered: 0, failed: 0 };
let sweeps = 0;
let npdSweeps = 0;
const services = {
  runNpdIssuingSweep: async () => {
    npdSweeps++;
    return { checked: 2 };
  },
  runWorkshopReminderSweep: async () => {
    sweeps++;
    return sweep;
  },
};

/** Клиент как у воркера: секрет в Authorization. */
function client(authorization: string): WebClient {
  return wireClient({ authorization, services });
}

const attempt = { videoKey: "workshops/test/lesson.mp4", attemptId: 1 };

test("rejects a wrong jobs secret", async () => {
  const [error] = await safe(
    client("Bearer wrong").jobs.videos.heartbeat(attempt),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
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
  expect(lastStatus()).toBe(409);
});

test("upload urls accept only HLS file names", async () => {
  const [error] = await safe(
    client(`Bearer ${secret}`).jobs.videos.uploadUrls({
      ...attempt,
      files: ["../index.m3u8"],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(lastStatus()).toBe(400);
});

test("claim returns null when nothing is queued", async () => {
  expect(await client(`Bearer ${secret}`).jobs.videos.claim()).toEqual({
    job: null,
  });
});

test("claim passes the worker's cut version; old workers get version 1", async () => {
  claimedVersions.length = 0;
  const api = client(`Bearer ${secret}`).jobs.videos;
  await api.claim();
  await api.claim({ version: 2 });
  expect(claimedVersions).toEqual([1, 2]);
  const [error] = await safe(api.claim({ version: 3 }));
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
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
  expect(lastStatus()).toBe(200);
});

test("reminder sweep fails so Hatchet retries undelivered messages", async () => {
  sweep = { checked: 3, delivered: 1, failed: 2 };
  const [error, , definedError] = await safe(
    client(`Bearer ${secret}`).jobs.reminders.sweep(),
  );
  expect(error).toBeInstanceOf(RemindersFailedError);
  expect(definedError?.code).toBe("REMINDERS_FAILED");
  expect(definedError?.data).toEqual(sweep);
  expect(lastStatus()).toBe(500);
});

test("NPD sweep requires the jobs secret and calls only its own service", async () => {
  npdSweeps = 0;
  const [error] = await safe(client("Bearer wrong").jobs.npd.sweep());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(npdSweeps).toBe(0);
  const before = sweeps;
  expect(await client(`Bearer ${secret}`).jobs.npd.sweep()).toEqual({
    checked: 2,
  });
  expect(npdSweeps).toBe(1);
  expect(sweeps).toBe(before);
  expect(lastStatus()).toBe(200);
});

test("storage sweep requires the jobs secret and hides deleted keys", async () => {
  storageSweeps.length = 0;
  const [error] = await safe(client("Bearer wrong").jobs.storage.sweep());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(storageSweeps).toHaveLength(0);

  const api = client(`Bearer ${secret}`).jobs.storage;
  expect(await api.sweep()).toEqual({ deleted: 2, bytes: 30, renditions: 1 });
  await api.sweep({ dryRun: true });
  expect(storageSweeps).toEqual([{ dryRun: false }, { dryRun: true }]);
});

test("analytics jobs report a missing Yandex token", async () => {
  yandexConfigured = false;
  const api = client(`Bearer ${secret}`).jobs.analytics;
  for (const call of [
    () => api.metrikaGoals(),
    () => api.metrikaLogs({ source: "visits" }),
    () => api.directReport({ report: "stats" }),
  ]) {
    const [, , definedError] = await safe(call());
    expect(definedError?.code).toBe("ANALYTICS_NOT_CONFIGURED");
  }
});

test("analytics jobs default to recent days and pass explicit ranges", async () => {
  yandexConfigured = true;
  yandexPending = false;
  metrikaCalls.length = 0;
  directCalls.length = 0;
  const api = client(`Bearer ${secret}`).jobs.analytics;

  expect(await api.metrikaGoals()).toEqual({ goals: 4 });
  expect(await api.metrikaLogs({ source: "hits" })).toEqual({
    rows: 10,
    requestId: 7,
  });
  await api.metrikaLogs({
    source: "visits",
    from: "2026-10-01",
    to: "2026-10-10",
  });
  await api.directReport({ report: "search_queries" });
  expect(metrikaCalls).toEqual([
    ["hits", recentRange(7)],
    ["visits", { from: "2026-10-01", to: "2026-10-10" }],
  ]);
  expect(directCalls).toEqual([["search_queries", recentRange(14)]]);

  const [error] = await safe(
    api.directReport({ report: "stats", from: "2026-10-10", to: "2026-10-01" }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
});

test("analytics jobs ask Hatchet to retry while Yandex prepares data", async () => {
  yandexConfigured = true;
  yandexPending = true;
  const api = client(`Bearer ${secret}`).jobs.analytics;
  const [, , metrika] = await safe(api.metrikaLogs({ source: "visits" }));
  expect(metrika?.code).toBe("ANALYTICS_PENDING");
  const [, , direct] = await safe(api.directReport({ report: "stats" }));
  expect(direct?.code).toBe("ANALYTICS_PENDING");
  yandexPending = false;
});
