import { logger } from "@stariva/config";
import { getProductsResult, type ProductsResult } from "@/lib/catalog/service";
import { preorderBonusFor } from "@/lib/workshops/preorder-bonus";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { TREES_SUBCATEGORY, WORKSHOP_SLUG } from "./data";

/**
 * Ёлки — опубликованные товары подкатегории «Ёлки», порядок как в каталоге.
 * Статус отличает «ёлок нет» от «база недоступна».
 */
export async function getTreeProducts(): Promise<ProductsResult> {
  const { products, status } = await getProductsResult();
  return {
    products: products.filter((p) => p.subcategory === TREES_SUBCATEGORY),
    status,
  };
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

/**
 * Мастер-класс по большой ёлке, когда он продаётся. Пока его дарят за
 * предзаказ маленькой, база его не отдаёт — и страница показывает подарок.
 */
export async function loadBigTreeWorkshop() {
  const slug = preorderBonusFor(WORKSHOP_SLUG)?.slug;
  if (!slug) return undefined;
  return getWorkshopBySlug(slug).catch((error) => {
    logger.warn("elka_workshop.big_tree.unavailable", { error: String(error) });
    return undefined;
  });
}
