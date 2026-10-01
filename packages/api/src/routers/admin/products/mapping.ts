import type { NewProductRow, ProductRow } from "@stariva/db/schema";
import type { ProductFormValues } from "@stariva/validators";

const nullIfEmpty = (value: string) => (value.trim() === "" ? null : value);

/** Значения формы → поля строки products (цены в копейках, пустое → null). */
export function formToRow(values: ProductFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    description: values.description,
    category: values.category,
    subcategory: values.subcategory,
    status: values.status,
    price: Math.round(values.price * 100),
    oldPrice:
      values.oldPrice === null ? null : Math.round(values.oldPrice * 100),
    images: values.images,
    material: nullIfEmpty(values.material),
    color: nullIfEmpty(values.color),
    dimensions: nullIfEmpty(values.dimensions),
    careInstructions: nullIfEmpty(values.careInstructions),
    sizes: values.sizes,
    madeToOrder: values.madeToOrder,
    leadTimeMinDays: values.leadTimeMinDays,
    leadTimeMaxDays: values.leadTimeMaxDays,
    featured: values.featured,
    sortOrder: values.sortOrder,
    seoTitle: nullIfEmpty(values.seoTitle),
    seoDescription: nullIfEmpty(values.seoDescription),
  } satisfies Partial<NewProductRow>;
}

/** Строка products → значения формы (цены в рублях, null → пустая строка). */
export function rowToForm(row: ProductRow): ProductFormValues {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    status: row.status,
    price: row.price / 100,
    oldPrice: row.oldPrice === null ? null : row.oldPrice / 100,
    images: row.images,
    material: row.material ?? "",
    color: row.color ?? "",
    dimensions: row.dimensions ?? "",
    careInstructions: row.careInstructions ?? "",
    sizes: row.sizes,
    madeToOrder: row.madeToOrder,
    leadTimeMinDays: row.leadTimeMinDays,
    leadTimeMaxDays: row.leadTimeMaxDays,
    featured: row.featured,
    sortOrder: row.sortOrder,
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
  };
}

/** Страницы витрины, которые надо обновить после правки товара. */
export function storefrontPaths(
  ...products: { category: string; slug: string }[]
): string[] {
  return [
    ...products.map((p) => `/catalog/${p.category}/${p.slug}`),
    "/sitemap.xml",
  ];
}
