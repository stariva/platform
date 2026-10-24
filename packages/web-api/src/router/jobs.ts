import { ORPCError } from "@orpc/server";
import {
  createUploadUrl,
  getDownloadUrl,
  HLS_FILE_PATTERN,
  hlsContentType,
  isStorageConfigured,
} from "@stariva/storage";
import { jobs } from "../procedures";
import {
  claimNextVideo,
  completeRendition,
  extendRenditionLease,
  failRendition,
  getAttemptHlsPrefix,
} from "../services/video-renditions";
import { sweepWorkshopStorage } from "../services/workshop-storage";
import { recentRange } from "../services/yandex/common";
import {
  DirectReportPendingError,
  isDirectConfigured,
  syncDirectReport,
} from "../services/yandex/direct";
import {
  isMetrikaConfigured,
  MetrikaLogsPendingError,
  syncMetrikaGoals,
  syncMetrikaLogs,
} from "../services/yandex/metrika";

// ffmpeg читает исходник по этой ссылке всё время нарезки
const SOURCE_URL_TTL_SECONDS = 6 * 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

const claim = jobs.videos.claim.handler(async ({ input, errors }) => {
  if (!isStorageConfigured()) throw errors.STORAGE_NOT_CONFIGURED();

  const job = await claimNextVideo(input?.version ?? 1);
  if (!job) return { job: null };
  return {
    job: {
      ...job,
      sourceUrl: await getDownloadUrl(job.videoKey, {
        expiresIn: SOURCE_URL_TTL_SECONDS,
      }),
    },
  };
});

const heartbeat = jobs.videos.heartbeat.handler(async ({ input, errors }) => {
  if (!(await extendRenditionLease(input))) throw errors.ATTEMPT_LOST();
});

const uploadUrls = jobs.videos.uploadUrls.handler(async ({ input, errors }) => {
  const { files } = input;
  // Имена файлов знает только @stariva/storage, поэтому проверяем здесь,
  // а не в контракте: контракт не тянет за собой S3 SDK
  if (!files.every((file) => HLS_FILE_PATTERN.test(file))) {
    throw new ORPCError("BAD_REQUEST", { message: "invalid_hls_file" });
  }
  if (!isStorageConfigured()) throw errors.STORAGE_NOT_CONFIGURED();

  const prefix = await getAttemptHlsPrefix(input);
  if (!prefix) throw errors.ATTEMPT_LOST();

  const entries = await Promise.all(
    files.map(async (file) => {
      const contentType = hlsContentType(file);
      const url = await createUploadUrl(`${prefix}/${file}`, contentType, {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
      });
      return [file, { url, contentType }] as const;
    }),
  );
  return { uploads: Object.fromEntries(entries) };
});

const complete = jobs.videos.complete.handler(async ({ input, errors }) => {
  const result = await completeRendition(input, input.durationSeconds);
  if (result === "not_found") throw errors.ATTEMPT_LOST();
  if (result === "missing_playlist") throw errors.PLAYLIST_MISSING();
});

const fail = jobs.videos.fail.handler(async ({ input }) => {
  await failRendition(input, input.error);
});

/**
 * Повторный прогон безопасен: отправленное помечено и второй раз не уйдёт.
 * Поэтому при сбоях отдаём ошибку, и Hatchet повторяет прогон целиком.
 */
const sweep = jobs.reminders.sweep.handler(async ({ context, errors }) => {
  const result = await context.services.runWorkshopReminderSweep();
  if (result.failed > 0) throw errors.REMINDERS_FAILED({ data: result });
  return result;
});

const storageSweep = jobs.storage.sweep.handler(async ({ input, errors }) => {
  if (!isStorageConfigured()) throw errors.STORAGE_NOT_CONFIGURED();
  const { deleted, bytes, renditions } = await sweepWorkshopStorage({
    dryRun: input?.dryRun ?? false,
  });
  return { deleted, bytes, renditions };
});

// Визиты за день закрываются через полчаса после полуночи, а Директ
// дописывает конверсии задним числом — поэтому окна с запасом.
const METRIKA_DAYS = 7;
const DIRECT_DAYS = 14;

function analyticsRange(
  input: { from?: string; to?: string },
  days: number,
): { from: string; to: string } {
  const recent = recentRange(days);
  const range = { from: input.from ?? recent.from, to: input.to ?? recent.to };
  if (range.from > range.to) {
    throw new ORPCError("BAD_REQUEST", { message: "invalid_range" });
  }
  return range;
}

const metrikaGoals = jobs.analytics.metrikaGoals.handler(async ({ errors }) => {
  if (!isMetrikaConfigured()) throw errors.ANALYTICS_NOT_CONFIGURED();
  return syncMetrikaGoals();
});

const metrikaLogs = jobs.analytics.metrikaLogs.handler(
  async ({ input, errors }) => {
    if (!isMetrikaConfigured()) throw errors.ANALYTICS_NOT_CONFIGURED();
    try {
      return await syncMetrikaLogs(
        input.source,
        analyticsRange(input, METRIKA_DAYS),
      );
    } catch (error) {
      if (error instanceof MetrikaLogsPendingError)
        throw errors.ANALYTICS_PENDING({ cause: error });
      throw error;
    }
  },
);

const directReport = jobs.analytics.directReport.handler(
  async ({ input, errors }) => {
    if (!isDirectConfigured()) throw errors.ANALYTICS_NOT_CONFIGURED();
    try {
      return await syncDirectReport(
        input.report,
        analyticsRange(input, DIRECT_DAYS),
      );
    } catch (error) {
      if (error instanceof DirectReportPendingError)
        throw errors.ANALYTICS_PENDING({ cause: error });
      throw error;
    }
  },
);

export const jobsRouter = {
  videos: { claim, heartbeat, uploadUrls, complete, fail },
  reminders: { sweep },
  storage: { sweep: storageSweep },
  analytics: { metrikaGoals, metrikaLogs, directReport },
  npd: {
    sweep: jobs.npd.sweep.handler(({ context }) =>
      context.services.runNpdIssuingSweep(),
    ),
  },
};
