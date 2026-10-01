import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Остаток готовых изделий. Ведётся у нас: Ozon нужен только для доставки,
 * поэтому остаток правится здесь, а при оплате заказа списывается сам.
 */
export const setStock = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      stockAvailable: z
        .number({ error: "Укажите количество" })
        .int("Количество должно быть целым")
        .min(0, "Остаток не может быть отрицательным")
        .max(9999),
    }),
  )
  .handler(async ({ context, input }) => {
    const [current] = await context.db
      .select({
        category: products.category,
        slug: products.slug,
        ozonSku: products.ozonSku,
      })
      .from(products)
      .where(eq(products.id, input.id));
    if (!current) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }
    // Без SKU Ozon Доставка товар не отправит, поэтому готовым он быть не может
    if (input.stockAvailable > 0 && current.ozonSku === null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "У товара нет SKU Ozon — его можно продавать только под заказ",
      });
    }

    await context.db
      .update(products)
      .set({ stockAvailable: input.stockAvailable })
      .where(eq(products.id, input.id));

    const revalidated = await revalidateStorefront(storefrontPaths(current));
    return { stockAvailable: input.stockAvailable, revalidated };
  });
