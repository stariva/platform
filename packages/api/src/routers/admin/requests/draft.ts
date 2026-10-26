import { ORPCError } from "@orpc/server";
import { customOrderRequests, eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { draftFromRequest } from "./order-draft";

/**
 * Черновик заказа под заказ по заявке для диалога «Выставить счёт»:
 * контакты, изделие, мерки и цена из каталога (в рублях; 0 — товара в
 * каталоге нет, цену мастер впишет сама).
 *
 * @example client.admin.requests.orderDraft({ number: 1017 })
 */
export const orderDraft = adminProcedure
  .input(z.object({ number: z.number().int().positive() }))
  .handler(async ({ context, input }) => {
    const [request] = await context.db
      .select({ data: customOrderRequests.data })
      .from(customOrderRequests)
      .where(eq(customOrderRequests.number, input.number));
    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
    }

    const draft = draftFromRequest(request.data);
    const [product] = draft.productSlug
      ? await context.db
          .select({ price: products.price })
          .from(products)
          .where(eq(products.slug, draft.productSlug))
      : [];
    return {
      ...draft,
      // Товара нет в каталоге — ссылка на него в заказе вела бы в никуда
      productSlug: product ? draft.productSlug : "",
      price: product ? product.price / 100 : 0,
    };
  });
