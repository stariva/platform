import type { NextRequest } from "next/server";

/**
 * Хост, по которому посетитель открыл сайт. За прокси (Traefik → под) в
 * request.nextUrl.host стоит внутренний адрес пода, а не stariva.ru, поэтому
 * берём то, что передал прокси: x-forwarded-host, иначе Host.
 */
function publicHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded?.split(",")[0]?.trim() || request.headers.get("host");
  return host || request.nextUrl.host;
}

/**
 * Запрос со страниц сайта, а не с чужого: Origin браузер подставляет сам.
 * Запросы без Origin (curl, серверные вызовы) пропускаем: защищаемся только
 * от чужих страниц в браузере посетителя.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === publicHost(request);
  } catch {
    return false;
  }
}
