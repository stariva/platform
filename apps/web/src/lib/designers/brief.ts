// ─── Бриф дизайнера интерьера ───────────────────────────────────────────────
// Чистые данные и функции для страницы /designers: условия партнёрства,
// ориентир стоимости по позициям проекта и готовый текст для мессенджера.
// Ориентир считается той же моделью, что и в чат-консультанте.

import {
  COLORS,
  calculatePrice,
  formatRub,
  PRODUCT_TYPES,
  SIZES,
} from "@/lib/custom-order/pricing";

/**
 * Скидка дизайнера по числу изделий в проекте. Единственный источник цифр:
 * их читают блок условий, FAQ и калькулятор брифа.
 */
export const DESIGNER_DISCOUNTS = [
  { minItems: 1, percent: 10 },
  { minItems: 5, percent: 15 },
] as const;

/** С какого числа изделий цену считаем индивидуально. */
export const INDIVIDUAL_PRICE_FROM = 10;

/** Процент скидки дизайнера для заданного числа изделий. */
export function designerDiscount(items: number): number {
  let percent = 0;
  for (const tier of DESIGNER_DISCOUNTS)
    if (items >= tier.minItems) percent = tier.percent;
  return percent;
}

export interface BriefItemType {
  id: string;
  label: string;
  /** Тип из модели цен; без него позиция считается только по эскизу. */
  pricingId?: string;
}

/** Позиции, которые дизайнеры заказывают для общественных интерьеров. */
export const BRIEF_ITEM_TYPES: BriefItemType[] = [
  { id: "lampshade", label: "Абажур", pricingId: "lampshade" },
  { id: "panel", label: "Панно", pricingId: "panel" },
  { id: "screen", label: "Перегородка / ширма" },
  { id: "plant-hanger", label: "Кашпо / подвес", pricingId: "plant-hanger" },
  { id: "placemat", label: "Сервировка стола", pricingId: "placemat" },
  { id: "chair", label: "Подвесное кресло", pricingId: "tipi" },
  { id: "logo", label: "Панно с логотипом" },
  { id: "other", label: "Другое" },
];

export const OBJECT_TYPES = [
  "Кафе / кофейня",
  "Ресторан",
  "Бар",
  "Отель",
  "Гостевой дом / апартаменты",
  "Офис / коворкинг",
  "Салон / клиника",
  "Другое",
] as const;

export const PROJECT_STAGES = [
  "Концепция",
  "Рабочий проект",
  "Комплектация",
  "Объект уже работает",
] as const;

export const MAX_ITEM_QUANTITY = 200;

export interface BriefItem {
  typeId: string;
  sizeId: string;
  quantity: number;
}

export interface Brief {
  author?: string;
  objectType?: string;
  stage?: string;
  city?: string;
  colorId: string;
  deadline?: string;
  comment?: string;
  items: BriefItem[];
}

export interface BriefEstimate {
  /** Всего изделий во всех позициях. */
  items: number;
  /** Сумма ориентиров по позициям, где он есть, ₽. */
  min: number;
  max: number;
  /** Позиции без ориентира — считаются по эскизу. */
  unpriced: number;
  discountPercent: number;
  /** Ориентир со скидкой дизайнера, ₽. */
  discountedMin: number;
  discountedMax: number;
}

function quantityOf(item: BriefItem): number {
  if (!Number.isFinite(item.quantity)) return 0;
  return Math.min(MAX_ITEM_QUANTITY, Math.max(0, Math.floor(item.quantity)));
}

function roundTo100(value: number): number {
  return Math.round(value / 100) * 100;
}

/**
 * Ориентир по проекту: средняя плотность плетения, выбранный цвет и размер.
 * Это не оферта — точную цену фиксирует КП по эскизу.
 */
export function estimateBrief(brief: Brief): BriefEstimate {
  let items = 0;
  let min = 0;
  let max = 0;
  let unpriced = 0;
  for (const item of brief.items) {
    const quantity = quantityOf(item);
    if (!quantity) continue;
    items += quantity;
    const pricingId = BRIEF_ITEM_TYPES.find(
      (t) => t.id === item.typeId,
    )?.pricingId;
    const price = pricingId
      ? calculatePrice({
          productType: pricingId,
          size: item.sizeId,
          color: brief.colorId,
          complexity: "standard",
        })
      : null;
    if (!price) {
      unpriced += 1;
      continue;
    }
    min += price.min * quantity;
    max += price.max * quantity;
  }
  const discountPercent = designerDiscount(items);
  const factor = 1 - discountPercent / 100;
  return {
    items,
    min,
    max,
    unpriced,
    discountPercent,
    discountedMin: roundTo100(min * factor),
    discountedMax: roundTo100(max * factor),
  };
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

/** Текст обращения для мессенджера: всё, что нужно Ольге для расчёта. */
export function briefMessage(brief: Brief): string {
  const estimate = estimateBrief(brief);
  const object = [brief.objectType, brief.city?.trim()]
    .filter(Boolean)
    .join(", ");
  const lines = brief.items
    .filter((item) => quantityOf(item) > 0)
    .map((item, index) => {
      const type =
        BRIEF_ITEM_TYPES.find((t) => t.id === item.typeId)?.label ?? "Изделие";
      const size = SIZES.find((s) => s.id === item.sizeId)?.hint;
      return `${index + 1}. ${type}${size ? `, ${size}` : ""} — ${quantityOf(item)} шт.`;
    });
  const color = COLORS.find((c) => c.id === brief.colorId)?.label;
  const range =
    estimate.max > 0
      ? `${formatRub(estimate.min)}–${formatRub(estimate.max)}`
      : null;
  return [
    "Здравствуйте, Ольга! Я дизайнер интерьера, хочу обсудить изделия для проекта.",
    brief.author?.trim() && `Студия / дизайнер: ${brief.author.trim()}`,
    object && `Объект: ${object}`,
    brief.stage && `Стадия: ${brief.stage}`,
    lines.length > 0 && ["Позиции:", ...lines].join("\n"),
    color && `Цвет: ${color}`,
    brief.deadline && `Нужно к: ${formatDate(brief.deadline)}`,
    range &&
      `Ориентир с сайта: ${range} без скидки дизайнера${estimate.unpriced ? ", без позиций по эскизу" : ""}`,
    brief.comment?.trim() && `Комментарий: ${brief.comment.trim()}`,
    "Пришлю план, развёртки или визуализации в чат.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ориентир «от» для изделия среднего размера в натуральном цвете. */
export function startingPrice(pricingId: string): string | null {
  const product = PRODUCT_TYPES.find((p) => p.id === pricingId);
  return product ? `от ${formatRub(product.basePrice)}` : null;
}
