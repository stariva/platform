import { logger } from "@stariva/config";
import { getProducts } from "@/lib/ozon-service";
import type { Product } from "@/lib/ozon-types";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { WORKSHOP_SLUG } from "./data";

/**
 * Ёлки — опубликованные товары, чей slug начинается с «elka-». Админка
 * собирает slug из названия («Ёлка …» → «elka-…»), поэтому новая ёлка
 * попадает на страницы сама, порядок — как в каталоге.
 */
const TREE_SLUG_PREFIX = "elka-";

export async function getTreeProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) =>
    product.slug.startsWith(TREE_SLUG_PREFIX),
  );
}

/**
 * Ёлки и мастер-класс из базы — для обеих страниц ёлки. Сбой любого
 * источника не роняет страницу: без каталога ёлок нет, мастер-класс берёт
 * запасную цену. `page` попадает в ключ лога, чтобы было видно, какая
 * страница осталась без данных.
 */
export async function loadElkaData(page: "elka_workshop" | "elka_trees") {
  const [trees, workshop] = await Promise.all([
    getTreeProducts(),
    getWorkshopBySlug(WORKSHOP_SLUG).catch((error) => {
      logger.warn(`${page}.workshop.unavailable`, { error: String(error) });
      return undefined;
    }),
  ]);
  return { trees, workshop };
}
