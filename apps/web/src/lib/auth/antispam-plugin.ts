import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  canonicalEmail,
  checkFormToken,
  createCooldown,
  looksLikeGibberishName,
} from "./antispam";
import { FORM_TOKEN_HEADER } from "./form-token-shared";

/** Эндпоинты, которые отправляют письма или заводят аккаунты. */
const GUARDED_PATHS = new Set([
  "/sign-up/email",
  "/sign-in/magic-link",
  "/request-password-reset",
  "/send-verification-email",
]);

/** Новых неподтверждённых аккаунтов в сутки, после чего регистрация встаёт. */
const MAX_NEW_UNVERIFIED_PER_DAY = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Повторное письмо на тот же ящик — не раньше, чем через минуту. */
const EMAIL_COOLDOWN_MS = 60 * 1000;

const REFRESH_PAGE = "Обновите страницу и попробуйте снова.";

const TOKEN_ERRORS = {
  missing: `Не удалось проверить форму. ${REFRESH_PAGE}`,
  invalid: `Не удалось проверить форму. ${REFRESH_PAGE}`,
  expired: `Страница устарела. ${REFRESH_PAGE}`,
  "too-fast": "Слишком быстро. Попробуйте ещё раз.",
} as const;

export interface AntispamOptions {
  /** Сколько неподтверждённых аккаунтов создано начиная с `since`. */
  countRecentUnverified: (since: Date) => Promise<number>;
}

/**
 * Проверки перед запросами из браузера. Вызовы `auth.api.*` с сервера
 * (покупка мастер-класса, письма о нём) идут без `request` и не проверяются:
 * там нет формы, и адрес уже проверил наш код.
 */
export function antispam({ countRecentUnverified }: AntispamOptions) {
  const emailCooldown = createCooldown(EMAIL_COOLDOWN_MS);

  return {
    id: "antispam",
    hooks: {
      before: [
        {
          matcher: (ctx) => GUARDED_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            if (!ctx.request) return;

            const reject = (
              status:
                | "BAD_REQUEST"
                | "TOO_MANY_REQUESTS"
                | "SERVICE_UNAVAILABLE",
              reason: string,
              message: string,
            ): never => {
              console.warn(`[antispam] ${ctx.path} rejected: ${reason}`);
              throw new APIError(status, { message, code: "ANTISPAM" });
            };

            const createsNewAccount = async (
              path: string | undefined,
              address: string,
            ): Promise<boolean> => {
              if (path === "/sign-up/email") return true;
              if (path !== "/sign-in/magic-link" || !address) return false;
              const found = await ctx.context.internalAdapter.findUserByEmail(
                address.trim().toLowerCase(),
              );
              return !found;
            };

            const verdict = checkFormToken(
              ctx.headers?.get(FORM_TOKEN_HEADER),
              ctx.context.secret,
            );
            if (verdict !== "ok") {
              return reject(
                "BAD_REQUEST",
                `form token ${verdict}`,
                TOKEN_ERRORS[verdict],
              );
            }

            const body = (ctx.body ?? {}) as {
              email?: unknown;
              name?: unknown;
            };
            const email = typeof body.email === "string" ? body.email : "";

            if (ctx.path === "/sign-up/email") {
              const name =
                typeof body.name === "string" ? body.name.trim() : "";
              if (!name || looksLikeGibberishName(name)) {
                return reject(
                  "BAD_REQUEST",
                  "bad name",
                  "Укажите настоящее имя.",
                );
              }
            }

            if (await createsNewAccount(ctx.path, email)) {
              const since = new Date(Date.now() - DAY_MS);
              if (
                (await countRecentUnverified(since)) >=
                MAX_NEW_UNVERIFIED_PER_DAY
              ) {
                console.error(
                  `[antispam] daily limit of ${MAX_NEW_UNVERIFIED_PER_DAY} unverified sign-ups reached; sign-ups are paused`,
                );
                return reject(
                  "SERVICE_UNAVAILABLE",
                  "daily sign-up limit",
                  "Регистрация временно недоступна. Попробуйте позже или напишите нам.",
                );
              }
            }

            if (email && emailCooldown.take(canonicalEmail(email)) > 0) {
              return reject(
                "TOO_MANY_REQUESTS",
                "email cooldown",
                "Письмо на этот адрес уже отправлено. Проверьте почту или повторите через минуту.",
              );
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
