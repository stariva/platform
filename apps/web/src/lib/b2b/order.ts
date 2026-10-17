// ─── Небольшой заказ для бизнеса ────────────────────────────────────────────
// Чистые данные и функции для страницы /b2b: до 20 изделий, которые Ольга
// плетёт одна и отправляет готовыми. Без выезда, замеров и монтажа.
// Ориентир считается той же моделью, что и в чат-консультанте.

import { COLORS, calculatePrice, formatRub } from "@/lib/custom-order/pricing";

/** Больше одна мастерица в разумный срок не сплетёт. */
export const MAX_ORDER_ITEMS = 20;

/** Скидка за объём — единственный источник цифр для страницы. */
export const BULK_DISCOUNT = { minItems: 5, percent: 15 } as const;

export interface OrderItemType {
  id: string;
  label: string;
  /** Размер, который подходит небольшому помещению. */
  hint: string;
  pricingId: string;
  sizeId: string;
}

/** Что можно заказать: изделия, которые вешаются без мастера. */
export const ORDER_ITEM_TYPES: OrderItemType[] = [
  {
    id: "lampshade",
    label: "Абажур",
    hint: "30–60 см, без электрики",
    pricingId: "lampshade",
    sizeId: "m",
  },
  {
    id: "panel",
    label: "Панно на стену",
    hint: "60–100 см",
    pricingId: "panel",
    sizeId: "l",
  },
  {
    id: "plant-hanger",
    label: "Кашпо для растений",
    hint: "подвесное, 30–60 см",
    pricingId: "plant-hanger",
    sizeId: "m",
  },
];

/** Цвета без подбора по образцу: натуральный шнур или один цвет. */
export const ORDER_COLORS = COLORS.filter((c) => c.id !== "multi");

export const PLACE_TYPES = [
  "Кофейня / пекарня",
  "Кафе / бар",
  "Салон / студия",
  "Гостевой дом",
  "Офис / шоурум",
  "Другое",
] as const;

export interface Order {
  /** Количество по id изделия. */
  quantities: Record<string, number>;
  colorId: string;
  place?: string;
  city?: string;
}

export interface OrderEstimate {
  items: number;
  min: number;
  max: number;
  discountPercent: number;
  discountedMin: number;
  discountedMax: number;
  /** Срок изготовления, например «2–3 недели». */
  leadTime: string;
}

function quantityOf(order: Order, id: string): number {
  const value = order.quantities[id] ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function orderItems(order: Order): number {
  return ORDER_ITEM_TYPES.reduce(
    (sum, type) => sum + quantityOf(order, type.id),
    0,
  );
}

/** Сколько ещё можно добавить, не выходя за лимит в 20 изделий. */
export function itemsLeft(order: Order): number {
  return Math.max(0, MAX_ORDER_ITEMS - orderItems(order));
}

/** Срок зависит от объёма: всё плетёт один человек. */
export function leadTime(items: number): string {
  if (items <= 5) return "2–3 недели";
  if (items <= 12) return "3–4 недели";
  return "4–6 недель";
}

function roundTo100(value: number): number {
  return Math.round(value / 100) * 100;
}

export function estimateOrder(order: Order): OrderEstimate {
  let items = 0;
  let min = 0;
  let max = 0;
  for (const type of ORDER_ITEM_TYPES) {
    const quantity = quantityOf(order, type.id);
    if (!quantity) continue;
    const price = calculatePrice({
      productType: type.pricingId,
      size: type.sizeId,
      color: order.colorId,
      complexity: "standard",
    });
    if (!price) continue;
    items += quantity;
    min += price.min * quantity;
    max += price.max * quantity;
  }
  const discountPercent =
    items >= BULK_DISCOUNT.minItems ? BULK_DISCOUNT.percent : 0;
  const factor = 1 - discountPercent / 100;
  return {
    items,
    min,
    max,
    discountPercent,
    discountedMin: roundTo100(min * factor),
    discountedMax: roundTo100(max * factor),
    leadTime: leadTime(items),
  };
}

/** Ориентир «от» за одно изделие в натуральном цвете. */
export function startingPrice(type: OrderItemType): string | null {
  const price = calculatePrice({
    productType: type.pricingId,
    size: type.sizeId,
    color: "natural",
    complexity: "standard",
  });
  return price ? `от ${formatRub(price.min)}` : null;
}

/** Текст для мессенджера: всё, что нужно Ольге, чтобы назвать цену. */
export function orderMessage(order: Order): string {
  const estimate = estimateOrder(order);
  const place = [order.place, order.city?.trim()].filter(Boolean).join(", ");
  const lines = ORDER_ITEM_TYPES.filter((type) => quantityOf(order, type.id))
    .map(
      (type, index) =>
        `${index + 1}. ${type.label}, ${type.hint} — ${quantityOf(order, type.id)} шт.`,
    )
    .join("\n");
  const color = ORDER_COLORS.find((c) => c.id === order.colorId)?.label;
  const range =
    estimate.max > 0
      ? `${formatRub(estimate.discountedMin)}–${formatRub(estimate.discountedMax)}${estimate.discountPercent ? ` со скидкой ${estimate.discountPercent}%` : ""}`
      : null;
  return [
    "Здравствуйте, Ольга! Хочу заказать макраме для заведения.",
    place && `Место: ${place}`,
    lines && `Что нужно:\n${lines}`,
    lines && color && `Цвет: ${color}`,
    range && `Ориентир с сайта: ${range}`,
    "Пришлю фото места и примерные размеры.",
  ]
    .filter(Boolean)
    .join("\n");
}
