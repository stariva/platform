import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/** Максимум для integer в PostgreSQL, цена хранится в копейках. */
const MAX_RUBLES = 21_474_836;

/** Правка старой цены прямо из таблицы товаров; `null` или 0 убирают скидку. */
export const setOldPrice = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      oldPrice: z
        .number({ error: "Укажите старую цену" })
        .min(0, "Старая цена не может быть отрицательной")
        .max(MAX_RUBLES)
        .nullable(),
    }),
  )
  .handler(async ({ context, input }) => {
    const kopecks =
      input.oldPrice === null ? 0 : Math.round(input.oldPrice * 100);
    const oldPrice = kopecks === 0 ? null : kopecks;

    const [current] = await context.db
      .select({
        category: products.category,
        slug: products.slug,
        price: products.price,
      })
      .from(products)
      .where(eq(products.id, input.id));
    if (!current) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }
    if (oldPrice !== null && oldPrice <= current.price) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Старая цена должна быть больше текущей (${current.price / 100} ₽)`,
      });
    }

    await context.db
      .update(products)
      .set({ oldPrice })
      .where(eq(products.id, input.id));

    const revalidated = await revalidateStorefront(storefrontPaths(current));
    return {
      oldPrice: oldPrice === null ? null : oldPrice / 100,
      revalidated,
    };
  });
