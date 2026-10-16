import { safe } from "@orpc/client";
import { AttemptLostError } from "@stariva/web-api/contract";
import { schedules } from "@trigger.dev/sdk";
import { probe, segmentAndUpload, withTempDir } from "../lib/hls";
import { webApi } from "../lib/web-api";

// Больше за один прогон не берём: следующий прогон через 10 минут доберёт
const MAX_VIDEOS_PER_RUN = 5;
// Как часто задача сообщает сайту, что жива (аренда на сайте — 20 минут)
const HEARTBEAT_MS = 5 * 60_000;

/**
 * Нарезка видео уроков в HLS — каждые 10 минут, в облаке Trigger.dev.
 *
 * Сайт держит очередь (таблица video_renditions) и выдаёт ссылки: на
 * исходник в бакете и на загрузку кусков. Задача только запускает ffmpeg,
 * доступа к базе и ключей от бакета у неё нет. Пока видео не нарезано,
 * плеер показывает исходный MP4, после — куски через сайт.
 *
 * Одновременно идёт один прогон (queue.concurrencyLimit): ffmpeg нагружает
 * процессор, а прогоны по расписанию, пока старый режет длинное видео,
 * встают в очередь и, когда доходят, сразу видят пустую очередь сайта.
 *
 * Куски заливаются по ходу нарезки (segmentAndUpload), поэтому машине не
 * нужны ни память, ни диск под всё видео. Пока идёт работа, задача раз в
 * 5 минут продлевает аренду; если машину убьют, видео вернётся в очередь
 * через 20 минут. Повторы ведёт сайт, поэтому ретраев Trigger.dev нет.
 */
export const lessonVideoHls = schedules.task({
  id: "lesson-video-hls",
  cron: "*/10 * * * *",
  machine: "medium-1x",
  maxDuration: 6 * 60 * 60,
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 1 },
  run: async (_payload, { signal }) => {
    const ready: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < MAX_VIDEOS_PER_RUN; i++) {
      if (signal.aborted) break;
      const { job } = await webApi.jobs.videos.claim();
      if (!job) break;

      const attempt = { videoKey: job.videoKey, attemptId: job.attemptId };
      console.log(
        `[lesson-video-hls] ${job.videoKey}: попытка ${job.attemptId}`,
      );
      // Останавливаем ffmpeg, если Trigger.dev отменил запуск или сайт отдал
      // видео другой попытке (наша аренда истекла)
      const abort = new AbortController();
      const onCancel = () => abort.abort(new Error("task cancelled"));
      signal.addEventListener("abort", onCancel);
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
            { signal: abort.signal },
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
        signal.removeEventListener("abort", onCancel);
      }
    }

    return { ready, failed };
  },
});
