import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth/user";

/**
 * Диалог посетителя с Никой — ИИ-помощницей на сайте. id — sessionId виджета:
 * он живёт, пока открыта вкладка, поэтому после перезагрузки страницы
 * начинается новый диалог.
 *
 * Политика конфиденциальности обещает хранить переписку не дольше года.
 */
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: text("id").primaryKey(),
    // Если посетитель вошёл в личный кабинет. Удалили аккаунт — переписка
    // остаётся анонимной.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Страница, с которой написали первое сообщение (только путь)
    page: text("page"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_conversations_last_message_idx").on(table.lastMessageAt),
    index("chat_conversations_user_id_idx").on(table.userId),
  ],
);

export const chatMessageRole = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

/**
 * Одно сообщение диалога. Пишет только сервер: вопрос посетителя — последнее
 * сообщение запроса, ответ — то, что сгенерировала модель. Историю, которую
 * присылает браузер, не сохраняем: её можно подделать.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    role: chatMessageRole("role").notNull(),
    // Части UIMessage из AI SDK: текст и вызовы инструментов с результатами
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.id] }),
    index("chat_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
