import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Оптимистичная защита приватных маршрутов.
 *
 * Здесь проверяется только наличие cookie сессии (быстро, без обращения к БД).
 * Полноценная проверка сессии выполняется в layout раздела /account через
 * requireSession(). Это рекомендованный подход better-auth для Next.js.
 */
export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/account/:path*"],
};
