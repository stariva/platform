import { db } from "@stariva/db";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, oAuthProxy } from "better-auth/plugins";

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
   * Called to deliver the email-verification link (sent on sign-up when
   * `requireEmailVerification` is enabled).
   */
  sendVerificationEmail?: (data: {
    email: string;
    url: string;
  }) => Promise<void>;
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
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.requireEmailVerification ?? false,
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
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      emailOTP({
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
      ...(options.extraPlugins ?? []),
    ],
    // Вход через иностранные сервисы (Google и т. п.) не используется:
    // 149-ФЗ ограничивает способы авторизации пользователей российских сайтов.
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
