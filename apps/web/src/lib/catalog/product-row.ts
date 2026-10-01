import type { ProductRow } from "@stariva/db/schema";
import { toShortDescription } from "@/lib/ozon/transformers";
import type { Product } from "@/lib/ozon-types";

const PLACEHOLDER_IMAGE =
  "https://cdn.stariva.ru/site/images/catalog/placeholder.jpg";
const DEFAULT_MATERIAL = "100% хлопок";

/** Строка таблицы products → модель витрины. Цены в базе — в копейках. */
export function productRowToProduct(row: ProductRow): Product {
  const ozonSku = row.ozonSku ?? undefined;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || `<p>${row.name}</p>`,
    shortDescription: toShortDescription(row.description, row.name),
    price: row.price / 100,
    oldPrice: row.oldPrice === null ? undefined : row.oldPrice / 100,
    currency: "RUB",
    images: row.images.length > 0 ? row.images : [PLACEHOLDER_IMAGE],
    category: row.category,
    subcategory: row.subcategory,
    ozonId: row.ozonProductId ?? undefined,
    ozonOfferId: row.ozonOfferId ?? undefined,
    offerId: row.ozonOfferId ?? undefined,
    ozonSku,
    ozonUrl:
      ozonSku || row.ozonProductId
        ? `https://www.ozon.ru/product/${ozonSku ?? row.ozonProductId}`
        : undefined,
    // Готовое изделие можно отправить только Ozon Доставкой, то есть по SKU
    inStock: ozonSku !== undefined && row.stockAvailable > 0,
    stockAvailable: row.stockAvailable,
    madeToOrder: row.madeToOrder,
    leadTimeDays:
      row.leadTimeMinDays !== null && row.leadTimeMaxDays !== null
        ? { min: row.leadTimeMinDays, max: row.leadTimeMaxDays }
        : undefined,
    material: row.material || DEFAULT_MATERIAL,
    dimensions: row.dimensions ?? undefined,
    careInstructions: row.careInstructions ?? undefined,
    color: row.color ?? undefined,
    sizes: row.sizes.length > 0 ? row.sizes : undefined,
    featured: row.featured,
    seoTitle: row.seoTitle ?? undefined,
    seoDescription: row.seoDescription ?? undefined,
  };
}
