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

/**
 * Товары, которые можно купить уже сейчас, но отправим только с даты.
 * Остаток и Ozon Доставка работают как у обычного товара в наличии: заказ
 * сразу создаётся в Ozon и ждёт отправки. Меняется только подпись.
 * Когда дата наступит, подпись исчезает сама: ничего убирать не нужно.
 */
const SHIPS_FROM: Record<string, { at: string; label: string }> = {
  // «Набор макраме Ёлка»: первая партия будет готова к 18 ноября (МСК)
  "nabor-makrame-elka": { at: "2026-11-18T00:00:00+03:00", label: "18 ноября" },
};

/** «18 ноября» — пока товар ещё не отправляем; null — отправляем как обычно. */
export function shipsFromLabel(
  slug: string,
  now: Date = new Date(),
): string | null {
  const entry = SHIPS_FROM[slug];
  return entry && now.getTime() < Date.parse(entry.at) ? entry.label : null;
}

/** Срок отправки в днях для разметки товара: от сегодня до даты и ещё два дня. */
export function shipsFromHandlingDays(
  slug: string,
  now: Date = new Date(),
): { min: number; max: number } | null {
  const entry = SHIPS_FROM[slug];
  if (!entry || !shipsFromLabel(slug, now)) return null;
  const days = Math.ceil((Date.parse(entry.at) - now.getTime()) / 86_400_000);
  return { min: days, max: days + IN_STOCK_SHIP_DAYS_RANGE.max };
}

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

/** Набор для творчества: покупатель плетёт сам, готового изделия в коробке нет. */
export function isKit(product: Pick<Product, "subcategory">): boolean {
  return product.subcategory === "kits";
}

/** «1 набор», «3 набора», «12 наборов» */
export function pluralKits(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "набор";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "набора";
  return "наборов";
}
