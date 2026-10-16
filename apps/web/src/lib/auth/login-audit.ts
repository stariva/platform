import { and, db, eq, lt } from "@stariva/db";
import {
  type LoginEventType,
  type LoginMethod,
  loginEvent,
} from "@stariva/db/schema";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { collectVisitor } from "../visitor";

/** Записи старше года не нужны: чистим при очередном входе того же человека. */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/** Способ входа по эндпоинту, который создал сессию. */
export function loginMethodFromPath(path: string | undefined): LoginMethod {
  switch (path) {
    case "/sign-in/email":
    case "/sign-up/email":
      return "password";
    case "/magic-link/verify":
      return "magic_link";
    case "/sign-in/email-otp":
      return "email_otp";
    case "/verify-email":
    case "/email-otp/verify-email":
      return "email_verification";
    default:
      return "other";
  }
}

interface LoginEventInput {
  userId: string;
  type: LoginEventType;
  method?: LoginMethod;
  failureReason?: string;
  sessionId?: string;
  headers?: Headers;
}

/**
 * Пишет событие в журнал входов. Не бросает исключений: сбой журнала не должен
 * мешать человеку войти или выйти. Записи без запроса (вызов с сервера) идут
 * без IP и устройства.
 */
export async function recordLoginEvent(input: LoginEventInput): Promise<void> {
  try {
    const visitor = await collectVisitor({
      headers: input.headers ?? new Headers(),
    });
    await db.insert(loginEvent).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      method: input.method,
      failureReason: input.failureReason,
      sessionId: input.sessionId,
      ipAddress: visitor.ip,
      userAgent: visitor.userAgent,
      visitor,
    });
    if (input.type === "sign_in") {
      await db
        .delete(loginEvent)
        .where(
          and(
            eq(loginEvent.userId, input.userId),
            lt(loginEvent.createdAt, new Date(Date.now() - RETENTION_MS)),
          ),
        );
    }
  } catch (error) {
    console.error("[login-audit] failed to record event", error);
  }
}

/**
 * Журнал входов: каждый вход (любым способом), неудачная попытка с паролем для
 * существующего аккаунта и выход.
 *
 * - Успешные входы ловим на создании сессии: так попадают и пароль, и ссылка
 *   из письма, и код, и вход после подтверждения почты.
 * - Попытки с несуществующим email не пишем: к пользователю их не привязать,
 *   а таблица стала бы свалкой чужих адресов от ботов.
 * - Сброс пароля пишет `onPasswordReset` в server.ts.
 */
export function loginAudit() {
  return {
    id: "login-audit",
    init() {
      return {
        options: {
          databaseHooks: {
            session: {
              create: {
                async after(session, context) {
                  await recordLoginEvent({
                    userId: session.userId,
                    type: "sign_in",
                    method: loginMethodFromPath(context?.path),
                    sessionId: session.id,
                    headers: context?.headers ?? context?.request?.headers,
                  });
                },
              },
              delete: {
                async before(session, context) {
                  // Сессии исчезают и сами (срок, «выйти везде» в админке):
                  // это не выход человека.
                  if (context?.path !== "/sign-out") return;
                  await recordLoginEvent({
                    userId: session.userId,
                    type: "sign_out",
                    sessionId: session.id,
                    headers: context.headers ?? context.request?.headers,
                  });
                },
              },
            },
          },
        },
      };
    },
    hooks: {
      after: [
        {
          matcher: (ctx) =>
            ctx.path === "/sign-in/email" || ctx.path === "/sign-in/email-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const error = ctx.context.returned;
            if (!(error instanceof APIError)) return;
            const email = (ctx.body as { email?: unknown } | undefined)?.email;
            if (typeof email !== "string" || !email) return;
            try {
              const found = await ctx.context.internalAdapter.findUserByEmail(
                email.trim().toLowerCase(),
              );
              if (!found) return;
              const code = (error.body as { code?: unknown } | undefined)?.code;
              await recordLoginEvent({
                userId: found.user.id,
                type: "sign_in_failed",
                method: loginMethodFromPath(ctx.path),
                failureReason:
                  typeof code === "string" ? code : String(error.status),
                headers: ctx.headers ?? ctx.request?.headers,
              });
            } catch (lookupError) {
              console.error("[login-audit] failed attempt lookup", lookupError);
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
