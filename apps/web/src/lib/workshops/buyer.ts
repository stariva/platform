import "server-only";

import {
  beginMagicLinkCapture,
  finishMagicLinkCapture,
} from "@/lib/auth/magic-link-capture";
import { auth } from "@/lib/auth/server";

/**
 * Покупатель мастер-класса без входа: находит аккаунт по email или заводит
 * новый, неподтверждённый. Сессию не выдаём — войти можно только через
 * письмо. Если почту на самом деле ввёл не её владелец, better-auth при
 * первом входе владельца через письмо (magic link) удалит всё, что успели
 * привязать к неподтверждённому аккаунту (revokeUnprovenAccountAccess).
 */
export async function findOrCreateBuyer(email: string, name: string) {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (found) return found.user;
  try {
    return await ctx.internalAdapter.createUser(
      { email, name, emailVerified: false },
      { method: "workshop-checkout" },
    );
  } catch (error) {
    // Параллельная оплата с тем же email успела создать аккаунт
    const raced = await ctx.internalAdapter.findUserByEmail(email);
    if (raced) return raced.user;
    throw error;
  }
}

/**
 * Одноразовая ссылка входа (better-auth magic link), по которой сервер сразу
 * перенаправляет. Письмо при этом не отправляется.
 */
export async function createLoginRedirect(
  email: string,
  callbackURL: string,
  headers: Headers,
): Promise<string | null> {
  const captureId = beginMagicLinkCapture();
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL,
        errorCallbackURL: "/magic-link",
        metadata: { captureId },
      },
      headers,
    });
  } catch (error) {
    finishMagicLinkCapture(captureId);
    throw error;
  }
  return finishMagicLinkCapture(captureId);
}

/** Обычное письмо со ссылкой входа — тем, у кого курс уже куплен. */
export async function sendLoginEmail(
  email: string,
  callbackURL: string,
  headers: Headers,
): Promise<void> {
  await auth.api.signInMagicLink({ body: { email, callbackURL }, headers });
}
