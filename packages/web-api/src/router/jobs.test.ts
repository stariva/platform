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

const { safe } = await import("@orpc/client");
const { AttemptLostError, RemindersFailedError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

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
