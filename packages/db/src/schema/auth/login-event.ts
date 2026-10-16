import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { VisitorInfo } from "../visitor";
import { user } from "./user";

export const LOGIN_EVENT_TYPES = [
  "sign_in",
  "sign_in_failed",
  "sign_out",
  "password_reset",
] as const;
export type LoginEventType = (typeof LOGIN_EVENT_TYPES)[number];

export const LOGIN_METHODS = [
  "password",
  "magic_link",
  "email_otp",
  "email_verification",
  "other",
] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

/**
 * Журнал входов и выходов. Сессии better-auth удаляются при выходе и по
 * истечении срока, поэтому историю они не хранят: здесь остаётся след каждого
 * входа (с IP, местом и устройством), неудачной попытки, выхода и сброса пароля.
 *
 * Строки не привязаны к sessions: сессия исчезает, запись о ней — нет.
 * Удаляются только вместе с пользователем.
 */
export const loginEvent = pgTable(
  "login_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: LOGIN_EVENT_TYPES }).notNull(),
    // Как вошёл: пароль, ссылка из письма, код из письма. Пусто у выхода.
    method: text("method", { enum: LOGIN_METHODS }),
    // Код ошибки better-auth у неудачной попытки: INVALID_EMAIL_OR_PASSWORD и т. п.
    failureReason: text("failure_reason"),
    // id сессии, которую вход создал или выход завершил (без внешнего ключа).
    sessionId: text("session_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    // Город, провайдер, браузер, ОС, часовой пояс: всё, что известно по запросу.
    visitor: jsonb("visitor").$type<VisitorInfo>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("login_events_user_created_idx").on(table.userId, table.createdAt),
    index("login_events_user_ip_idx").on(table.userId, table.ipAddress),
  ],
);
