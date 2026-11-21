import { getProducts } from "@/lib/catalog/service";
import type { Product } from "@/lib/catalog/types";
import { KIT_COLORS } from "./elka-kit-bundle";

export interface ElkaKitVariant {
  product: Product;
  slug: string;
  label: string;
  hint: string;
  swatch: string;
}

/** Все расцветки набора «Ёлка макраме» в порядке витрины. */
export async function getElkaKitVariants(): Promise<ElkaKitVariant[]> {
  const products = await getProducts();
  return KIT_COLORS.flatMap((color) => {
    const product = products.find(
      (item) => item.slug === color.slug && item.subcategory === "kits",
    );
    return product ? [{ ...color, product }] : [];
  });
}
