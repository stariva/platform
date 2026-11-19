import { createHash, timingSafeEqual } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { PROFILE_REQUIRED } from "./sign-in-shared";

/** Хеш кода так же, как его хранит emailOTP со `storeOTP: "hashed"`. */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface OtpSignUpOptions {
  /** То же значение, что `allowedAttempts` у emailOTP. */
  allowedAttempts: number;
}

/**
 * Регистрация входом по коду. emailOTP заводит аккаунт на незнакомый адрес
 * сразу, а нам сначала нужно согласие на обработку персональных данных и имя.
 * Если код верный, а аккаунта нет и согласия в запросе тоже нет, отвечаем
 * PROFILE_REQUIRED и код не тратим: форма спросит имя и согласие и пришлёт тот
 * же код ещё раз.
 *
 * Код проверяем до ответа: на неверный код отвечает сам better-auth, как и
 * для существующего аккаунта. Без кода из письма нельзя узнать, есть ли
 * аккаунт на адрес.
 */
export function otpSignUp({ allowedAttempts }: OtpSignUpOptions) {
  return {
    id: "otp-sign-up",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as {
              email?: unknown;
              otp?: unknown;
              name?: unknown;
              personalDataConsent?: unknown;
            };
            if (typeof body.email !== "string" || typeof body.otp !== "string")
              return;
            const email = body.email.trim().toLowerCase();
            if (await ctx.context.internalAdapter.findUserByEmail(email))
              return;

            const record =
              await ctx.context.internalAdapter.findVerificationValue(
                `sign-in-otp-${email}`,
              );
            if (!record || record.expiresAt < new Date()) return;
            const split = record.value.lastIndexOf(":");
            const stored = record.value.slice(0, split);
            const attempts = Number(record.value.slice(split + 1)) || 0;
            if (attempts >= allowedAttempts) return;
            if (!sameText(hashCode(body.otp), stored)) return;

            const name = typeof body.name === "string" ? body.name.trim() : "";
            if (body.personalDataConsent === true && name) return;
            throw new APIError("BAD_REQUEST", {
              code: PROFILE_REQUIRED,
              message: "Укажите имя и дайте согласие — и создадим кабинет.",
            });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
