import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import { type NextRequest, NextResponse } from "next/server";
import { hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopLesson } from "@/lib/workshops-data";

export const runtime = "nodejs";

// Ссылка живёт 2 часа — достаточно для просмотра урока, но недолго для шеринга
const URL_TTL_SECONDS = 60 * 60 * 2;

/**
 * Выдаёт временную подписанную ссылку на видео урока.
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

  const found = getWorkshopLesson(slug, lessonId);
  if (!found) {
    return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Хранилище видео не настроено" },
      { status: 503 },
    );
  }

  // Проверка доступа
  if (!found.lesson.free) {
    const session = await getSession();
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
  }

  try {
    const url = await getDownloadUrl(found.lesson.videoKey, {
      expiresIn: URL_TTL_SECONDS,
    });
    return NextResponse.json(
      { url, expiresIn: URL_TTL_SECONDS },
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
