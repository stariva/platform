import { db } from "@stariva/db";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";

/** Возвращает origin'ы вместе с их www/без-www парами, без дублей. */
function withWwwVariants(urls: string[]): string[] {
  const origins = new Set<string>();
  for (const url of urls) {
    const { protocol, host } = new URL(url);
    origins.add(`${protocol}//${host}`);
    if (host === "localhost" || host.startsWith("localhost:")) continue;
    const twin = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    origins.add(`${protocol}//${twin}`);
  }
  return [...origins];
}

/**
 * Адрес из списка администраторов ADMIN_EMAILS (через запятую, без учёта
 * регистра). Сам по себе прав не даёт — см. isAdminUser.
 *
 * @example ADMIN_EMAILS=admin@example.com,ops@example.com
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Права администратора: адрес из ADMIN_EMAILS и подтверждённая почта.
 * Без подтверждения любой мог бы зарегистрироваться на адрес админа, ещё не
 * заведённый в базе, и сразу получить админку.
 */
export function isAdminUser(user: {
  email: string;
  emailVerified: boolean;
}): boolean {
  return user.emailVerified === true && isAdminEmail(user.email);
}

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  sendEmail?: (data: {
    email: string;
    otp?: string;
    url?: string;
    type: "sign-in" | "email-verification" | "forget-password" | "change-email";
  }) => Promise<void>;
  /**
   * Require users to verify their email before signing in. Defaults to
   * false to preserve existing app behavior.
   */
  requireEmailVerification?: boolean;
  /**
   * Запретить создание аккаунтов (регистрация по паролю и вход по коду на
   * новый адрес). Войти можно только в уже существующий аккаунт.
   */
  disableSignUp?: boolean;
  /**
   * Вход по одноразовому коду из письма через `sendEmail`. По умолчанию
   * включён (им входят в админку). Витрина подключает emailOTP сама, со своим
   * письмом и числом попыток, и выключает этот.
   */
  emailOTP?: boolean;
  /**
   * Called to deliver the email-verification link (sent on sign-up when
   * `requireEmailVerification` is enabled).
   */
  sendVerificationEmail?: (data: {
    email: string;
    url: string;
  }) => Promise<void>;
  /** Called after a user has set a new password through the reset link. */
  onPasswordReset?: (
    data: { userId: string },
    request?: Request,
  ) => Promise<void>;
  /** Enables the change-email flow and wires up its verification email. */
  changeEmail?: {
    sendChangeEmailVerification: (data: {
      newEmail: string;
      url: string;
    }) => Promise<void>;
  };
  session?: {
    /** Session lifetime in seconds. */
    expiresIn?: number;
    /** How often the session expiry is refreshed, in seconds. */
    updateAge?: number;
  };
  /**
   * Более жёсткие лимиты для отдельных эндпоинтов вместо общего (на IP).
   * Ключ — путь эндпоинта, например "/sign-up/email".
   */
  rateLimitRules?: Record<string, { window: number; max: number }>;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    // Доверяем и основному домену, и его www-варианту (и наоборот), иначе
    // better-auth отклоняет запросы с "Invalid origin".
    trustedOrigins: withWwwVariants([options.baseUrl, options.productionUrl]),
    /**
     * Built-in rate limiting protects auth endpoints (sign-in, OTP, password
     * reset) from brute-force and abuse. Tune per environment as needed.
     * @see https://www.better-auth.com/docs/concepts/rate-limit
     */
    // IP для лимитов: x-real-ip перезаписывает ingress (Traefik), а начало
    // x-forwarded-for может прислать сам клиент — только запасной вариант
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      ...(options.rateLimitRules
        ? { customRules: options.rateLimitRules }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.requireEmailVerification ?? false,
      disableSignUp: options.disableSignUp ?? false,
      onPasswordReset: async ({ user }, request) => {
        await options.onPasswordReset?.({ userId: user.id }, request);
      },
      sendResetPassword: async ({ user, url }) => {
        if (options.sendEmail) {
          await options.sendEmail({
            email: user.email,
            url,
            type: "forget-password",
          });
        }
      },
    },
    ...(options.sendVerificationEmail
      ? {
          emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => {
              await options.sendVerificationEmail?.({
                email: user.email,
                url,
              });
            },
          },
        }
      : {}),
    ...(options.changeEmail
      ? {
          user: {
            changeEmail: {
              enabled: true,
              sendChangeEmailConfirmation: async ({
                newEmail,
                url,
              }: {
                newEmail: string;
                url: string;
              }) => {
                await options.changeEmail?.sendChangeEmailVerification({
                  newEmail,
                  url,
                });
              },
            },
          },
        }
      : {}),
    ...(options.session ? { session: options.session } : {}),
    // Вход через иностранные сервисы (Google и т. п.) не используется:
    // 149-ФЗ ограничивает способы авторизации пользователей российских сайтов.
    // Поэтому и oAuthProxy, нужный только для них, не подключаем.
    plugins: [
      ...(options.emailOTP === false
        ? []
        : [
            emailOTP({
              disableSignUp: options.disableSignUp ?? false,
              async sendVerificationOTP(data) {
                if (options.sendEmail) {
                  await options.sendEmail({
                    email: data.email,
                    otp: data.otp,
                    type: data.type,
                  });
                }
              },
            }),
          ]),
      ...(options.extraPlugins ?? []),
    ],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
