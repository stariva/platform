// ─── Изготовление под заказ ─────────────────────────────────────────────────
// Всё плетётся вручную под конкретного покупателя, поэтому в карточках товаров
// показываем, что размер и цвет подбираются, а для одежды — снимаются мерки.

import type { ProductCategory } from "@/lib/ozon-types";

export interface MeasurementField {
  id: string;
  label: string;
  /** Подсказка, как снять мерку. */
  hint: string;
}

export interface ColorSwatch {
  id: string;
  label: string;
  hex: string;
}

export interface MadeToOrderConfig {
  /** Короткая плашка для карточки в листинге. */
  badge: string;
  title: string;
  lead: string;
  /** Тип изделия — уходит в заявку как productType. */
  productType: string;
  /** Размеры по умолчанию, если в товаре они не заданы. */
  defaultSizes: string[];
  /** Мерки, которые просим прислать при выборе «по меркам». */
  measurements: MeasurementField[];
  cta: string;
}

/** Срок изготовления изделий на заказ — совпадает с FAQ. */
export const MADE_TO_ORDER_DAYS = "2–4 дня";

export const CUSTOM_SIZE = "По меркам";
export const PHOTO_COLOR = "Как на фото";

/** Базовая палитра хлопкового шнура. Точный оттенок согласуем перед плетением. */
export const COLOR_SWATCHES: ColorSwatch[] = [
  { id: "natural", label: "Натуральный", hex: "#e9dfcc" },
  { id: "milk", label: "Молочный", hex: "#f6f1e7" },
  { id: "beige", label: "Бежевый", hex: "#d4bf9e" },
  { id: "terracotta", label: "Терракота", hex: "#b8674a" },
  { id: "sage", label: "Шалфей", hex: "#9aa58a" },
  { id: "graphite", label: "Графит", hex: "#4a4541" },
];

export const madeToOrder: Record<ProductCategory, MadeToOrderConfig> = {
  clothes: {
    badge: "Сплетём по вашим меркам",
    title: "Сплетём по вашим меркам",
    lead: "Каждую вещь плетём под конкретного человека: выберите стандартный размер или пришлите мерки — изделие сядет точно по фигуре. Цвет шнура тоже на ваш выбор.",
    productType: "Одежда",
    defaultSizes: ["XS", "S", "M", "L", "XL"],
    measurements: [
      {
        id: "height",
        label: "Рост",
        hint: "Без обуви, от макушки до пола",
      },
      {
        id: "bust",
        label: "Обхват груди",
        hint: "По самым выступающим точкам, лента горизонтально",
      },
      {
        id: "waist",
        label: "Обхват талии",
        hint: "По самому узкому месту, не втягивая живот",
      },
      {
        id: "hips",
        label: "Обхват бёдер",
        hint: "По самым выступающим точкам ягодиц",
      },
      {
        id: "length",
        label: "Желаемая длина",
        hint: "От плеча или талии до нужной точки — укажите в комментарии, откуда мерили",
      },
    ],
    cta: "Заказать по своим меркам",
  },
  interior: {
    badge: "Размер и цвет на выбор",
    title: "Подберём размер и цвет",
    lead: "Изделия плетём под заказ: можно изменить диаметр, высоту и цвет шнура под ваш интерьер.",
    productType: "Интерьер / декор",
    defaultSizes: [],
    measurements: [
      { id: "diameter", label: "Диаметр", hint: "Желаемый диаметр изделия" },
      { id: "height", label: "Высота", hint: "Желаемая высота изделия" },
    ],
    cta: "Заказать свой размер",
  },
  bags: {
    badge: "Размер и цвет на выбор",
    title: "Подберём размер и цвет",
    lead: "Сумки плетём под заказ: можно изменить размер, длину ручек и цвет шнура.",
    productType: "Сумка / авоська",
    defaultSizes: [],
    measurements: [
      { id: "width", label: "Ширина", hint: "Желаемая ширина сумки" },
      { id: "height", label: "Высота", hint: "Желаемая высота сумки" },
      {
        id: "handle",
        label: "Длина ручек",
        hint: "Полная длина ручки, от шва до шва",
      },
    ],
    cta: "Заказать свой вариант",
  },
};

export function getMadeToOrder(category: string): MadeToOrderConfig | null {
  return madeToOrder[category as ProductCategory] ?? null;
}
