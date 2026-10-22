import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { attributionFromRequest } from "@/lib/campaign-attribution";
import {
  contactClickSchema,
  recordContactClick,
} from "@/lib/contact-clicks/click-log";
import { readJsonBody } from "@/lib/read-json";
import { collectVisitor } from "@/lib/visitor";

export const runtime = "nodejs";

// Канал, блок, страница и метки захода
const MAX_BODY_BYTES = 4 * 1024;

/** Запрос со страниц сайта, а не с чужого: Origin браузер подставляет сам. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * Журнал переходов в мессенджеры для админки: браузер присылает каждый клик
 * по ссылке к мастеру (lib/contact-clicks/events.ts), сервер добавляет IP,
 * город, устройство, аккаунт и UTM-атрибуцию из cookie. Боты не пишутся.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Чужой сайт" }, { status: 403 });
  }
  const parsed = contactClickSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const visitor = await collectVisitor(request);
  if (visitor.device !== "bot") {
    // Сбой авторизации не должен терять клик: тогда он просто гостевой
    const userId = (await getSession().catch(() => null))?.user.id ?? null;
    await recordContactClick(parsed.data, {
      userId,
      visitor,
      attribution: attributionFromRequest(request),
    });
  }
  return new NextResponse(null, { status: 204 });
}
