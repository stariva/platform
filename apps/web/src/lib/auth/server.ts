import "server-only";

import { initAuth } from "@stariva/auth";
import { env } from "@stariva/config";
import { and, count, db, eq, gt } from "@stariva/db";
import { user } from "@stariva/db/schema";
import {
  StarivaChangeEmailEmail,
  StarivaMagicLinkEmail,
  StarivaResetPasswordEmail,
  StarivaVerifyEmail,
  sendEmail,
} from "@stariva/emails";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { antispam } from "./antispam-plugin";
import { captureMagicLink } from "./magic-link-capture";
import { verificationPageUrl } from "./verification-link";

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
 * - Email + пароль с обязательным подтверждением email.
 * - Вход по магической ссылке (passwordless).
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
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 дней
    updateAge: 60 * 60 * 24, // обновлять сессию раз в сутки
  },
  // Лимиты на IP за час. Общий лимит better-auth (3 запроса за 10 секунд)
  // не мешал рассылать сотни писем в сутки.
  rateLimitRules: {
    "/sign-up/email": { window: 60 * 60, max: 10 },
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
  extraPlugins: [
    antispam({
      countRecentUnverified: async (since) => {
        const [row] = await db
          .select({ total: count() })
          .from(user)
          .where(and(eq(user.emailVerified, false), gt(user.createdAt, since)));
        return row?.total ?? 0;
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url, metadata }) => {
        if (captureMagicLink(metadata, url)) return;
        await sendEmail({
          to: [email],
          subject: "Вход в личный кабинет — Stariva",
          react: StarivaMagicLinkEmail({ url }),
        });
      },
    }),
    nextCookies(),
  ],
  // sendEmail is used by the internal emailOTP plugin and password reset
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

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
