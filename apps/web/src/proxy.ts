import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  addTouch,
  parseAttribution,
  touchFromUrl,
} from "@/lib/campaign-attribution";

/** Применяет защиту маршрутов и добавляет cookie UTM-атрибуции к ответу. */
export function proxy(request: NextRequest) {
  return rememberCampaign(request, guard(request));
}

/**
 * Оптимистичная защита приватных маршрутов.
 *
 * Здесь проверяется только наличие cookie сессии (быстро, без обращения к БД).
 * Полноценная проверка сессии выполняется в layout раздела /account через
 * requireSession(). Это рекомендованный подход better-auth для Next.js.
 */
function guard(request: NextRequest) {
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
  if (!request.nextUrl.pathname.startsWith("/account"))
    return NextResponse.next();
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set(
      "callbackURL",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
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
  response.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(attribution), {
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
    "/account/:path*",
    "/",
    "/a",
    "/sign-in",
    // Любая страница, если в ссылке есть UTM-метка. Только литералы:
    // Next разбирает matcher статически, вычисленные значения игнорирует.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "utm_source" }],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "utm_medium" }],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "utm_campaign" }],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "utm_content" }],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "utm_term" }],
    },
  ],
};
