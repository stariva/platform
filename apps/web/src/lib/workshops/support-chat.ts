import { db, eq } from "@stariva/db";
import { workshops } from "@stariva/db/schema";
import { cache } from "react";

/**
 * Ссылка на закрытый чат поддержки курса (поле «Чат поддержки» в админке) или
 * null, если у курса его нет.
 *
 * Приглашение видят только купившие, поэтому его нет в `Workshop`: этот тип
 * уходит на витрину и в клиентские компоненты. Вызывают только серверные
 * страницы кабинета и «Вы записаны», уже проверив доступ.
 *
 * Ошибку базы не глотаем: страница кабинета и так упала бы на соседних
 * запросах, а молча пропавший чат выглядел бы как «у курса его нет».
 */
export const getSupportChatUrl = cache(
  async (workshopSlug: string): Promise<string | null> => {
    const [row] = await db
      .select({ supportChatUrl: workshops.supportChatUrl })
      .from(workshops)
      .where(eq(workshops.slug, workshopSlug))
      .limit(1);
    return row?.supportChatUrl || null;
  },
);
