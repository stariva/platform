import type { Product } from "@/lib/ozon-types";

const MAX_DESCRIPTION = 160;

/** Заголовок без бренда: шаблон страницы дописывает « — Stariva». */
export function productMetaTitle(product: Product): string {
  return product.seoTitle?.trim() || `${product.name}, купить`;
}

export function productMetaDescription(product: Product): string {
  const custom = product.seoDescription?.trim();
  if (custom) return custom;

  const text = `${product.shortDescription} Ручная работа, доставка по России.`;
  if (text.length <= MAX_DESCRIPTION) return text;
  // Обрезаем по границе слова, чтобы сниппет не заканчивался на полуслове
  return `${text.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, "")}…`;
}
