import { error, oc, type } from "@orpc/contract";
import { z } from "zod";
import { OzonRequestFailedError, ozonStockPullResultSchema } from "./admin";
import { madeToOrderSweepResult } from "./made-to-order";

/**
 * Процедуры, которые вызывает воркер Hatchet (apps/jobs). Доступ — по
 * общему JOBS_SECRET в `Authorization: Bearer …`.
 */

// Резерв на завершение SQL и HTTP-ответ: сервер < RPC-клиент < Hatchet.
export const OZON_PVZ_SYNC_TIMEOUTS = {
  serverMs: 85_000,
  clientMs: 100_000,
  execution: "120s",
} as const;

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

  /**
   * Пачка файлов для копирования из активного бакета в зеркало (VK Cloud):
   * подписанное чтение из активного и заливка в зеркало. Воркер копирует
   * пачку и зовёт процедуру снова, пока files не опустеет. Повтор прогона
   * безопасен: скопированное исчезает из следующей пачки. `configured:
   * false` — зеркало не задано в окружении, воркер тихо ждёт следующего
   * прогона.
   */
  mirrorSync: jobProcedure
    .errors({ [StorageNotConfiguredError.code]: StorageNotConfiguredError })
    .input(
      z
        .object({
          maxFiles: z.number().int().positive().max(1000).optional(),
          maxBytes: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        configured: z.boolean(),
        files: z.array(
          z.object({
            key: z.string(),
            size: z.number().int().nonnegative(),
            contentType: z.string(),
            getUrl: z.url(),
            putUrl: z.url(),
          }),
        ),
        remainingFiles: z.number().int().nonnegative(),
        remainingBytes: z.number().int().nonnegative(),
      }),
    ),
};

/** На сайте нет OAuth-токена Метрики или Директа. */
export const AnalyticsNotConfiguredError = error("ANALYTICS_NOT_CONFIGURED", {
  message: "analytics_not_configured",
});

/**
 * Яндекс ещё готовит выгрузку. Запрос уже создан, повтор с теми же днями
 * его подхватит — воркер просто повторяет задание позже.
 */
export const AnalyticsPendingError = error("ANALYTICS_PENDING", {
  message: "analytics_pending",
});

/** Дни выгрузки по Москве, включительно; без них — последние дни по вчера. */
const analyticsRange = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

const analyticsProcedure = jobProcedure.errors({
  [AnalyticsNotConfiguredError.code]: AnalyticsNotConfiguredError,
  [AnalyticsPendingError.code]: AnalyticsPendingError,
});

export const analyticsContract = {
  /** Цели счётчика Метрики: имена для goal_ids. */
  metrikaGoals: analyticsProcedure.output(
    z.object({ goals: z.number().int().nonnegative() }),
  ),

  /** Визиты или события из Logs API Метрики; повтор перезаписывает те же. */
  metrikaLogs: analyticsProcedure
    .input(z.object({ source: z.enum(["visits", "hits"]), ...analyticsRange }))
    .output(
      z.object({
        rows: z.number().int().nonnegative(),
        requestId: z.number().int(),
      }),
    ),

  /**
   * Статистика Директа по срезам или поисковые запросы за дни. Со
   * статистикой пересчитываются и расходы кампаний CRM за те же дни.
   */
  directReport: analyticsProcedure
    .input(
      z.object({
        report: z.enum(["stats", "search_queries"]),
        ...analyticsRange,
      }),
    )
    .output(
      z.object({
        rows: z.number().int().nonnegative(),
        goals: z.number().int().nonnegative(),
        expenseDays: z.number().int().nonnegative().optional(),
      }),
    ),
};

const emailEventsSyncResult = z.object({
  configured: z.boolean(),
  read: z.number().int().nonnegative(),
  stored: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
});

export type EmailEventsSyncResult = z.infer<typeof emailEventsSyncResult>;

