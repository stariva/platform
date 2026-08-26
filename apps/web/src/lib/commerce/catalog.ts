import { getProducts } from "@/lib/ozon-service";

export interface RequestedCatalogItem {
  productSlug: string;
  quantity: number;
}

export interface ResolvedCatalogItem extends RequestedCatalogItem {
  ozonSku: number;
  name: string;
  price: number;
}

/** Resolves all price and fulfillment data from the server-side catalog. */
export async function resolveCatalogItems(
  requestedItems: RequestedCatalogItem[],
): Promise<ResolvedCatalogItem[]> {
  const products = await getProducts();
  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const quantities = new Map<string, number>();

  for (const item of requestedItems) {
    const quantity = (quantities.get(item.productSlug) ?? 0) + item.quantity;
    if (quantity > 99) throw new Error("catalog_quantity_too_large");
    quantities.set(item.productSlug, quantity);
  }

  return [...quantities].map(([productSlug, quantity]) => {
    const product = productsBySlug.get(productSlug);
    const price = product ? Math.round(product.price * 100) : 0;
    if (
      !product?.inStock ||
      product.currency !== "RUB" ||
      !Number.isSafeInteger(product.ozonSku) ||
      (product.ozonSku ?? 0) <= 0 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price > 2_147_483_647
    ) {
      throw new Error(`catalog_product_unavailable:${productSlug}`);
    }

    return {
      productSlug,
      quantity,
      ozonSku: product.ozonSku as number,
      name: product.name,
      price,
    };
  });
}
