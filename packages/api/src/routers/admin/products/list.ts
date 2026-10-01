import { asc, products } from "@stariva/db";

import { adminProcedure } from "../../../orpc";

/** Все товары, включая черновики и архив, в порядке витрины. */
export const list = adminProcedure.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      category: products.category,
      subcategory: products.subcategory,
      status: products.status,
      price: products.price,
      images: products.images,
      madeToOrder: products.madeToOrder,
      stockAvailable: products.stockAvailable,
      featured: products.featured,
      sortOrder: products.sortOrder,
      ozonOfferId: products.ozonOfferId,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.createdAt));

  return rows.map(({ images, price, ...row }) => ({
    ...row,
    price: price / 100,
    image: images[0] ?? null,
  }));
});
