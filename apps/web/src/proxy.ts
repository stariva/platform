import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  addTouch,
  parseAttribution,
  serializeAttribution,
  touchFromUrl,
} from "@/lib/campaign-attribution";
import { createNonce, pageContentSecurityPolicy } from "@/lib/csp";

/**
 * Выдаёт странице CSP с nonce, применяет защиту маршрутов и добавляет cookie
 * UTM-атрибуции к ответу.
 */
export function proxy(request: NextRequest) {
  const policy = pageContentSecurityPolicy({
    nonce: createNonce(),
    isDev: process.env.NODE_ENV === "development",
  });
  // Next берёт nonce из CSP запроса и ставит его на свои скрипты
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  const response =
    guard(request) ??
    NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return rememberCampaign(request, response);
}

/**
 * Оптимистичная защита приватных маршрутов.
 *
 * Здесь проверяется только наличие cookie сессии (быстро, без обращения к БД).
 * Полноценная проверка сессии выполняется в layout раздела /account через
 * requireSession(). Это рекомендованный подход better-auth для Next.js.
 */
function guard(request: NextRequest): NextResponse | undefined {
  if (
    ["INVALID_TOKEN", "EXPIRED_TOKEN"].includes(
      request.nextUrl.searchParams.get("error") ?? "",
    ) &&
    request.nextUrl.pathname !== "/magic-link"
  ) {
    const recovery = new URL("/magic-link", request.url);
    recovery.searchParams.set("error", "INVALID_TOKEN");
    return NextResponse.redirect(recovery);
  }
  if (!request.nextUrl.pathname.startsWith("/account")) return;
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set(
      "callbackURL",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(signInUrl);
  }
}

/** Заход по UTM-ссылке → first-party cookie для атрибуции заказа. */
function rememberCampaign(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET") return response;
  const touch = touchFromUrl(request.nextUrl, request.headers.get("referer"));
  if (!touch) return response;
  const attribution = addTouch(
    parseAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value),
    touch,
  );
  const value = serializeAttribution(attribution);
  if (!value) return response;
  response.cookies.set(ATTRIBUTION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: [
    // Все страницы: без nonce в CSP их скрипты не выполнятся. Мимо прокси —
    // API, PostHog (/ingest), статика и файлы с расширением (robots.txt,
    // sitemap.xml, картинки из public). Только литерал: Next разбирает matcher
    // статически.
    "/((?!api|ingest|_next/static|_next/image|.*\\..*).*)",
  ],
};
