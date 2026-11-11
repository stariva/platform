import type { Product } from "@/lib/catalog/types";

const MAX_DESCRIPTION = 160;

/** Заголовок без бренда: шаблон страницы дописывает « — Stariva». */
export function productMetaTitle(product: Product): string {
  return product.seoTitle?.trim() || `${product.name}, купить`;
}

export function productMetaDescription(product: Product): string {
  const custom = product.seoDescription?.trim();
  if (custom) return custom;

  // Набор покупатель плетёт сам — «ручная работа» обещала бы готовое изделие
  const tail =
    product.subcategory === "kits"
      ? "Доставка по России."
      : "Ручная работа, доставка по России.";
  const text = `${product.shortDescription} ${tail}`;
  if (text.length <= MAX_DESCRIPTION) return text;
  // Обрезаем по границе слова, чтобы сниппет не заканчивался на полуслове
  return `${text.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, "")}…`;
}
