import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Процедуры, которые вызывает воркер Hatchet (apps/jobs). Доступ — по
 * общему JOBS_SECRET в `Authorization: Bearer …`.
 */

const attempt = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  attemptId: z.number().int().positive(),
});

// Попытка уже не воркера: аренда истекла и видео отдано другому, или оно
// готово. Воркер бросает работу, чтобы не грузить сервер впустую
const ATTEMPT_LOST = { status: 409, message: "attempt_lost" } as const;

const base = oc.errors({
  JOBS_NOT_CONFIGURED: { status: 503, message: "jobs_not_configured" },
});

export const videosContract = {
  /**
   * Следующее видео без HLS-версии: ссылка на исходник и папка, куда класть
   * куски. `job: null` — нарезать нечего.
   */
  claim: base
    .errors({
      STORAGE_NOT_CONFIGURED: {
        status: 503,
        message: "storage_not_configured",
      },
    })
    .output(
      z.object({
        job: z
          .object({
            videoKey: z.string(),
            hlsPrefix: z.string(),
            attemptId: z.number().int().positive(),
            sourceUrl: z.url(),
          })
          .nullable(),
      }),
    ),

  /** Воркер ещё режет видео — продлеваем аренду. */
  heartbeat: base.errors({ ATTEMPT_LOST }).input(attempt),

  /**
   * Ссылки для заливки кусков HLS-версии. Папку берём из текущей попытки,
   * чтобы старый воркер не перезаписал её файлы.
   */
  uploadUrls: base
    .errors({ ATTEMPT_LOST })
    .input(
      attempt.extend({
        files: z.array(z.string().min(1).max(64)).min(1).max(500),
      }),
    )
    .output(
      z.object({
        uploads: z.record(
          z.string(),
          z.object({ url: z.url(), contentType: z.string() }),
        ),
      }),
    ),

  /** Воркер залил HLS-версию: с этого момента плеер показывает её. */
  complete: base
    .errors({
      ATTEMPT_LOST,
      // Плейлист заливается последним; без него версия не готова
      PLAYLIST_MISSING: { status: 409, message: "playlist_missing" },
    })
    .input(attempt.extend({ durationSeconds: z.number().nonnegative() })),

  /** Нарезка упала: видео вернётся в очередь после паузы. */
  fail: base.input(attempt.extend({ error: z.string().max(10_000) })),
};

export const jobsContract = {
  videos: videosContract,
};
