import { ORPCError } from "@orpc/server";
import { eq, products, sql } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Убирает фото из товара сразу, без кнопки «Сохранить»: остальные правки формы
 * не трогаем, поэтому вырезаем только этот адрес из массива в базе. Сам файл в
 * бакете остаётся.
 */
export const removeImage = adminProcedure
  .input(z.object({ id: z.string().min(1), url: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(products)
      .set({ images: sql`array_remove(${products.images}, ${input.url})` })
      .where(eq(products.id, input.id))
      .returning({ category: products.category, slug: products.slug });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }

    const revalidated = await revalidateStorefront(storefrontPaths(updated));
    return { revalidated };
  });