export const emailsContract = {
  /**
   * Дочитывает поток событий Postbox (доставлено, не доставлено, жалоба) и
   * обновляет журнал писем. Без потока в окружении сайта ничего не делает и
   * отвечает configured: false — крон раз в минуту не должен сыпать ошибками.
   */
  syncEvents: jobProcedure.output(emailEventsSyncResult),
};

export const madeToOrderContract = {
  /**
   * Догоняет заказы под заказ, которым помешал сбой Ozon Доставки: заменяет
   * цену-заглушку реальной до оплаты покупателем и создаёт отправления
   * оплаченных заказов, если вебхук не смог. Кнопка в админке зовёт полный
   * прогон, крон воркера — только пульс интеграции (`orders: false`).
   * Прогон идемпотентен, повтор безвреден.
   */
  sweep: jobProcedure
    .input(z.object({ orders: z.boolean().optional() }).optional())
    .output(madeToOrderSweepResult),
};

/** Оценка одной страницы из sitemap в одной стратегии за прогон PSI. */
const pagespeedResult = z.object({
  url: z.url().max(2000),
  strategy: z.enum(["mobile", "desktop"]),
  /** Момент начала прогона стратегии; день по Москве считает сайт. */
  scannedAt: z.iso.datetime(),
  // 0–100 по категориям Lighthouse; null — страница не просканировалась
  performance: z.number().int().min(0).max(100).nullable(),
  accessibility: z.number().int().min(0).max(100).nullable(),
  bestPractices: z.number().int().min(0).max(100).nullable(),
  seo: z.number().int().min(0).max(100).nullable(),
  // Лабораторные метрики Lighthouse: времена в мс, CLS без единиц
  firstContentfulPaint: z.number().nonnegative().nullable(),
  largestContentfulPaint: z.number().nonnegative().nullable(),
  totalBlockingTime: z.number().nonnegative().nullable(),
  cumulativeLayoutShift: z.number().nonnegative().nullable(),
  speedIndex: z.number().nonnegative().nullable(),
  /** Причина сбоя сканирования: квота, таймаут, недоступность страницы. */
  error: z.string().max(1000).nullable(),
});

export type PagespeedResult = z.infer<typeof pagespeedResult>;

export const pagespeedContract = {
  /**
   * Записывает пачку оценок PageSpeed Insights от воркера. Ключ строки —
   * url + strategy + день по Москве. Повтор с более ранним временем строку
   * не меняет. Дубликаты ключей внутри пачки отклоняются.
   */
  report: jobProcedure
    .input(z.object({ results: z.array(pagespeedResult).min(1).max(200) }))
    .output(z.object({ saved: z.number().int().nonnegative() })),
};

export const jobsContract = {
  videos: videosContract,
  emails: emailsContract,
  reminders: remindersContract,
  storage: storageContract,
  analytics: analyticsContract,
  pagespeed: pagespeedContract,
  madeToOrder: madeToOrderContract,
  ozon: {
    /**
     * Сверяет остаток товаров, которые продаются и на маркетплейсе Ozon:\
     * покупки на Ozon уменьшают остаток на сайте. Без ключей Seller API
     * ничего не делает и отвечает configured: false.
     */
    syncStock: jobProcedure
      .errors({ [OzonRequestFailedError.code]: OzonRequestFailedError })
      .output(ozonStockPullResultSchema),
  },
  pvz: {
    /**
     * Синхронизирует список ПВЗ Ozon Доставки в локальную БД. Без конфига
     * ничего не делает. Запускается воркером раз в час.
     */
    sync: jobProcedure
      .errors({ [OzonRequestFailedError.code]: OzonRequestFailedError })
      .output(
        z.object({
          configured: z.boolean(),
          upserted: z.number().int().nonnegative(),
          deactivated: z.number().int().nonnegative(),
        }),
      ),
  },
  npd: {
    /** Только алерт о зависших чеках; повторная регистрация дохода запрещена. */
    sweep: jobProcedure.output(
      z.object({ checked: z.number().int().nonnegative() }),
    ),
  },
};
