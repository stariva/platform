import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import { type NextRequest, NextResponse } from "next/server";
import { hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopBySlug } from "@/lib/workshops-data";

export const runtime = "nodejs";

/**
 * Выдаёт подписанную ссылку на PDF-материал курса.
 * Ключ обязан принадлежать материалам запрошенного мастер-класса —
 * это защищает от попыток скачать произвольный объект из бакета.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const key = request.nextUrl.searchParams.get("key");

  if (!slug || !key) {
    return NextResponse.json(
      { error: "slug и key обязательны" },
      { status: 400 },
    );
  }

  const workshop = getWorkshopBySlug(slug);
  if (!workshop) {
    return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
  }

  // Ключ должен быть из списка материалов курса
  const allowed = (workshop.materialFiles ?? []).some((m) => m.key === key);
  if (!allowed) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  if (!(await hasAccess(session.user.id, slug))) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Хранилище не настроено" },
      { status: 503 },
    );
  }

  try {
    const url = await getDownloadUrl(key, { expiresIn: 300 });
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[materials/sign] Ошибка подписи URL:", error);
    return NextResponse.json(
      { error: "Не удалось получить материал" },
      { status: 500 },
    );
  }
}
