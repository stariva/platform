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

// ffmpeg читает исходник по этой ссылке всё время нарезки
const SOURCE_URL_TTL_SECONDS = 6 * 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

const claim = jobs.videos.claim.handler(async ({ errors }) => {
  if (!isStorageConfigured()) throw errors.STORAGE_NOT_CONFIGURED();

  const job = await claimNextVideo();
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

export const jobsRouter = {
  videos: { claim, heartbeat, uploadUrls, complete, fail },
  reminders: { sweep },
};
