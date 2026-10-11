import { randomUUID } from "node:crypto";
import { chatConversations, chatMessages, db } from "@stariva/db";
import type { UIMessage } from "ai";
import { eq, sql } from "drizzle-orm";

/**
 * Переписка с Никой для админки. Ошибки базы не должны ломать чат,
 * поэтому обе функции только логируют их.
 */

/**
 * Создаёт диалог при первом сообщении и сохраняет вопрос посетителя.
 * Повтор с тем же id сообщения ничего не дублирует.
 */
export async function saveUserMessage(options: {
  conversationId: string;
  userId: string | null;
  page: string | null;
  message: UIMessage;
}) {
  try {
    await db
      .insert(chatConversations)
      .values({
        id: options.conversationId,
        userId: options.userId,
        page: options.page,
      })
      .onConflictDoUpdate({
        target: chatConversations.id,
        set: {
          lastMessageAt: sql`now()`,
          // Посетитель мог войти в кабинет посреди диалога
          userId: sql`coalesce(${chatConversations.userId}, excluded.user_id)`,
        },
      });
    await db
      .insert(chatMessages)
      .values({
        conversationId: options.conversationId,
        id: options.message.id || randomUUID(),
        role: "user",
        parts: options.message.parts,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[ai/chat] failed to save user message:", error);
  }
}

/** Сохраняет ответ Ники, если в нём есть хоть что-то. */
export async function saveAssistantMessage(options: {
  conversationId: string;
  message: UIMessage;
}) {
  // step-start — служебные разделители шагов, читать их в админке незачем
  const parts = options.message.parts.filter(
    (part) => part.type !== "step-start",
  );
  if (parts.length === 0) return;
  try {
    await db
      .insert(chatMessages)
      .values({
        conversationId: options.conversationId,
        id: options.message.id || randomUUID(),
        role: "assistant",
        parts,
      })
      .onConflictDoNothing();
    await db
      .update(chatConversations)
      .set({ lastMessageAt: sql`now()` })
      .where(eq(chatConversations.id, options.conversationId));
  } catch (error) {
    console.error("[ai/chat] failed to save assistant message:", error);
  }
}
