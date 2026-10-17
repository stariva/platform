import { isAdminUser } from "@stariva/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type Session } from "./server";

/**
 * Возвращает текущую сессию на сервере (или null).
 * Обёрнуто в cache(), чтобы за один рендер сессия запрашивалась один раз.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ?? null;
});

/**
 * Требует авторизации: возвращает сессию или редиректит на вход.
 * @param callbackPath путь, куда вернуть пользователя после входа
 */
export async function requireSession(callbackPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const target = callbackPath
      ? `/sign-in?callbackURL=${encodeURIComponent(callbackPath)}`
      : "/sign-in";
    redirect(target);
  }
  return session;
}

/**
 * Сессия администратора (подтверждённая почта из ADMIN_EMAILS) или null —
 * для служебных роутов витрины, которые нельзя открывать покупателям.
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  return session && isAdminUser(session.user) ? session : null;
}
