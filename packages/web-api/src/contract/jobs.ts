import { error, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Процедуры, которые вызывает воркер Hatchet (apps/jobs). Доступ — по
 * общему JOBS_SECRET в `Authorization: Bearer …`.
 */

/** На сайте не задан JOBS_SECRET: воркеру тут делать нечего. */
export const JobsNotConfiguredError = error("JOBS_NOT_CONFIGURED", {
  message: "jobs_not_configured",
});

/** Бакет не настроен: ни исходник отдать, ни ссылки на загрузку выдать. */
export const StorageNotConfiguredError = error("STORAGE_NOT_CONFIGURED", {
  message: "storage_not_configured",
});

/**
 * Попытка уже не воркера: аренда истекла и видео отдано другому, или оно
 * готово. Воркер бросает работу, чтобы не грузить сервер впустую.
 */
export const AttemptLostError = error("ATTEMPT_LOST", {
  message: "attempt_lost",
});

/** Плейлист заливается последним; без него HLS-версия не готова. */
export const PlaylistMissingError = error("PLAYLIST_MISSING", {
  message: "playlist_missing",
});

const attempt = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  attemptId: z.number().int().positive(),
});

/** Любая процедура воркера: на сайте может быть не задан JOBS_SECRET. */
const jobProcedure = oc.errors({
  [JobsNotConfiguredError.code]: JobsNotConfiguredError,
});

/** Процедура над попыткой нарезки: попытку могли отдать другому воркеру. */
const attemptProcedure = jobProcedure.errors({
  [AttemptLostError.code]: AttemptLostError,
});

export const videosContract = {
  /**
   * Следующее видео без HLS-версии: ссылка на исходник и папка, куда класть
   * куски. `job: null` — нарезать нечего. `version` — какую нарезку умеет
   * воркер: 1 — одно качество (index.m3u8), 2 — несколько (master.m3u8).
   * Воркер версии 2 получает и готовые видео версии 1, чтобы их перерезать.
   */
  claim: jobProcedure
    .errors({ [StorageNotConfiguredError.code]: StorageNotConfiguredError })
    .input(
      z
        .object({ version: z.number().int().min(1).max(2).default(1) })
        .optional(),
    )
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
  heartbeat: attemptProcedure.input(attempt).output(type<void>()),

  /**
   * Ссылки для заливки кусков HLS-версии. Папку берём из текущей попытки,
   * чтобы старый воркер не перезаписал её файлы.
   */
  uploadUrls: attemptProcedure
    .errors({ [StorageNotConfiguredError.code]: StorageNotConfiguredError })
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
  complete: attemptProcedure
    .errors({ [PlaylistMissingError.code]: PlaylistMissingError })
    .input(attempt.extend({ durationSeconds: z.number().nonnegative() }))
    .output(type<void>()),

  /** Нарезка упала: видео вернётся в очередь после паузы. */
  fail: jobProcedure
    .input(attempt.extend({ error: z.string().max(10_000) }))
    .output(type<void>()),
};

const reminderSweepResult = z.object({
  /** Заказы, которые попали в окно прогона: оплаченные и брошенные. */
  checked: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export type ReminderSweepResult = z.infer<typeof reminderSweepResult>;

/**
 * Часть писем или сообщений не ушла. Отправленное помечено, поэтому воркер
 * просто повторяет прогон целиком: дублей не будет.
 */
export const RemindersFailedError = error("REMINDERS_FAILED", {
  message: "reminders_failed",
  data: reminderSweepResult,
});

export const remindersContract = {
  /**
   * Дошлёт письма о покупке мастер-класса, не ушедшие из вебхука, разошлёт
   * напоминания о старте (письма и Telegram) и одно письмо «оплата не
   * завершилась» тем, кто оформил заказ, но не оплатил.
   */
  sweep: jobProcedure
    .errors({ [RemindersFailedError.code]: RemindersFailedError })
    .output(reminderSweepResult),
};

export const storageContract = {
  /**
   * Удаляет из закрытого бакета файлы мастер-классов, на которые больше
   * никто не ссылается: заменённые видео, их нарезки, заменённые PDF.
   * Недавние не трогает. `dryRun` — только посчитать.
   */
  sweep: jobProcedure
    .errors({ [StorageNotConfiguredError.code]: StorageNotConfiguredError })
    .input(z.object({ dryRun: z.boolean().default(false) }).optional())
    .output(
      z.object({
        deleted: z.number().int().nonnegative(),
        bytes: z.number().int().nonnegative(),
        renditions: z.number().int().nonnegative(),
      }),
    ),
};

export const jobsContract = {
  videos: videosContract,
  reminders: remindersContract,
  storage: storageContract,
  npd: {
    /** Только алерт о зависших чеках; повторная регистрация дохода запрещена. */
    sweep: jobProcedure.output(
      z.object({ checked: z.number().int().nonnegative() }),
    ),
  },
};
