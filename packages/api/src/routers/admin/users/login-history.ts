import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  LOGIN_EVENT_TYPES,
  loginEvent,
  session,
  sql,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

const FAILED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Журнал входов пользователя: входы (способ, IP, место, устройство), неудачные
 * попытки, выходы и сбросы пароля, от новых к старым.
 *
 * Сверх списка отдаёт сводку (всего входов, разных IP, последний вход, неудачи
 * за 30 дней, живые сессии). У каждого входа помечено, жива ли его сессия и
 * впервые ли человек зашёл с этого IP.
 *
 * @example client.admin.users.loginHistory({ id, type: "sign_in_failed", limit: 50 })
 */
export const loginHistory = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      type: z.enum(LOGIN_EVENT_TYPES).optional(),
      limit: z.number().int().min(1).max(200).default(25),
    }),
  )
  .handler(async ({ context, input }) => {
    const ofUser = eq(loginEvent.userId, input.id);
    const where = input.type
      ? and(ofUser, eq(loginEvent.type, input.type))
      : ofUser;
    const failedSince = new Date(Date.now() - FAILED_WINDOW_MS);

    const [events, [filtered], [stats], [lastSignIn], [live]] =
      await Promise.all([
        context.db
          .select({
            id: loginEvent.id,
            type: loginEvent.type,
            method: loginEvent.method,
            failureReason: loginEvent.failureReason,
            ipAddress: loginEvent.ipAddress,
            userAgent: loginEvent.userAgent,
            visitor: loginEvent.visitor,
            createdAt: loginEvent.createdAt,
            sessionActive: sql<boolean>`${session.id} is not null`,
            // Столбцы пишем с именем таблицы: в подзапросе голые "user_id"
            // и "ip_address" были бы колонками самого подзапроса.
            isNewIp: sql<boolean>`(
              "login_events"."type" = 'sign_in'
              and "login_events"."ip_address" is not null
              and not exists (
                select 1 from "login_events" as "earlier"
                where "earlier"."user_id" = "login_events"."user_id"
                  and "earlier"."ip_address" = "login_events"."ip_address"
                  and "earlier"."type" = 'sign_in'
                  and "earlier"."created_at" < "login_events"."created_at"
              )
            )`,
          })
          .from(loginEvent)
          .leftJoin(
            session,
            and(
              eq(session.id, loginEvent.sessionId),
              gt(session.expiresAt, new Date()),
            ),
          )
          .where(where)
          .orderBy(desc(loginEvent.createdAt))
          .limit(input.limit),
        context.db.select({ total: count() }).from(loginEvent).where(where),
        context.db
          .select({
            signIns: sql<number>`count(*) filter (where ${loginEvent.type} = 'sign_in')::int`,
            uniqueIps: sql<number>`count(distinct ${loginEvent.ipAddress}) filter (where ${loginEvent.type} = 'sign_in')::int`,
            failedRecently: sql<number>`count(*) filter (where ${loginEvent.type} = 'sign_in_failed' and ${gte(loginEvent.createdAt, failedSince)})::int`,
          })
          .from(loginEvent)
          .where(ofUser),
        context.db
          .select({
            createdAt: loginEvent.createdAt,
            ipAddress: loginEvent.ipAddress,
            visitor: loginEvent.visitor,
          })
          .from(loginEvent)
          .where(and(ofUser, eq(loginEvent.type, "sign_in")))
          .orderBy(desc(loginEvent.createdAt))
          .limit(1),
        context.db
          .select({ total: count() })
          .from(session)
          .where(
            and(
              eq(session.userId, input.id),
              gt(session.expiresAt, new Date()),
            ),
          ),
      ]);

    return {
      events,
      total: filtered?.total ?? 0,
      summary: {
        signIns: stats?.signIns ?? 0,
        uniqueIps: stats?.uniqueIps ?? 0,
        failedRecently: stats?.failedRecently ?? 0,
        activeSessions: live?.total ?? 0,
        lastSignIn: lastSignIn ?? null,
      },
    };
  });
