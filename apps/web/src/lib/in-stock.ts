// ─── Готовые изделия в наличии ──────────────────────────────────────────────
// В отличие от изготовления под заказ, эти изделия уже сплетены и лежат на
// складе Ozon — их можно сразу положить в корзину и оплатить на сайте.
// Одежду готовой не продаём: её только изготавливаем на заказ по меркам
// (готовая одежда подлежит маркировке «Честный знак»). Если готовый образец
// одежды есть на складе, он лишь сокращает срок заказа.

import type { Product } from "@/lib/catalog/types";

export const IN_STOCK_HREF = "/catalog/v-nalichii";

/** Срок отправки готовых изделий со склада. */
export const IN_STOCK_SHIP_DAYS = "1–2 дня";
/** То же в днях — для разметки товара. */
export const IN_STOCK_SHIP_DAYS_RANGE = { min: 1, max: 2 };

/** Изделия этой категории можно продавать готовыми; одежду — только на заказ. */
export function sellsReadyMade(product: Pick<Product, "category">): boolean {
  return product.category !== "clothes";
}

/** Есть свободный остаток на Ozon и SKU для Ozon Доставки. */
function hasStock(product: Product): boolean {
  return product.inStock && Boolean(product.ozonSku);
}

/** Можно купить на сайте сразу: готовое изделие со склада, кроме одежды. */
export function isPurchasable(product: Product): boolean {
  return hasStock(product) && sellsReadyMade(product);
}

/** Одежда, у которой на складе есть готовый образец: заказ можно выполнить быстрее. */
export function hasReadySample(product: Product): boolean {
  return hasStock(product) && !sellsReadyMade(product);
}

/** «1 изделие», «3 изделия», «12 изделий» */
export function pluralItems(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "изделие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "изделия";
  return "изделий";
}
