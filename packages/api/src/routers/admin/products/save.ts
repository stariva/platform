import { ORPCError } from "@orpc/server";
import { eq, products } from "@stariva/db";
import { productFormSchema } from "@stariva/validators";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { formToRow, storefrontPaths } from "./mapping";

function isSlugTaken(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  const pg = cause ?? (error as { code?: string; constraint?: string });
  return pg?.code === "23505" && pg.constraint === "products_slug_idx";
}

/**
 * Создаёт товар (без id) или сохраняет существующий, затем просит витрину
 * обновить страницы — и старый адрес, если slug или категория поменялись.
 */
export const save = adminProcedure
  .input(
    z.object({
      id: z.string().min(1).optional(),
      values: productFormSchema,
    }),
  )
  .handler(async ({ context, input }) => {
    const fields = formToRow(input.values);

    try {
      if (!input.id) {
        const [created] = await context.db
          .insert(products)
          .values(fields)
          .returning({ id: products.id });
        if (!created) throw new Error("product_insert_failed");
        const revalidated = await revalidateStorefront(
          storefrontPaths(input.values),
        );
        return { id: created.id, revalidated };
      }

      const [before] = await context.db
        .select({ category: products.category, slug: products.slug })
        .from(products)
        .where(eq(products.id, input.id));
      if (!before) {
        throw new ORPCError("NOT_FOUND", { message: "Товар не найден" });
      }

      await context.db
        .update(products)
        .set(fields)
        .where(eq(products.id, input.id));
      const revalidated = await revalidateStorefront(
        storefrontPaths(before, input.values),
      );
      return { id: input.id, revalidated };
    } catch (error) {
      if (isSlugTaken(error)) {
        throw new ORPCError("CONFLICT", {
          message: "Такой адрес уже занят другим товаром",
        });
      }
      throw error;
    }
  });
