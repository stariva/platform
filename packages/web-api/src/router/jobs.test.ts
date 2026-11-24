import { expect, mock, test } from "bun:test";
import type {
  OzonStockPullResult,
  ReminderSweepResult,
  WebClient,
} from "../contract";
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

const mirrorBatches: { maxFiles?: number; maxBytes?: number }[] = [];
let mirrorConfigured = true;
mock.module("../services/storage-mirror", () => ({
  claimMirrorSyncBatch: async (options: {
    maxFiles?: number;
    maxBytes?: number;
  }) => {
    mirrorBatches.push(options);
    return {
      configured: mirrorConfigured,
      files: mirrorConfigured
        ? [
            {
              key: "workshops/a/x.mp4",
              size: 30,
              contentType: "video/mp4",
              getUrl: "https://source.example.test/workshops/a/x.mp4",
              putUrl: "https://mirror.example.test/workshops/a/x.mp4",
            },
          ]
        : [],
      remainingFiles: mirrorConfigured ? 2 : 0,
      remainingBytes: mirrorConfigured ? 45 : 0,
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

let ozonConfigured = true;
let ozonPull = async (): Promise<OzonStockPullResult> => ({
  configured: true,
  checked: 1,
  lowered: [{ slug: "nabor", category: "interior", from: 5, to: 3 }],
});
mock.module("../services/ozon-stock", () => ({
  isOzonSellerConfigured: () => ozonConfigured,
  pullStockFromOzon: () => ozonPull(),
  pushStockToOzon: async () => {
    throw new Error("not used in jobs");
  },
}));

const { safe } = await import("@orpc/client");
const { AttemptLostError, RemindersFailedError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");
const { recentRange } = await import("../services/yandex/common");

let sweep: ReminderSweepResult = { checked: 0, delivered: 0, failed: 0 };
let sweeps = 0;
let npdSweeps = 0;
let emailSyncs = 0;
let madeToOrderSweeps = 0;
let madeToOrderSweep = { checked: 0, repriced: 0, shipped: 0, failed: 0 };
let sweepOptions: { orders?: boolean } | null = null;
const services = {
  runNpdIssuingSweep: async () => {
    npdSweeps++;
    return { checked: 2 };
  },
  sweepMadeToOrderDeliveries: async (options?: { orders?: boolean }) => {
    madeToOrderSweeps++;
    sweepOptions = options ?? null;
    return madeToOrderSweep;
  },
  syncEmailEvents: async () => {
    emailSyncs++;
    return {
      configured: true,
      read: 3,
      stored: 2,
      rejected: 0,
      suppressed: 1,
      updated: 2,
    };
  },
  runWorkshopReminderSweep: async () => {
    sweeps++;
    return sweep;
  },
  runWorkshopStorageSweep: async (options?: { dryRun?: boolean }) => {
    storageSweeps.push(options ?? {});
    return { deleted: 2, bytes: 30, renditions: 1 };
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

test("made-to-order sweep requires the jobs secret and returns its counts", async () => {
  madeToOrderSweeps = 0;
  const [error] = await safe(client("Bearer wrong").jobs.madeToOrder.sweep());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(madeToOrderSweeps).toBe(0);

  madeToOrderSweep = { checked: 3, repriced: 2, shipped: 1, failed: 0 };
  expect(await client(`Bearer ${secret}`).jobs.madeToOrder.sweep()).toEqual(
    madeToOrderSweep,
  );
  expect(madeToOrderSweeps).toBe(1);
  expect(lastStatus()).toBe(200);
});

test("the cron asks for the pulse only, the button gets the full sweep", async () => {
  madeToOrderSweeps = 0;
  const api = client(`Bearer ${secret}`).jobs.madeToOrder;

  await api.sweep();
  expect(sweepOptions).toEqual({ orders: true });

  await api.sweep({ orders: false });
  expect(sweepOptions).toEqual({ orders: false });
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

test("email events sync requires the jobs secret and returns its counts", async () => {
  emailSyncs = 0;
  const [error] = await safe(client("Bearer wrong").jobs.emails.syncEvents());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(emailSyncs).toBe(0);
  expect(await client(`Bearer ${secret}`).jobs.emails.syncEvents()).toEqual({
    configured: true,
    read: 3,
    stored: 2,
    rejected: 0,
    suppressed: 1,
    updated: 2,
  });
  expect(emailSyncs).toBe(1);
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

test("mirror sync requires the jobs secret and hands out signed links", async () => {
  mirrorBatches.length = 0;
  const [error] = await safe(client("Bearer wrong").jobs.storage.mirrorSync());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(mirrorBatches).toHaveLength(0);

  mirrorConfigured = true;
  const api = client(`Bearer ${secret}`).jobs.storage;
  expect(await api.mirrorSync()).toEqual({
    configured: true,
    files: [
      {
        key: "workshops/a/x.mp4",
        size: 30,
        contentType: "video/mp4",
        getUrl: "https://source.example.test/workshops/a/x.mp4",
        putUrl: "https://mirror.example.test/workshops/a/x.mp4",
      },
    ],
    remainingFiles: 2,
    remainingBytes: 45,
  });
  await api.mirrorSync({ maxFiles: 5, maxBytes: 1024 });
  expect(mirrorBatches).toEqual([{}, { maxFiles: 5, maxBytes: 1024 }]);
  expect(lastStatus()).toBe(200);
});

test("mirror sync is a quiet no-op when the mirror is not configured", async () => {
  mirrorConfigured = false;
  const result = await client(`Bearer ${secret}`).jobs.storage.mirrorSync();
  mirrorConfigured = true;
  expect(result).toEqual({
    configured: false,
    files: [],
    remainingFiles: 0,
    remainingBytes: 0,
  });
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

test("ozon stock sync lowers stock and refreshes the product pages", async () => {
  const revalidatePaths = mock((_paths: string[]) => {});
  const api = wireClient({
    authorization: `Bearer ${secret}`,
    services: { ...services, revalidatePaths },
  }).jobs.ozon;

  const result = await api.syncStock();
  expect(result.lowered).toEqual([
    { slug: "nabor", category: "interior", from: 5, to: 3 },
  ]);
  expect(revalidatePaths).toHaveBeenCalledWith(["/catalog/interior/nabor"]);

  // Nothing sold on Ozon: no pages to refresh
  revalidatePaths.mockClear();
  ozonPull = async () => ({ configured: true, checked: 1, lowered: [] });
  await api.syncStock();
  expect(revalidatePaths).not.toHaveBeenCalled();
});

test("ozon stock sync is a quiet no-op without Seller API keys", async () => {
  ozonConfigured = false;
  const result = await client(`Bearer ${secret}`).jobs.ozon.syncStock();
  ozonConfigured = true;
  expect(result).toEqual({ configured: false, checked: 0, lowered: [] });
});

test("ozon stock sync hides Ozon failure details", async () => {
  ozonPull = async () => {
    throw new Error("ozon_seller_request_failed_500: secret detail");
  };
  const [error, , definedError] = await safe(
    client(`Bearer ${secret}`).jobs.ozon.syncStock(),
  );
  expect(definedError?.code).toBe("OZON_REQUEST_FAILED");
  expect(String(error)).not.toContain("secret detail");
  expect(lastStatus()).toBe(502);
});
