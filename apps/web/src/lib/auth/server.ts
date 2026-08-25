import "server-only";

import { initAuth } from "@stariva/auth";
import { env } from "@stariva/config";
import {
  StarivaChangeEmailEmail,
  StarivaMagicLinkEmail,
  StarivaResetPasswordEmail,
  StarivaVerifyEmail,
  sendEmail,
} from "@stariva/emails";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

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
 * - nextCookies() должен идти последним плагином — он включает установку
 *   cookies из серверных экшенов Next.js.
 */
export const auth = initAuth({
  baseUrl,
  productionUrl,
  secret: env.AUTH_SECRET,
  googleClientId: env.AUTH_GOOGLE_ID,
  googleClientSecret: env.AUTH_GOOGLE_SECRET,
  requireEmailVerification: true,
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 дней
    updateAge: 60 * 60 * 24, // обновлять сессию раз в сутки
  },
  sendVerificationEmail: async ({ email, url }) => {
    await sendEmail({
      to: [email],
      subject: "Подтвердите email — Stariva",
      react: StarivaVerifyEmail({ url }),
    });
  },
  changeEmail: {
    sendChangeEmailVerification: async ({ newEmail, url }) => {
      await sendEmail({
        to: [newEmail],
        subject: "Подтвердите смену email — Stariva",
        react: StarivaChangeEmailEmail({ url }),
      });
    },
  },
  extraPlugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
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
