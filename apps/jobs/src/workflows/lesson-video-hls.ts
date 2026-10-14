import { ConcurrencyLimitStrategy } from "@hatchet-dev/typescript-sdk/v1";
import { safe } from "@orpc/client";
import { AttemptLostError } from "@stariva/web-api/contract";
import { hatchet } from "../client";
import { probe, segmentAndUpload, withTempDir } from "../lib/hls";
import { webApi } from "../lib/web-api";

// Больше за один прогон не берём: следующий прогон через 10 минут доберёт
const MAX_VIDEOS_PER_RUN = 5;
// Как часто воркер сообщает сайту, что жив (аренда на сайте — 20 минут)
const HEARTBEAT_MS = 5 * 60_000;

/**
 * Нарезка видео уроков в HLS — каждые 10 минут.
 *
 * Сайт держит очередь (таблица video_renditions) и выдаёт ссылки: на
 * исходник в бакете и на загрузку кусков. Воркер только запускает ffmpeg,
 * доступа к базе и ключей от бакета у него нет. Пока видео не нарезано,
 * плеер показывает исходный MP4, после — куски через сайт.
 *
 * Одновременно идёт один прогон: ffmpeg нагружает процессор, а новый прогон
 * по расписанию, пока старый режет длинное видео, просто пропускается.
 *
 * Куски заливаются по ходу нарезки (segmentAndUpload), так что воркеру не
 * нужно ни памяти, ни диска под всё видео. Пока идёт работа, воркер раз в
 * 5 минут продлевает аренду; если под убьют, видео вернётся в очередь через
 * 20 минут.
 */
export const lessonVideoHlsWorkflow = hatchet.workflow({
  name: "lesson-video-hls",
  on: {
    cron: "*/10 * * * *",
  },
  concurrency: {
    expression: "'lesson-video-hls'",
    maxRuns: 1,
    limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
  },
});

lessonVideoHlsWorkflow.task({
  name: "cut-pending-videos",
  // Повторы ведёт сайт: упавшее видео вернётся в очередь после паузы
  retries: 0,
  executionTimeout: "6h",
  fn: async (_input, ctx) => {
    const ready: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < MAX_VIDEOS_PER_RUN; i++) {
      if (ctx.cancelled) break;
      const { job } = await webApi.jobs.videos.claim();
      if (!job) break;

      const attempt = { videoKey: job.videoKey, attemptId: job.attemptId };
      // Останавливаем ffmpeg, если Hatchet отменил задачу или сайт отдал
      // видео другой попытке (наша аренда истекла)
      const abort = new AbortController();
      const onCancel = () => abort.abort(new Error("task cancelled"));
      ctx.abortController.signal.addEventListener("abort", onCancel);
      const heartbeat = setInterval(async () => {
        const [error] = await safe(webApi.jobs.videos.heartbeat(attempt));
        // Попытка уже не наша; сетевой сбой переждём до следующего раза
        if (error instanceof AttemptLostError) {
          abort.abort(new Error("attempt taken over by another worker"));
        }
      }, HEARTBEAT_MS);

      try {
        const files = await withTempDir(async (dir) => {
          const source = await probe(job.sourceUrl);
          const count = await segmentAndUpload(
            job.sourceUrl,
            source,
            dir,
            async (batch) => {
              const { uploads } = await webApi.jobs.videos.uploadUrls(
                { ...attempt, files: batch },
                { context: { timeout: 60_000 } },
              );
              return uploads;
            },
            abort.signal,
          );
          await webApi.jobs.videos.complete({
            ...attempt,
            durationSeconds: source.durationSeconds,
          });
          return count;
        });
        console.log(`[lesson-video-hls] ${job.videoKey}: ${files} файлов`);
        ready.push(job.videoKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[lesson-video-hls] ${job.videoKey}:`, message);
        failed.push(job.videoKey);
        await webApi.jobs.videos
          .fail({ ...attempt, error: message })
          .catch((reportError: unknown) => {
            // Не смогли сообщить — видео вернётся в очередь, когда истечёт аренда
            console.error(
              "[lesson-video-hls] не удалось сообщить об ошибке:",
              reportError,
            );
          });
      } finally {
        clearInterval(heartbeat);
        ctx.abortController.signal.removeEventListener("abort", onCancel);
      }
    }

    return { ready, failed };
  },
});
