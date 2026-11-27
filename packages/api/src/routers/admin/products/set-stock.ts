import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import {
  pushStorefrontStockToOzon,
  revalidateStorefront,
} from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Остаток готовых изделий. Ведётся у нас и правится здесь, при оплате заказа
 * списывается сам. Если товар привязан к Ozon, новое значение сразу
 * дублируется на FBS-склад Ozon, а сам товар скрывается с витрины Ozon
 * (кроме тех, что продаются и на Ozon).
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
        ozonOfferId: products.ozonOfferId,
      })
      .from(products)
      .where(eq(products.id, input.id));
    if (!current) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }
    await context.db
      .update(products)
      .set({ stockAvailable: input.stockAvailable })
      .where(eq(products.id, input.id));

    // Полная привязка к Ozon: SKU нужен для доставки и видимости,
    // артикул — для синхронизации остатка. Без привязки остаток просто
    // сохраняется у нас.
    const ozonLinked = current.ozonSku !== null && current.ozonOfferId !== null;
    const [revalidated, ozonSynced] = await Promise.all([
      revalidateStorefront(storefrontPaths(current)),
      ozonLinked
        ? pushStorefrontStockToOzon([current.slug])
        : Promise.resolve(null),
    ]);
    return { stockAvailable: input.stockAvailable, revalidated, ozonSynced };
  });
