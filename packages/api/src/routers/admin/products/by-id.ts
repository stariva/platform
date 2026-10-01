import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { rowToForm } from "./mapping";

/** Товар для формы редактирования плюс остаток и SKU для Ozon Доставки. */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select()
      .from(products)
      .where(eq(products.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });

    return {
      id: row.id,
      values: rowToForm(row),
      ozon: {
        offerId: row.ozonOfferId,
        sku: row.ozonSku,
        stockAvailable: row.stockAvailable,
      },
      updatedAt: row.updatedAt,
    };
  });
