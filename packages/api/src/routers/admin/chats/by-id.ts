import { ORPCError } from "@orpc/server";
import { asc, chatConversations, chatMessages, eq, user } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toTranscriptParts } from "./text";

/**
 * Один диалог с Никой целиком: кто писал и все сообщения по порядку.
 * Вызовы инструментов сведены к короткой подписи — что Ника показала.
 *
 * Бросает NOT_FOUND, если диалога с таким id нет.
 */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select({
        id: chatConversations.id,
        page: chatConversations.page,
        createdAt: chatConversations.createdAt,
        lastMessageAt: chatConversations.lastMessageAt,
        userId: chatConversations.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(chatConversations)
      .leftJoin(user, eq(user.id, chatConversations.userId))
      .where(eq(chatConversations.id, input.id));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Диалог не найден" });
    }

    const messages = await context.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, input.id))
      .orderBy(asc(chatMessages.createdAt));

    return {
      ...found,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        createdAt: message.createdAt,
        parts: toTranscriptParts(message.parts),
      })),
    };
  });
