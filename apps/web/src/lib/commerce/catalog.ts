import { getProductsResult } from "@/lib/ozon-service";

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
 * Товары из корзины, которые сейчас нельзя купить: закончился свободный
 * остаток на Ozon, товар снят с продажи или у него нет SKU. Корзина хранится
 * в браузере, поэтому такое бывает штатно — это не сбой, а повод убрать
 * товары из корзины.
 */
export class CatalogItemsUnavailableError extends Error {
  constructor(readonly productSlugs: string[]) {
    super(`catalog_product_unavailable:${productSlugs.join(",")}`);
    this.name = "CatalogItemsUnavailableError";
  }
}

/** Resolves all price and fulfillment data from the server-side catalog. */
export async function resolveCatalogItems(
  requestedItems: RequestedCatalogItem[],
): Promise<ResolvedCatalogItem[]> {
  const { products, status } = await getProductsResult();
  // Каталог Ozon недоступен — это сбой, а не отсутствие товаров: иначе
  // покупателю пришлось бы очистить всю корзину.
  if (status === "unavailable") throw new Error("catalog_unavailable");

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const quantities = new Map<string, number>();

  for (const item of requestedItems) {
    const quantity = (quantities.get(item.productSlug) ?? 0) + item.quantity;
    if (quantity > 99) throw new Error("catalog_quantity_too_large");
    quantities.set(item.productSlug, quantity);
  }

  const resolved: ResolvedCatalogItem[] = [];
  const unavailable: string[] = [];
  for (const [productSlug, quantity] of quantities) {
    const product = productsBySlug.get(productSlug);
    const price = Math.round((product?.price ?? 0) * 100);
    if (
      !product?.inStock ||
      product.currency !== "RUB" ||
      !Number.isSafeInteger(product.ozonSku) ||
      (product.ozonSku ?? 0) <= 0 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price > 2_147_483_647
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
