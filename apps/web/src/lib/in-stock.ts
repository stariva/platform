// ─── Готовые изделия в наличии ──────────────────────────────────────────────
// В отличие от изготовления под заказ, эти изделия уже сплетены и лежат на
// складе Ozon — их можно сразу положить в корзину и оплатить на сайте.

import type { Product } from "@/lib/ozon-types";

export const IN_STOCK_HREF = "/catalog/v-nalichii";

/** Срок отправки готовых изделий со склада. */
export const IN_STOCK_SHIP_DAYS = "1–2 дня";

/** Можно купить на сайте сразу: есть свободный остаток на Ozon и SKU для Ozon Доставки. */
export function isPurchasable(product: Product): boolean {
  return product.inStock && Boolean(product.ozonSku);
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
