import { ConcurrencyLimitStrategy } from "@hatchet-dev/typescript-sdk/v1";
import { hatchet } from "../client";
import { probe, segment, uploadDir, withTempDir } from "../lib/hls";
import { postToStorefront } from "../lib/storefront";

interface ClaimResponse {
  job: {
    videoKey: string;
    hlsPrefix: string;
    attemptId: number;
    sourceUrl: string;
  } | null;
}

interface UploadUrlsResponse {
  uploads: Record<string, { url: string; contentType: string }>;
}

// Больше за один прогон не берём: следующий прогон через 10 минут доберёт
const MAX_VIDEOS_PER_RUN = 5;

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
 */
export const lessonVideoHlsWorkflow = hatchet.workflow({
  name: "lesson-video-hls",
  on: {
    cron: "*/10 * * * *",
  },
  concurrency: {
    expression: "'lesson-video-hls'",
    maxRuns: 1,
    limitStrategy: ConcurrencyLimitStrategy.DROP_NEWEST,
  },
});

lessonVideoHlsWorkflow.task({
  name: "cut-pending-videos",
  // Повторы ведёт сайт: упавшее видео вернётся в очередь после паузы
  retries: 0,
  executionTimeout: "6h",
  fn: async () => {
    const ready: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < MAX_VIDEOS_PER_RUN; i++) {
      const { job } = await postToStorefront<ClaimResponse>(
        "/api/workshops/videos/claim",
        { timeoutMs: 30_000, body: {} },
      );
      if (!job) break;

      try {
        const files = await withTempDir(async (dir) => {
          const source = await probe(job.sourceUrl);
          await segment(job.sourceUrl, source, dir);
          const count = await uploadDir(dir, async (batch) => {
            const { uploads } = await postToStorefront<UploadUrlsResponse>(
              "/api/workshops/videos/upload-urls",
              {
                timeoutMs: 60_000,
                body: {
                  videoKey: job.videoKey,
                  attemptId: job.attemptId,
                  files: batch,
                },
              },
            );
            return uploads;
          });
          await postToStorefront("/api/workshops/videos/complete", {
            timeoutMs: 30_000,
            body: {
              videoKey: job.videoKey,
              attemptId: job.attemptId,
              durationSeconds: source.durationSeconds,
            },
          });
          return count;
        });
        console.log(`[lesson-video-hls] ${job.videoKey}: ${files} файлов`);
        ready.push(job.videoKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[lesson-video-hls] ${job.videoKey}:`, message);
        failed.push(job.videoKey);
        await postToStorefront("/api/workshops/videos/fail", {
          timeoutMs: 30_000,
          body: {
            videoKey: job.videoKey,
            attemptId: job.attemptId,
            error: message,
          },
        }).catch((reportError: unknown) => {
          // Не смогли сообщить — видео вернётся в очередь, когда истечёт аренда
          console.error(
            "[lesson-video-hls] не удалось сообщить об ошибке:",
            reportError,
          );
        });
      }
    }

    return { ready, failed };
  },
});
