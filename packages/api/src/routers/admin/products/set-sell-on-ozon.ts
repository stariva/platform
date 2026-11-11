import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { pushStorefrontStockToOzon } from "../../../storefront";

/**
 * Продавать ли готовое изделие ещё и на маркетплейсе Ozon. По умолчанию
 * готовые изделия с витрины Ozon скрыты и продаются только на сайте. С
 * флагом товар виден на Ozon, остаток у сайта и Ozon общий: покупки на Ozon
 * сайт подтягивает по расписанию.
 *
 * Выключение не скрывает товар без остатка: Ozon прячет только то, что
 * есть в наличии (так же, как при правке остатка).
 */
export const setSellOnOzon = adminProcedure
  .input(z.object({ id: z.string().min(1), sellOnOzon: z.boolean() }))
  .handler(async ({ context, input }) => {
    const [current] = await context.db
      .select({
        slug: products.slug,
        ozonSku: products.ozonSku,
        ozonOfferId: products.ozonOfferId,
      })
      .from(products)
      .where(eq(products.id, input.id));
    if (!current) {
      throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
    }
    if (current.ozonSku === null || current.ozonOfferId === null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "У товара нет SKU или артикула Ozon — на Ozon его не продать",
      });
    }

    await context.db
      .update(products)
      .set({ sellOnOzon: input.sellOnOzon })
      .where(eq(products.id, input.id));

    // Только видимость: остаток не менялся, а повторную отправку остатка
    // Ozon отклоняет («Stock is updated too frequently»).
    const ozonSynced = await pushStorefrontStockToOzon([current.slug], {
      visibilityOnly: true,
    });
    return { sellOnOzon: input.sellOnOzon, ozonSynced };
  });
