import { type Database, inArray, products } from "@stariva/db";

import type { ItemProduct } from "./shape";

/**
 * Товары каталога для позиций заказов по slug — ради обложки и ссылки на
 * товар. Позиция хранит снапшот названия и цены, поэтому товар мог исчезнуть:
 * тогда его просто нет в словаре.
 */
export async function loadItemProducts(
  db: Database,
  slugs: string[],
): Promise<Map<string, ItemProduct>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      images: products.images,
    })
    .from(products)
    .where(inArray(products.slug, unique));
  return new Map(
    rows.map((row) => [row.slug, { id: row.id, image: row.images[0] ?? null }]),
  );
}
