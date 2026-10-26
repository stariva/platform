import "server-only";

import { initAuth } from "@stariva/auth";
import { env } from "@stariva/config";
import { and, count, db, eq, gt } from "@stariva/db";
import { user } from "@stariva/db/schema";
import {
  StarivaChangeEmailEmail,
  StarivaMagicLinkEmail,
  StarivaResetPasswordEmail,
  StarivaSignInCodeEmail,
  StarivaVerifyEmail,
  sendEmail,
  signInCodeSubject,
} from "@stariva/emails";
import type { GenericEndpointContext } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
import { antispam } from "./antispam-plugin";
import { loginAudit, recordLoginEvent } from "./login-audit";
import {
  beginMagicLinkCapture,
  captureMagicLink,
  finishMagicLinkCapture,
} from "./magic-link-capture";
import { otpSignUp } from "./otp-sign-up-plugin";
import {
  SIGN_IN_CALLBACK_HEADER,
  SIGN_IN_CODE_ATTEMPTS,
  SIGN_IN_CODE_TTL_MINUTES,
} from "./sign-in-shared";
import { safeCallbackPath, verificationPageUrl } from "./verification-link";

const vercelUrl =
  env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.VERCEL_ENV === "preview" && env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : undefined;

const baseUrl = vercelUrl ?? env.APP_URL;
const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  : env.APP_URL;

/**
 * Серверный экземпляр better-auth для Stariva.
 *
 * - Вход и регистрация по коду из письма (emailOTP). В том же письме кнопка
 *   входа — магическая ссылка — для тех, кто читает почту на этом устройстве.
 *   Новый аккаунт — только с согласием на обработку ПДн (otp-sign-up-plugin).
 * - Пароль необязателен: им входят те, кто его задал. Регистрации по паролю
 *   нет, подтверждение email для старых аккаунтов осталось.
 * - Журнал входов, неудачных попыток, выходов и сбросов пароля (login-audit).
 * - Защита от массовых регистраций без капчи: токен формы, лимиты по часу и
 *   суткам, пауза между письмами на один ящик (см. antispam-plugin).
 * - nextCookies() должен идти последним плагином — он включает установку
 *   cookies из серверных экшенов Next.js.
 */
