import { env } from "@stariva/config";
import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
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
import { getReadyRendition } from "@/lib/workshops/video-renditions";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import {
  findWorkshopLesson,
  formatReleaseDateTime,
  isPreorder,
} from "@/lib/workshops-data";

export const runtime = "nodejs";

// Ссылка живёт 15 минут: плеер сам берёт новую, когда старая истекла, а
// скопированная из браузера ссылка быстро перестаёт работать
const URL_TTL_SECONDS = 60 * 15;

/**
 * Выдаёт временную ссылку на видео урока: на HLS-плейлист, если видео уже
 * нарезано (`type: "hls"`), иначе на исходный MP4 (`type: "mp4"`).
 * Доступ: бесплатный урок-превью — всем; платные уроки — только владельцам.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const lessonId = request.nextUrl.searchParams.get("lessonId");

  if (!slug || !lessonId) {
    return NextResponse.json(
      { error: "slug и lessonId обязательны" },
      { status: 400 },
    );
  }

  // Архивный курс не продаётся, но купившие продолжают его смотреть
  const workshop = await getWorkshopBySlug(slug, "owned");
  const lesson = workshop && findWorkshopLesson(workshop, lessonId);
  if (!workshop || !lesson) {
    return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
  }
  if (!lesson.videoKey) {
    return NextResponse.json(
      { error: "Видео ещё не загружено" },
      { status: 404 },
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Хранилище видео не настроено" },
      { status: 503 },
    );
  }

  // Проверка доступа: превью открыто всем, пока курс опубликован
  const session = await getSession();
  if (!(lesson.free && workshop.status === "published")) {
    if (!session) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }
    const owned = await hasAccess(session.user.id, slug);
    if (!owned) {
      return NextResponse.json(
        { error: "Нет доступа к этому уроку" },
        { status: 403 },
      );
    }
    // Предзаказ: уроки открываются в дату старта, у всех одновременно
    if (isPreorder(workshop) && workshop.releaseAt) {
      return NextResponse.json(
        {
          error: `Урок откроется ${formatReleaseDateTime(workshop.releaseAt)}`,
        },
        { status: 403 },
      );
    }
  }

  const access = {
    userId: session?.user.id ?? null,
    ip: clientIp(request.headers),
  };
  if (await isVideoSignRateLimited(access)) {
    console.warn("[video/sign] Превышен предел ссылок:", access);
    return NextResponse.json(
      { error: "Слишком много запросов видео. Попробуйте через несколько минут" },
      { status: 429 },
    );
  }
  await logVideoAccess({
    ...access,
    workshopSlug: slug,
    lessonId,
    userAgent: request.headers.get("user-agent"),
  });

  try {
    // Есть HLS-версия — отдаём её кусками через сайт, исходный MP4 не светим
    const rendition = await getReadyRendition(lesson.videoKey);
    if (rendition && env.AUTH_SECRET) {
      const token = signHlsGrant(
        {
          prefix: rendition.hlsPrefix,
          expiresAt: Math.floor(Date.now() / 1000) + HLS_GRANT_TTL_SECONDS,
          session: session
            ? sessionFingerprint(getSessionCookie(request))
            : null,
        },
        env.AUTH_SECRET,
      );
      return NextResponse.json(
        {
          url: `/api/video/hls/${token}/index.m3u8`,
          type: "hls",
          expiresIn: HLS_GRANT_TTL_SECONDS,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Пока видео не нарезано — исходный файл по короткой ссылке
    const url = await getDownloadUrl(lesson.videoKey, {
      expiresIn: URL_TTL_SECONDS,
    });
    return NextResponse.json(
      { url, type: "mp4", expiresIn: URL_TTL_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[video/sign] Ошибка подписи URL:", error);
    return NextResponse.json(
      { error: "Не удалось получить видео" },
      { status: 500 },
    );
  }
}
