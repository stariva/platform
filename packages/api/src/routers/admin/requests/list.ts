import {
  count,
  customOrderRequests,
  desc,
  eq,
  or,
  type SQL,
  sql,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { requestFields } from "./fields";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Заявки с сайта, свежие сверху: форма на главной и заказ своего варианта
 * из карточки товара. Поиск — по номеру (с «№» или без) и по тексту заявки:
 * имени, контакту, описанию.
 *
 * @example client.admin.requests.list({ query: "1042", limit: 25, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    let where: SQL | undefined;
    if (input.query) {
      const number = /^№?\s*(\d{1,9})$/.exec(input.query)?.[1];
      const text = sql`${customOrderRequests.message} ilike ${`%${escapeLike(input.query)}%`}`;
      where = number
        ? or(eq(customOrderRequests.number, Number(number)), text)
        : text;
    }

    const [rows, [totals]] = await Promise.all([
      context.db
        .select(requestFields)
        .from(customOrderRequests)
        .where(where)
        .orderBy(desc(customOrderRequests.number))
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ total: count() })
        .from(customOrderRequests)
        .where(where),
    ]);

    return { items: rows, total: totals?.total ?? 0 };
  });
