import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/** Максимум для integer в PostgreSQL, цена хранится в копейках. */
const MAX_RUBLES = 21_474_836;

/** Правка цены прямо из таблицы товаров. */
export const setPrice = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      price: z
        .number({ error: "Укажите цену" })
        .positive("Цена должна быть больше нуля")
        .max(MAX_RUBLES),
    }),
  )
  .handler(async ({ context, input }) => {
    const price = Math.round(input.price * 100);

    const [current] = await context.db
      .select({
        category: products.category,
        slug: products.slug,
        oldPrice: products.oldPrice,
      })
      .from(products)
      .where(eq(products.id, input.id));
    if (!current) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }
    if (current.oldPrice !== null && current.oldPrice <= price) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Цена должна быть меньше старой (${current.oldPrice / 100} ₽). Старую цену меняют в карточке товара`,
      });
    }

    await context.db
      .update(products)
      .set({ price })
      .where(eq(products.id, input.id));

    const revalidated = await revalidateStorefront(storefrontPaths(current));
    return { price: price / 100, revalidated };
  });
