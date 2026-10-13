import { asc, desc, products } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Все товары, включая черновики и архив. По умолчанию — в порядке витрины;
 * `sort: "price"` сортирует по цене (`dir` — направление), при равной цене
 * остаётся порядок витрины.
 *
 * @example client.admin.products.list({ sort: "price", dir: "desc" })
 */
export const list = adminProcedure
  .input(
    z
      .object({
        sort: z.enum(["price"]).optional(),
        dir: z.enum(["asc", "desc"]).default("asc"),
      })
      .optional(),
  )
  .handler(async ({ context, input }) => {
    const showcase = [asc(products.sortOrder), asc(products.createdAt)];
    const orderBy =
      input?.sort === "price"
        ? [
            input.dir === "desc" ? desc(products.price) : asc(products.price),
            ...showcase,
          ]
        : showcase;

    const rows = await context.db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        category: products.category,
        subcategory: products.subcategory,
        status: products.status,
        price: products.price,
        oldPrice: products.oldPrice,
        images: products.images,
        madeToOrder: products.madeToOrder,
        stockAvailable: products.stockAvailable,
        featured: products.featured,
        sortOrder: products.sortOrder,
        ozonOfferId: products.ozonOfferId,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .orderBy(...orderBy);

    return rows.map(({ images, price, oldPrice, ...row }) => ({
      ...row,
      price: price / 100,
      oldPrice: oldPrice === null ? null : oldPrice / 100,
      image: images[0] ?? null,
    }));
  });