export const auth = initAuth({
  baseUrl,
  productionUrl,
  secret: env.AUTH_SECRET,
  requireEmailVerification: true,
  // Аккаунты заводит только вход по коду: там берём согласие на обработку ПДн
  disableSignUp: true,
  // emailOTP витрины подключён ниже со своими настройками и письмом
  emailOTP: false,
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 дней
    updateAge: 60 * 60 * 24, // обновлять сессию раз в сутки
  },
  // Лимиты на IP за час. Общий лимит better-auth (3 запроса за 10 секунд)
  // не мешал рассылать сотни писем в сутки.
  rateLimitRules: {
    "/sign-in/magic-link": { window: 60 * 60, max: 15 },
    "/request-password-reset": { window: 60 * 60, max: 5 },
    "/send-verification-email": { window: 60 * 60, max: 5 },
  },
  // Ссылки подтверждения ведут на страницу с кнопкой (verification-link.ts).
  sendVerificationEmail: async ({ email, url }) => {
    await sendEmail({
      to: [email],
      subject: "Подтвердите email — Stariva",
      react: StarivaVerifyEmail({ url: verificationPageUrl(url) }),
    });
  },
  changeEmail: {
    sendChangeEmailVerification: async ({ newEmail, url }) => {
      await sendEmail({
        to: [newEmail],
        subject: "Подтвердите смену email — Stariva",
        react: StarivaChangeEmailEmail({ url: verificationPageUrl(url) }),
      });
    },
  },
  onPasswordReset: async ({ userId }, request) => {
    await recordLoginEvent({
      userId,
      type: "password_reset",
      headers: request?.headers,
    });
  },
  extraPlugins: [
    loginAudit(),
    antispam({
      countRecentUnverified: async (since) => {
        const [row] = await db
          .select({ total: count() })
          .from(user)
          .where(and(eq(user.emailVerified, false), gt(user.createdAt, since)));
        return row?.total ?? 0;
      },
    }),
    emailOTP({
      expiresIn: SIGN_IN_CODE_TTL_MINUTES * 60,
      allowedAttempts: SIGN_IN_CODE_ATTEMPTS,
      storeOTP: "hashed",
      // Свой лимит плагина — 3 запроса в минуту с IP: столько раз человек
      // ошибается в цифре. От подбора защищает число попыток на код.
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        if (type !== "sign-in") return;
        await sendSignInCode(email, otp, ctx);
      },
    }),
    otpSignUp({ allowedAttempts: SIGN_IN_CODE_ATTEMPTS }),
    magicLink({
      // Аккаунт создаётся только регистрацией: там берём согласие на
      // обработку персональных данных. Ссылка лишь пускает в существующий.
      disableSignUp: true,
      expiresIn: 60 * 60, // 1 час (по умолчанию 5 минут)
      sendMagicLink: async ({ email, url, metadata }, ctx) => {
        if (captureMagicLink(metadata, url)) return;
        // Ответ одинаковый для любого email, но письмо с заведомо нерабочей
        // ссылкой незнакомому адресу не шлём.
        if (ctx) {
          const existing =
            await ctx.context.internalAdapter.findUserByEmail(email);
          if (!existing) return;
        }
        await sendEmail({
          to: [email],
          subject: "Вход в личный кабинет — Stariva",
          react: StarivaMagicLinkEmail({ url }),
        });
      },
    }),
    nextCookies(),
  ],
  // sendEmail здесь нужен только для письма о сбросе пароля
  sendEmail: async ({ email, url, type }) => {
    if (type === "forget-password") {
      if (!url) {
        console.error(
          `[Auth] Missing reset URL for forget-password email to ${email}`,
        );
        throw new Error(
          "Cannot send password reset email: reset URL is missing",
        );
      }
      await sendEmail({
        to: [email],
        subject: "Сброс пароля — Stariva",
        react: StarivaResetPasswordEmail({ url }),
      });
    }
  },
});

/**
 * Письмо с кодом входа. Тем, у кого аккаунт уже есть, кладём и кнопку
 * (магическую ссылку) — она ведёт туда, откуда человек пришёл на вход. Новым
 * только код: аккаунт появится после согласия на сайте.
 */
async function sendSignInCode(
  email: string,
  otp: string,
  ctx: GenericEndpointContext | undefined,
): Promise<void> {
  const existing = ctx
    ? await ctx.context.internalAdapter.findUserByEmail(email)
    : null;
  let url: string | null = null;
  if (existing) {
    const callbackURL = safeCallbackPath(
      ctx?.headers?.get(SIGN_IN_CALLBACK_HEADER) ?? null,
    );
    url = await signInLink(email, callbackURL, ctx?.headers).catch((error) => {
      console.error("[Auth] Не удалось сделать ссылку входа для письма", error);
      return null;
    });
  }
  await sendEmail({
    to: [email],
    subject: signInCodeSubject(otp),
    react: StarivaSignInCodeEmail({
      otp,
      url: url ?? undefined,
      isNewUser: !existing,
      expiresInMinutes: SIGN_IN_CODE_TTL_MINUTES,
    }),
  });
}

/** Магическая ссылка без отдельного письма (см. magic-link-capture). */
async function signInLink(
  email: string,
  callbackURL: string,
  headers: Headers | undefined,
): Promise<string | null> {
  const captureId = beginMagicLinkCapture();
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL,
        errorCallbackURL: "/sign-in",
        metadata: { captureId },
      },
      headers: headers ?? new Headers(),
    });
  } catch (error) {
    finishMagicLinkCapture(captureId);
    throw error;
  }
  return finishMagicLinkCapture(captureId);
}

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
