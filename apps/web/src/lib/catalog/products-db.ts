import { asc, db, eq } from "@stariva/db";
import { products } from "@stariva/db/schema";
import type { Product } from "@/lib/ozon-types";
import { productRowToProduct } from "./product-row";

/** Опубликованные товары в порядке витрины. */
export async function fetchPublishedProducts(): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.status, "published"))
    .orderBy(asc(products.sortOrder), asc(products.createdAt));
  return rows.map(productRowToProduct);
}
