import { logger } from "@stariva/config";
import { getProductBySlug } from "@/lib/ozon-service";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { type ModelWithProduct, TREE_MODELS, WORKSHOP_SLUG } from "./data";

/**
 * Товары-ёлки и мастер-класс из базы — для обеих страниц ёлки.
 * Сбой любого источника не роняет страницу: ёлку без товара в базе просто
 * не показываем, мастер-класс берёт запасную цену. `page` попадает в ключ
 * лога, чтобы было видно, какая страница осталась без данных.
 */
export async function loadElkaData(page: "elka_workshop" | "elka_trees") {
  const [products, workshop] = await Promise.all([
    Promise.all(
      TREE_MODELS.map((model) =>
        getProductBySlug(model.slug).catch((error) => {
          logger.warn(`${page}.product.unavailable`, {
            slug: model.slug,
            error: String(error),
          });
          return undefined;
        }),
      ),
    ),
    getWorkshopBySlug(WORKSHOP_SLUG).catch((error) => {
      logger.warn(`${page}.workshop.unavailable`, { error: String(error) });
      return undefined;
    }),
  ]);

  const items: ModelWithProduct[] = TREE_MODELS.flatMap((model, index) => {
    const product = products[index];
    return product ? [{ model, product }] : [];
  });
  return { items, workshop };
}
