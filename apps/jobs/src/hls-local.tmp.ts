// Разовый локальный запуск нарезки, пока в Trigger.dev кончился лимит.
// Тот же цикл, что в trigger/lesson-video-hls.ts, без SDK Trigger.dev.
import { safe } from "@orpc/client";
import { AttemptLostError } from "@stariva/web-api/contract";
import { HLS_VERSION, probe, segmentAndUpload, withTempDir } from "./lib/hls";
import { webApi } from "./lib/web-api";

const MAX_VIDEOS = Number(process.argv[2] ?? 5);
const HEARTBEAT_MS = 5 * 60_000;
const CALL_TIMEOUT_MS = 15_000;
const CALL_ATTEMPTS = 5;

/** Запрос к сайту с повторами: разовый 502 или зависший сокет не роняют нарезку. */
async function retry<T>(
  name: string,
  call: (context: { timeout: number }) => Promise<T>,
): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await call({ timeout: CALL_TIMEOUT_MS });
    } catch (error) {
      if (error instanceof AttemptLostError || n >= CALL_ATTEMPTS) throw error;
      console.warn(
        `[local] ${name}, попытка ${n}/${CALL_ATTEMPTS}:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((r) => setTimeout(r, n * 3000));
    }
  }
}

for (let i = 0; i < MAX_VIDEOS; i++) {
  const { job } = await retry("claim", (context) =>
    webApi.jobs.videos.claim({ version: HLS_VERSION }, { context }),
  );
  if (!job) {
    console.log("[local] очередь пуста");
    break;
  }
  const attempt = { videoKey: job.videoKey, attemptId: job.attemptId };
  console.log(`[local] ${job.videoKey}: попытка ${job.attemptId}`);
  const abort = new AbortController();
  const heartbeat = setInterval(async () => {
    const [error] = await safe(webApi.jobs.videos.heartbeat(attempt));
    if (error instanceof AttemptLostError) {
      abort.abort(new Error("attempt taken over by another worker"));
    }
  }, HEARTBEAT_MS);
  try {
    await withTempDir(async (dir) => {
      const source = await probe(job.sourceUrl);
      const files = await segmentAndUpload(
        job.sourceUrl,
        source,
        dir,
        async (batch) =>
          (
            await retry("uploadUrls", (context) =>
              webApi.jobs.videos.uploadUrls(
                { ...attempt, files: batch },
                { context },
              ),
            )
          ).uploads,
        { signal: abort.signal },
      );
      await retry("complete", (context) =>
        webApi.jobs.videos.complete(
          { ...attempt, durationSeconds: source.durationSeconds },
          { context },
        ),
      );
      console.log(`[local] ${job.videoKey}: готово, ${files} файлов`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[local] ${job.videoKey}:`, message);
    await retry("fail", (context) =>
      webApi.jobs.videos.fail({ ...attempt, error: message }, { context }),
    ).catch((e: unknown) => console.error("[local] fail не ушёл:", e));
  } finally {
    clearInterval(heartbeat);
  }
}
