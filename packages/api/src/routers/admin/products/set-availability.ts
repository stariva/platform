import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Быстрые переключатели из таблицы товаров: показывать на сайте и можно ли
 * сплести под заказ. Остаток («в наличии») правится отдельно, в setStock.
 */
export const setAvailability = adminProcedure
  .input(
    z
      .object({
        id: z.string().min(1),
        published: z.boolean().optional(),
        madeToOrder: z.boolean().optional(),
      })
      .refine((v) => v.published !== undefined || v.madeToOrder !== undefined),
  )
  .handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(products)
      .set({
        ...(input.published !== undefined && {
          status: input.published ? "published" : "draft",
        }),
        ...(input.madeToOrder !== undefined && {
          madeToOrder: input.madeToOrder,
        }),
      })
      .where(eq(products.id, input.id))
      .returning({
        category: products.category,
        slug: products.slug,
        status: products.status,
        madeToOrder: products.madeToOrder,
      });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }

    const revalidated = await revalidateStorefront(storefrontPaths(updated));
    return {
      status: updated.status,
      madeToOrder: updated.madeToOrder,
      revalidated,
    };
  });
