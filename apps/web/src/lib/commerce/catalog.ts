import { getProductsResult } from "@/lib/ozon-service";
import type { Product } from "@/lib/ozon-types";

/** Максимум одного изделия в заказе. */
export const MAX_ITEM_QUANTITY = 99;
const MAX_PRICE_KOPECKS = 2_147_483_647;

export interface RequestedCatalogItem {
  productSlug: string;
  quantity: number;
}

export interface ResolvedCatalogItem extends RequestedCatalogItem {
  ozonSku: number;
  name: string;
  price: number;
}

/**
 * Товары из корзины, которые сейчас нельзя купить: закончился остаток,
 * в корзине больше, чем осталось, товар снят с продажи или у него нет SKU
 * для Ozon Доставки. Корзина хранится
 * в браузере, поэтому такое бывает штатно — это не сбой, а повод убрать
 * товары из корзины.
 */
export class CatalogItemsUnavailableError extends Error {
  constructor(readonly productSlugs: string[]) {
    super(`catalog_product_unavailable:${productSlugs.join(",")}`);
    this.name = "CatalogItemsUnavailableError";
  }
}

/** Цена изделия в копейках; null, если её нельзя передать в Ozon Доставку. */
export function priceInKopecks(product: Product): number | null {
  const price = Math.round(product.price * 100);
  return Number.isSafeInteger(price) && price > 0 && price <= MAX_PRICE_KOPECKS
    ? price
    : null;
}

/**
 * Можно ли продать хотя бы одно изделие: есть остаток, цена в рублях и SKU
 * для Ozon Доставки. Одно правило для корзины и для оформления заказа.
 */
export function isCatalogProductBuyable(product: Product | undefined): boolean {
  return Boolean(
    product?.inStock &&
      (product.stockAvailable ?? 0) >= 1 &&
      product.currency === "RUB" &&
      Number.isSafeInteger(product.ozonSku) &&
      (product.ozonSku ?? 0) > 0 &&
      priceInKopecks(product) !== null,
  );
}

/** Resolves all price and fulfillment data from the server-side catalog. */
export async function resolveCatalogItems(
  requestedItems: RequestedCatalogItem[],
): Promise<ResolvedCatalogItem[]> {
  const { products, status } = await getProductsResult();
  // Каталог недоступен — это сбой, а не отсутствие товаров: иначе
  // покупателю пришлось бы очистить всю корзину.
  if (status === "unavailable") throw new Error("catalog_unavailable");

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const quantities = new Map<string, number>();

  for (const item of requestedItems) {
    const quantity = (quantities.get(item.productSlug) ?? 0) + item.quantity;
    if (quantity > MAX_ITEM_QUANTITY)
      throw new Error("catalog_quantity_too_large");
    quantities.set(item.productSlug, quantity);
  }

  const resolved: ResolvedCatalogItem[] = [];
  const unavailable: string[] = [];
  for (const [productSlug, quantity] of quantities) {
    const product = productsBySlug.get(productSlug);
    const price = product ? priceInKopecks(product) : null;
    if (
      !product ||
      price === null ||
      !isCatalogProductBuyable(product) ||
      quantity > product.stockAvailable
    ) {
      unavailable.push(productSlug);
      continue;
    }

    resolved.push({
      productSlug,
      quantity,
      ozonSku: product.ozonSku as number,
      name: product.name,
      price,
    });
  }

  if (unavailable.length > 0) {
    throw new CatalogItemsUnavailableError(unavailable);
  }
  return resolved;
}
