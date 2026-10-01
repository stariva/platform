import { ORPCError } from "@orpc/server";
import { courseAccess, eq, orders, workshops } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Удаляет мастер-класс, который никто не покупал и не получал. С покупателями
 * его только архивируют — иначе они потеряют курс. Файлы в бакете остаются.
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select({ slug: workshops.slug })
      .from(workshops)
      .where(eq(workshops.id, input.id));
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }

    const [access] = await context.db
      .select({ id: courseAccess.id })
      .from(courseAccess)
      .where(eq(courseAccess.workshopSlug, row.slug))
      .limit(1);
    const [order] = await context.db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.workshopSlug, row.slug))
      .limit(1);
    if (access || order) {
      throw new ORPCError("CONFLICT", {
        message:
          "У мастер-класса есть покупки или доступы — удалить нельзя, переведите в архив",
      });
    }

    await context.db.delete(workshops).where(eq(workshops.id, input.id));
    const revalidated = await revalidateStorefront(storefrontPaths(row.slug));
    return { revalidated };
  });
