import { createHash } from "node:crypto";
import { env } from "@stariva/config";
import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import {
  canWatchCourse,
  getReadyRendition,
  isAdminUserId,
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
  MATERIAL_GRANT_TTL_SECONDS,
  signMaterialGrant,
} from "@/lib/workshops/material-token";
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
    if (!(await canWatchCourse(userId, slug))) return { status: "forbidden" };
    // Предзаказ: уроки открываются в дату старта, у всех одновременно. Админ
    // смотрит раньше, чтобы проверить видео
    if (
      isPreorder(workshop) &&
      workshop.releaseAt &&
      !(await isAdminUserId(userId))
    ) {
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
      url: `/api/video/hls/${token}/${rendition.playlist}`,
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

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

interface CourseFile {
  key: string;
  label: string;
  kind: "pdf" | "image";
}

/** Расширение и тип файла: PDF курса — всегда PDF, фото схемы — по ключу. */
function fileType(file: CourseFile): {
  extension: string;
  contentType: string;
} {
  if (file.kind === "pdf") {
    return { extension: "pdf", contentType: "application/pdf" };
  }
  const extension = file.key.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = IMAGE_TYPES[extension];
  return contentType
    ? { extension, contentType }
    : { extension: "bin", contentType: "application/octet-stream" };
}

/** Стабильный идентификатор материала: учитывает весь ключ, включая каталог. */
function materialFileId(file: CourseFile): string {
  const hash = createHash("sha256").update(file.key).digest("hex");
  return `${hash}.${fileType(file).extension}`;
}

/**
 * Проверяет доступ к материалу курса: PDF из материалов или схеме из урока.
 * Файл обязан быть в материалах запрошенного мастер-класса — это защищает от
 * попыток скачать произвольный объект из бакета.
 */
async function authorizeMaterial(
  slug: string,
  matches: (file: CourseFile) => boolean,
  userId: string | null,
): Promise<
  | {
      status: "ok";
      key: string;
      label: string;
      fileId: string;
      contentType: string;
      extension: string;
    }
  | Exclude<MaterialUrlResult, { status: "ok" }>
> {
  const workshop = await getWorkshopBySlug(slug, "owned");
  const files: CourseFile[] = [
    ...(workshop?.materialFiles ?? []).map((file) => ({
      key: file.key,
      label: file.label,
      kind: "pdf" as const,
    })),
    ...(workshop?.lessons ?? []).flatMap((lesson) => lesson.attachments ?? []),
  ];
  const material = files.find(matches);
  if (!material) return { status: "not_found" };
  if (!userId) return { status: "unauthorized" };
  if (!(await canWatchCourse(userId, slug))) return { status: "forbidden" };
  if (!isStorageConfigured()) return { status: "files_unavailable" };
  return {
    status: "ok",
    key: material.key,
    label: material.label,
    fileId: materialFileId(material),
    ...fileType(material),
  };
}

/**
 * Ссылка на материал курса — на адрес сайта, а не в бакет: файл отдаёт
 * /api/workshops/[slug]/materials/[file], ещё раз проверив доступ. В ссылке —
 * короткий пропуск: приложение открывает её без cookie сайта.
 */
async function signMaterial({
  slug,
  key,
  userId,
}: Parameters<
  WorkshopFileServices["signMaterial"]
>[0]): Promise<MaterialUrlResult> {
  const result = await authorizeMaterial(
    slug,
    (file) => file.key === key,
    userId,
  );
  if (result.status !== "ok") return result;
  const url = `/api/workshops/${encodeURIComponent(slug)}/materials/${result.fileId}`;
  if (!userId || !env.AUTH_SECRET) return { status: "ok", url };
  const token = signMaterialGrant(
    {
      slug,
      file: result.fileId,
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + MATERIAL_GRANT_TTL_SECONDS,
    },
    env.AUTH_SECRET,
  );
  return { status: "ok", url: `${url}?token=${token}` };
}

/** Материал курса по идентификатору из адреса — для маршрута, который его отдаёт. */
export function findMaterialFile(
  slug: string,
  fileId: string,
  userId: string | null,
) {
  return authorizeMaterial(
    slug,
    (file) => materialFileId(file) === fileId,
    userId,
  );
}

export const workshopFileServices: WorkshopFileServices = {
  signLessonVideo,
  signMaterial,
};
