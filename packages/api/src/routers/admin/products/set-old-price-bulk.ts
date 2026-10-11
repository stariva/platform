import { eq, inArray, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/** Максимум для integer в PostgreSQL, цена хранится в копейках. */
const MAX_RUBLES = 21_474_836;

/**
 * Массовая правка старой цены:
 * - `fixed` — одна и та же старая цена (товары, у которых цена не ниже, пропускаются);
 * - `markup` — старая цена = цена + процент, округлённая до целых рублей;
 * - `clear` — убрать старую цену.
 */
export const setOldPriceBulk = adminProcedure
  .input(
    z.object({
      ids: z.array(z.string().min(1)).min(1).max(500),
      change: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("fixed"),
          oldPrice: z
            .number({ error: "Укажите старую цену" })
            .positive("Старая цена должна быть больше нуля")
            .max(MAX_RUBLES),
        }),
        z.object({
          type: z.literal("markup"),
          percent: z
            .number({ error: "Укажите процент" })
            .positive("Процент должен быть больше нуля")
            .max(1000),
        }),
        z.object({ type: z.literal("clear") }),
      ]),
    }),
  )
  .handler(async ({ context, input }) => {
    const { change } = input;
    const rows = await context.db
      .select({
        id: products.id,
        category: products.category,
        slug: products.slug,
        price: products.price,
        oldPrice: products.oldPrice,
      })
      .from(products)
      .where(inArray(products.id, input.ids));

    const updates = rows.flatMap((row) => {
      const oldPrice =
        change.type === "clear"
          ? null
          : change.type === "fixed"
            ? Math.round(change.oldPrice * 100)
            : Math.round((row.price * (1 + change.percent / 100)) / 100) * 100;
      if (oldPrice !== null && oldPrice <= row.price) return [];
      if (oldPrice === row.oldPrice) return [];
      return [{ row, oldPrice }];
    });

    if (updates.length > 0) {
      await context.db.transaction(async (tx) => {
        for (const { row, oldPrice } of updates) {
          await tx
            .update(products)
            .set({ oldPrice })
            .where(eq(products.id, row.id));
        }
      });
    }

    const revalidated =
      updates.length > 0
        ? await revalidateStorefront(
            storefrontPaths(...updates.map(({ row }) => row)),
          )
        : true;

    return {
      updated: updates.length,
      /** Не тронуты: цена не ниже новой старой цены или значение уже такое. */
      skipped: input.ids.length - updates.length,
      revalidated,
    };
  });
