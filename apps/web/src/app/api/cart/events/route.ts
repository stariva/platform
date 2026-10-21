import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cartEventSchema, recordCartEvent } from "@/lib/cart/event-log";
import { readJsonBody } from "@/lib/read-json";
import { clientIp, collectVisitor } from "@/lib/visitor";

export const runtime = "nodejs";

// Сто строк корзины с названиями и ссылками на фото
const MAX_BODY_BYTES = 64 * 1024;

const RATE_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 60;
const MAX_RATE_KEYS = 10_000;
const eventCounts = new Map<string, number>();
let windowStartedAt = Date.now();

/** Лимит на процесс: отдельно по IP и корзине, с ограничением памяти. */
function allowCartEvent(ip: string | null, cartId: string): boolean {
  const now = Date.now();
  if (now - windowStartedAt >= RATE_WINDOW_MS) {
    eventCounts.clear();
    windowStartedAt = now;
  }
  const keys = [`ip:${ip ?? "unknown"}`, `cart:${cartId}`];
  if (
    keys.some((key) => (eventCounts.get(key) ?? 0) >= MAX_EVENTS_PER_WINDOW) ||
    eventCounts.size + keys.filter((key) => !eventCounts.has(key)).length >
      MAX_RATE_KEYS
  ) {
    return false;
  }
  for (const key of keys) {
    eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1);
  }
  return true;
}

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
 * Журнал корзин для админки: браузер присылает каждое изменение корзины
 * (lib/cart/events.ts). Без авторизации — корзина есть и у гостей; если
 * посетитель вошёл, событие привязывается к аккаунту. Боты не пишутся.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Чужой сайт" }, { status: 403 });
  }
  const parsed = cartEventSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!allowCartEvent(clientIp(request.headers), parsed.data.cartId)) {
    return new NextResponse(null, { status: 429 });
  }

  const visitor = await collectVisitor(request);
  if (visitor.device !== "bot") {
    // Сбой авторизации не должен терять событие: тогда оно просто гостевое
    const userId = (await getSession().catch(() => null))?.user.id ?? null;
    await recordCartEvent(parsed.data, { userId, visitor });
  }
  return new NextResponse(null, { status: 204 });
}
