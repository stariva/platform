import {
  and,
  chatConversations,
  count,
  desc,
  eq,
  type SQL,
  sql,
  user,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { previewText } from "./text";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Диалоги с Никой, свежие сверху: кто писал, с какой страницы, сколько
 * сообщений и начало первого вопроса. Поиск — по тексту всех сообщений.
 *
 * @example client.admin.chats.list({ query: "абажур", limit: 25, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      userId: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const filters: SQL[] = [];
    if (input.userId) filters.push(eq(chatConversations.userId, input.userId));
    if (input.query) {
      // parts — jsonb, в текстовом виде кириллица остаётся как есть
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(
        sql`exists (select 1 from "chat_messages" where "chat_messages".conversation_id = "chat_conversations".id and "chat_messages".parts::text ilike ${pattern})`,
      );
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [totals]] = await Promise.all([
      context.db
        .select({
          id: chatConversations.id,
          page: chatConversations.page,
          createdAt: chatConversations.createdAt,
          lastMessageAt: chatConversations.lastMessageAt,
          userId: chatConversations.userId,
          userName: user.name,
          userEmail: user.email,
          messagesCount: sql<number>`(select count(*)::int from "chat_messages" where "chat_messages".conversation_id = "chat_conversations".id)`,
          firstQuestion: sql<
            unknown[] | null
          >`(select parts from "chat_messages" where "chat_messages".conversation_id = "chat_conversations".id and "chat_messages".role = 'user' order by "chat_messages".created_at limit 1)`,
        })
        .from(chatConversations)
        .leftJoin(user, eq(user.id, chatConversations.userId))
        .where(where)
        .orderBy(
          desc(chatConversations.lastMessageAt),
          desc(chatConversations.id),
        )
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ total: count() })
        .from(chatConversations)
        .where(where),
    ]);

    return {
      items: rows.map(({ firstQuestion, ...row }) => ({
        ...row,
        preview: previewText(firstQuestion ?? []),
      })),
      total: totals?.total ?? 0,
    };
  });
