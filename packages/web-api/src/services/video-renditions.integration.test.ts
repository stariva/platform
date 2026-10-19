import { expect, mock, test } from "bun:test";

// Use a migrated disposable database with an empty workshops table (remove seeds).
// Run this file on its own: it points POSTGRES_URL at that database at run
// time, and in a full run other files load @stariva/db before that happens.
// `bun run test:integration` (scripts/test-integration.ts) does all of this.
test.skipIf(!process.env.RENDITION_TEST_DATABASE_URL)(
  "rendition attempts fence stale workers and isolate their uploads",
  async () => {
    const url = new URL(process.env.RENDITION_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_rendition_test");
    process.env.POSTGRES_URL = url.href;
    const storage = await import("@stariva/storage");
    let playlistExists = async (_key: string) => true;
    const uploadKeys: string[] = [];
    mock.module("@stariva/storage", () => ({
      ...storage,
      isStorageConfigured: () => true,
      objectExists: (key: string) => playlistExists(key),
      createUploadUrl: async (key: string) => {
        uploadKeys.push(key);
        return `https://storage.example.test/${key}`;
      },
    }));
    const { JOBS_SECRET: secret } = await import("../testing/setup");
    const { db, eq, sql } = await import("@stariva/db");
    const { videoRenditions, workshops } = await import("@stariva/db/schema");
    expect(await db.select({ id: workshops.id }).from(workshops)).toHaveLength(
      0,
    );
    const {
      claimNextVideo,
      completeRendition,
      extendRenditionLease,
      failRendition,
      getReadyRendition,
      PROCESSING_LEASE_MS,
      WORKER_LOST_ERROR,
    } = await import("./video-renditions");
    const { createRouterClient, ORPCError } = await import("@orpc/server");
    const { webRouter } = await import("../router");
    const { webErrorStatus } = await import("../errors");
    const api = createRouterClient(webRouter, {
      context: {
        headers: new Headers({ authorization: `Bearer ${secret}` }),
      },
    }).jobs.videos;
    // Процедура → HTTP-статус, который отдал бы обработчик витрины
    const handle =
      (procedure: (input: never) => Promise<unknown>) =>
      async (input: object) => ({
        status: await procedure(input as never).then(
          () => 200,
          (error: unknown) => {
            if (error instanceof ORPCError) return webErrorStatus(error.code);
            throw error;
          },
        ),
      });
    const heartbeat = handle(api.heartbeat);
    const uploadUrls = handle(api.uploadUrls);
    const complete = handle(api.complete);
    const fail = handle(api.fail);
    const id = crypto.randomUUID();
    const videoKey = `workshops/${id}/lesson.mp4`;
    const read = async () =>
      db
        .select()
        .from(videoRenditions)
        .where(eq(videoRenditions.videoKey, videoKey));
    const expire = async () =>
      db
        .update(videoRenditions)
        .set({ leaseUntil: sql`now() - interval '1 second'` })
        .where(eq(videoRenditions.videoKey, videoKey));
    const request = (body: object) => ({ videoKey, ...body });

    await db.insert(workshops).values({
      id,
      slug: id,
      title: "Synthetic workshop",
      category: "interior",
      lessons: [
        {
          id: "lesson",
          title: "Lesson",
          videoKey,
          durationSeconds: 60,
          free: false,
        },
      ],
    });
    try {
      const claims = await Promise.all([claimNextVideo(), claimNextVideo()]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const first = claims.find((claim) => claim !== null);
      if (!first) throw new Error("Expected first claim");
      expect(first.attemptId).toBe(1);

      for (const handler of [uploadUrls, complete, fail]) {
        expect(
          (
            await handler(
              request({
                files: ["index.m3u8"],
                durationSeconds: 60,
                error: "failed",
              }),
            )
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await uploadUrls(
            request({ attemptId: first.attemptId, files: ["seg-00001.m4s"] }),
          )
        ).status,
      ).toBe(200);
      expect(uploadKeys.at(-1)).toBe(`${first.hlsPrefix}/seg-00001.m4s`);

      // A live worker keeps its short lease; nobody can reclaim the video meanwhile.
      await expire();
      expect(
        (await heartbeat(request({ attemptId: first.attemptId }))).status,
      ).toBe(200);
      const [extended] = await read();
      expect(extended?.leaseUntil?.getTime()).toBeGreaterThan(
        Date.now() + PROCESSING_LEASE_MS - 60_000,
      );
      expect(await claimNextVideo()).toBeNull();

      await expire();
      const second = await claimNextVideo();
      if (!second) throw new Error("Expected second claim");
      expect(second.attemptId).toBe(2);
      expect(second.hlsPrefix).not.toBe(first.hlsPrefix);
      // The stale worker learns it lost the video and stops.
      expect(
        (await heartbeat(request({ attemptId: first.attemptId }))).status,
      ).toBe(409);
      expect(
        await extendRenditionLease({ videoKey, attemptId: second.attemptId }),
      ).toBe(true);
      const before = await read();
      expect(
        (
          await uploadUrls(
            request({ attemptId: first.attemptId, files: ["index.m3u8"] }),
          )
        ).status,
      ).toBe(409);
      expect(
        await completeRendition({ videoKey, attemptId: first.attemptId }, 999),
      ).toBe("not_found");
      await failRendition(
        { videoKey, attemptId: first.attemptId },
        "stale failure",
      );
      expect(await read()).toEqual(before);

      expect(
        (
          await uploadUrls(
            request({ attemptId: second.attemptId, files: ["index.m3u8"] }),
          )
        ).status,
      ).toBe(200);
      expect(uploadKeys.at(-1)).toBe(`${second.hlsPrefix}/index.m3u8`);
      playlistExists = async () => false;
      expect(
        await completeRendition({ videoKey, attemptId: second.attemptId }, 60),
      ).toBe("missing_playlist");
      expect(await read()).toEqual(before);

      // The lease expires while S3 is being checked: fence the subsequent UPDATE too.
      let third: typeof second | null = null;
      playlistExists = async (key) => {
        expect(key).toBe(`${second.hlsPrefix}/index.m3u8`);
        await expire();
        third = await claimNextVideo();
        return true;
      };
      expect(
        await completeRendition({ videoKey, attemptId: second.attemptId }, 999),
      ).toBe("not_found");
      const [current] = await read();
      expect(current?.attempts).toBe(3);
      expect(current?.status).toBe("processing");
      expect(current?.hlsPrefix).not.toBe(second.hlsPrefix);
      if (!third) throw new Error("Expected third claim");
      playlistExists = async () => true;
      expect(await completeRendition({ videoKey, attemptId: 3 }, 60.4)).toBe(
        "ready",
      );
      const ready = await read();
      expect(ready[0]?.durationSeconds).toBe(60);
      await failRendition({ videoKey, attemptId: 3 }, "late failure");
      expect(await read()).toEqual(ready);

      // Current failures back off, and exhausted attempts cannot be reclaimed.
      await db
        .update(videoRenditions)
        .set({ status: "processing" })
        .where(eq(videoRenditions.videoKey, videoKey));
      await failRendition({ videoKey, attemptId: 3 }, "current failure");
      const [failed] = await read();
      expect(failed?.status).toBe("failed");
      expect(failed?.error).toBe("current failure");
      expect(failed?.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
      await expire();
      expect(await claimNextVideo()).toBeNull();

      // The worker vanished on the last attempt: the video must not stay
      // "processing" forever with an empty reason.
      await db
        .update(videoRenditions)
        .set({ status: "processing", error: null })
        .where(eq(videoRenditions.videoKey, videoKey));
      await expire();
      expect(await claimNextVideo()).toBeNull();
      const [abandoned] = await read();
      expect(abandoned?.status).toBe("failed");
      expect(abandoned?.error).toBe(WORKER_LOST_ERROR);
      expect(abandoned?.attempts).toBe(3);

      // A single-quality cut finished by a worker that predates versions:
      // viewers keep it while a version-2 worker re-cuts the video.
      const oldPrefix = `${videoKey}-old`;
      await db
        .update(videoRenditions)
        .set({
          status: "ready",
          hlsPrefix: oldPrefix,
          version: 1,
          readyHlsPrefix: null,
          readyVersion: null,
          leaseUntil: null,
        })
        .where(eq(videoRenditions.videoKey, videoKey));
      const oldCut = { hlsPrefix: oldPrefix, playlist: "index.m3u8" };
      expect(await getReadyRendition(videoKey)).toEqual(oldCut);
      expect(await claimNextVideo()).toBeNull();
      const upgrade = await claimNextVideo(2);
      if (!upgrade) throw new Error("Expected upgrade claim");
      expect(upgrade.attemptId).toBe(1);
      expect(upgrade.hlsPrefix).not.toBe(oldPrefix);
      const [upgrading] = await read();
      expect(upgrading?.status).toBe("processing");
      expect(upgrading?.version).toBe(2);
      expect(upgrading?.readyHlsPrefix).toBe(oldPrefix);
      expect(upgrading?.readyVersion).toBe(1);
      expect(await getReadyRendition(videoKey)).toEqual(oldCut);
      expect(await claimNextVideo(2)).toBeNull();

      playlistExists = async (key) =>
        key === `${upgrade.hlsPrefix}/master.m3u8`;
      expect(
        await completeRendition({ videoKey, attemptId: upgrade.attemptId }, 60),
      ).toBe("ready");
      expect(await getReadyRendition(videoKey)).toEqual({
        hlsPrefix: upgrade.hlsPrefix,
        playlist: "master.m3u8",
      });
      expect(await claimNextVideo(2)).toBeNull();
    } finally {
      await db
        .delete(videoRenditions)
        .where(eq(videoRenditions.videoKey, videoKey));
      await db.delete(workshops).where(eq(workshops.id, id));
    }
  },
);
