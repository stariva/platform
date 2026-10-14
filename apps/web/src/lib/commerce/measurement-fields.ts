import { getProductsResult } from "@/lib/catalog/service";
import { getMadeToOrder } from "@/lib/made-to-order";

export interface MeasurementField {
  id: string;
  label: string;
  hint: string;
}

/** Мерки, о которых мастер спрашивает по изделию: по категории из каталога, если изделие ещё в нём есть. */
export async function measurementFieldsBySlug(
  slugs: string[],
): Promise<Map<string, MeasurementField[]>> {
  const bySlug = new Map<string, MeasurementField[]>();
  try {
    const { products } = await getProductsResult();
    for (const product of products) {
      if (slugs.includes(product.slug)) {
        bySlug.set(
          product.slug,
          getMadeToOrder(product.category)?.measurements ?? [],
        );
      }
    }
  } catch {
    // Каталог недоступен — покупатель опишет размер в комментарии
  }
  return bySlug;
}
