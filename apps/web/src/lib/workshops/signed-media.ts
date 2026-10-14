import { env } from "@stariva/config";
import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import {
  getReadyRendition,
  hasAccess,
  type LessonVideoResult,
  type MaterialUrlResult,
  type WorkshopFileServices,
} from "@stariva/web-api";
import { getSessionCookie } from "better-auth/cookies";
import { clientIp } from "@/lib/visitor";
import {
  HLS_GRANT_TTL_SECONDS,
  sessionFingerprint,
  signHlsGrant,
} from "@/lib/workshops/hls-token";
import {
  isVideoSignRateLimited,
  logVideoAccess,
} from "@/lib/workshops/video-access";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import {
  findWorkshopLesson,
  formatReleaseDateTime,
  isPreorder,
} from "@/lib/workshops-data";

// Ссылка живёт 15 минут: плеер сам берёт новую, когда старая истекла, а
// скопированная из браузера ссылка быстро перестаёт работать
const VIDEO_URL_TTL_SECONDS = 60 * 15;
const MATERIAL_URL_TTL_SECONDS = 300;

/**
 * Ссылка на видео урока: на HLS-плейлист, если видео уже нарезано, иначе на
 * исходный MP4. Доступ: бесплатный урок-превью — всем; платные уроки — только
 * владельцам.
 */
async function signLessonVideo({
  slug,
  lessonId,
  userId,
  headers,
}: Parameters<
  WorkshopFileServices["signLessonVideo"]
>[0]): Promise<LessonVideoResult> {
  // Архивный курс не продаётся, но купившие продолжают его смотреть
  const workshop = await getWorkshopBySlug(slug, "owned");
  const lesson = workshop && findWorkshopLesson(workshop, lessonId);
  if (!workshop || !lesson) return { status: "lesson_not_found" };
  if (!lesson.videoKey) return { status: "video_not_uploaded" };
  if (!isStorageConfigured()) return { status: "files_unavailable" };

  // Проверка доступа: превью открыто всем, пока курс опубликован
  if (!(lesson.free && workshop.status === "published")) {
    if (!userId) return { status: "unauthorized" };
    if (!(await hasAccess(userId, slug))) return { status: "forbidden" };
    // Предзаказ: уроки открываются в дату старта, у всех одновременно
    if (isPreorder(workshop) && workshop.releaseAt) {
      return {
        status: "not_released",
        message: `Урок откроется ${formatReleaseDateTime(workshop.releaseAt)}`,
      };
    }
  }

  const access = { userId, ip: clientIp(headers) };
  if (await isVideoSignRateLimited(access)) {
    console.warn("[lesson-video] Превышен предел ссылок:", access);
    return { status: "rate_limited" };
  }
  await logVideoAccess({
    ...access,
    workshopSlug: slug,
    lessonId,
    userAgent: headers.get("user-agent"),
  });

  // Есть HLS-версия — отдаём её кусками через сайт, исходный MP4 не светим
  const rendition = await getReadyRendition(lesson.videoKey);
  const fingerprint = userId
    ? sessionFingerprint(getSessionCookie(headers))
    : null;
  if (rendition && env.AUTH_SECRET && (!userId || fingerprint)) {
    const token = signHlsGrant(
      {
        prefix: rendition.hlsPrefix,
        expiresAt: Math.floor(Date.now() / 1000) + HLS_GRANT_TTL_SECONDS,
        session: fingerprint,
      },
      env.AUTH_SECRET,
    );
    return {
      status: "ok",
      url: `/api/video/hls/${token}/index.m3u8`,
      type: "hls",
      expiresIn: HLS_GRANT_TTL_SECONDS,
    };
  }

  // Пока видео не нарезано — исходный файл по короткой ссылке
  const url = await getDownloadUrl(lesson.videoKey, {
    expiresIn: VIDEO_URL_TTL_SECONDS,
  });
  return {
    status: "ok",
    url,
    type: "mp4",
    expiresIn: VIDEO_URL_TTL_SECONDS,
  };
}

/**
 * Ссылка на PDF-материал курса. Ключ обязан принадлежать материалам
 * запрошенного мастер-класса — это защищает от попыток скачать произвольный
 * объект из бакета.
 */
async function signMaterial({
  slug,
  key,
  userId,
}: Parameters<
  WorkshopFileServices["signMaterial"]
>[0]): Promise<MaterialUrlResult> {
  const workshop = await getWorkshopBySlug(slug, "owned");
  if (!workshop?.materialFiles?.some((material) => material.key === key)) {
    return { status: "not_found" };
  }
  if (!userId) return { status: "unauthorized" };
  if (!(await hasAccess(userId, slug))) return { status: "forbidden" };
  if (!isStorageConfigured()) return { status: "files_unavailable" };

  const url = await getDownloadUrl(key, {
    expiresIn: MATERIAL_URL_TTL_SECONDS,
  });
  return { status: "ok", url };
}

export const workshopFileServices: WorkshopFileServices = {
  signLessonVideo,
  signMaterial,
};
