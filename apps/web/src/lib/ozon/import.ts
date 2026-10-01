import type { NewProductRow } from "@stariva/db/schema";
import type { OzonCatalogItem } from "./api-client";
import { transformOzonProduct } from "./transformers";

const PLACEHOLDER_IMAGE = "/images/catalog/placeholder.jpg";

export type ImportResult =
  | { ok: true; row: NewProductRow }
  | { ok: false; ozonProductId: number; offerId: string; reason: string };

/**
 * Переводит товар Ozon в строку каталога. Slug, категория, цена и описание
 * берутся тем же трансформером, что сейчас рисует сайт, — чтобы после
 * переключения на базу URL и карточки не изменились.
 */
export function ozonItemToProductRow(
  { info, attrs }: OzonCatalogItem,
  sortOrder: number,
  now: Date,
): ImportResult {
  const product = transformOzonProduct(info, attrs);
  const skip = (reason: string): ImportResult => ({
    ok: false,
    ozonProductId: info.id,
    offerId: info.offer_id,
    reason,
  });

  const price = Math.round(product.price * 100);
  if (!Number.isSafeInteger(price) || price <= 0 || price > 2_147_483_647) {
    return skip(`некорректная цена: ${product.price}`);
  }
  const oldPrice =
    product.oldPrice === undefined ? null : Math.round(product.oldPrice * 100);

  const ozonSku = product.ozonSku ?? null;

  return {
    ok: true,
    row: {
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      // Сейчас сайт показывает все товары Ozon, включая архивные
      status: "published",
      price,
      oldPrice: oldPrice !== null && oldPrice > price ? oldPrice : null,
      images: product.images.filter((image) => image !== PLACEHOLDER_IMAGE),
      material: product.material,
      color: product.color ?? null,
      careInstructions: product.careInstructions ?? null,
      sizes: product.sizes ?? [],
      // Сейчас под заказ можно оформить любой товар
      madeToOrder: true,
      ozonProductId: info.id,
      ozonOfferId: info.offer_id || null,
      ozonSku,
      // Без SKU товар нельзя отправить Ozon Доставкой — продаём только под заказ
      stockAvailable: ozonSku === null ? 0 : product.stockAvailable,
      stockSyncedAt: now,
      sortOrder,
    },
  };
}

/** Оставляет первый товар с каждым slug — сейчас сайт ведёт себя так же. */
export function dropDuplicateSlugs(results: ImportResult[]): ImportResult[] {
  const seen = new Map<string, NewProductRow>();
  return results.map((result) => {
    if (!result.ok) return result;
    const first = seen.get(result.row.slug);
    if (!first) {
      seen.set(result.row.slug, result.row);
      return result;
    }
    return {
      ok: false,
      ozonProductId: result.row.ozonProductId as number,
      offerId: result.row.ozonOfferId ?? "",
      reason: `slug «${result.row.slug}» уже занят товаром ${first.ozonOfferId}`,
    };
  });
}
