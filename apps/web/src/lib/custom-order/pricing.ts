// ─── Модель ценообразования индивидуальных заказов ──────────────────────────
// Чистые данные и функции — используются и калькулятором (клиент),
// и AI-эндпоинтом (сервер), чтобы оценки были согласованы.

export interface PricingOption {
  id: string;
  label: string;
  /** Множитель или базовая цена в зависимости от группы. */
  value: number;
  hint?: string;
}

export interface ProductType {
  id: string;
  label: string;
  /** Базовая стоимость изделия среднего размера, ₽. */
  basePrice: number;
  description: string;
}

export const PRODUCT_TYPES: ProductType[] = [
  {
    id: "lampshade",
    label: "Абажур",
    basePrice: 4200,
    description: "Подвесной или настольный абажур из хлопкового шнура",
  },
  {
    id: "panel",
    label: "Панно",
    basePrice: 5000,
    description: "Настенное панно для интерьера",
  },
  {
    id: "bag",
    label: "Сумка / авоська",
    basePrice: 2800,
    description: "Сумка, авоська или корзина",
  },
  {
    id: "clothes",
    label: "Одежда",
    basePrice: 7500,
    description: "Платье, топ, накидка или пояс",
  },
  {
    id: "tipi",
    label: "Вигвам / кресло",
    basePrice: 12000,
    description: "Детский вигвам или подвесное кресло",
  },
  {
    id: "plant-hanger",
    label: "Кашпо / подвес",
    basePrice: 2200,
    description: "Подвесное кашпо для растений",
  },
  {
    id: "placemat",
    label: "Плейсменты / декор стола",
    basePrice: 1800,
    description: "Набор салфеток или подставок",
  },
  {
    id: "other",
    label: "Другое",
    basePrice: 3800,
    description: "Свой вариант изделия",
  },
];

export const SIZES: PricingOption[] = [
  { id: "s", label: "Маленький", value: 0.75, hint: "до 30 см" },
  { id: "m", label: "Средний", value: 1, hint: "30–60 см" },
  { id: "l", label: "Большой", value: 1.45, hint: "60–100 см" },
  { id: "xl", label: "Очень большой", value: 2, hint: "от 100 см" },
];

export const COLORS: PricingOption[] = [
  { id: "natural", label: "Натуральный хлопок", value: 0 },
  { id: "single", label: "Окрашивание в один цвет", value: 0.1 },
  { id: "multi", label: "Несколько цветов", value: 0.22 },
];

export const COMPLEXITIES: PricingOption[] = [
  { id: "simple", label: "Простой узор", value: 0.85 },
  { id: "standard", label: "Стандартный", value: 1 },
  { id: "intricate", label: "Сложный, плотное плетение", value: 1.4 },
];

export interface PriceSelection {
  productType: string;
  size: string;
  color: string;
  complexity: string;
}

export interface PriceEstimate {
  /** Усреднённая оценка, ₽. */
  base: number;
  /** Нижняя граница диапазона, ₽. */
  min: number;
  /** Верхняя граница диапазона, ₽. */
  max: number;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Рассчитывает примерную стоимость по выбранным параметрам.
 * Возвращает null, если тип изделия не выбран или не найден.
 */
export function calculatePrice(
  selection: Partial<PriceSelection>,
): PriceEstimate | null {
  const product = PRODUCT_TYPES.find((p) => p.id === selection.productType);
  if (!product) return null;

  const size = SIZES.find((s) => s.id === selection.size)?.value ?? 1;
  const colorAdd = COLORS.find((c) => c.id === selection.color)?.value ?? 0;
  const complexity =
    COMPLEXITIES.find((c) => c.id === selection.complexity)?.value ?? 1;

  const base = product.basePrice * size * (1 + colorAdd) * complexity;
  const rounded = roundTo(base, 50);

  return {
    base: rounded,
    min: roundTo(rounded * 0.88, 50),
    max: roundTo(rounded * 1.18, 50),
  };
}

export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Человекочитаемое описание выбора — для AI-промпта и текста заявки. */
export function describeSelection(selection: Partial<PriceSelection>): string {
  const product = PRODUCT_TYPES.find((p) => p.id === selection.productType);
  const size = SIZES.find((s) => s.id === selection.size);
  const color = COLORS.find((c) => c.id === selection.color);
  const complexity = COMPLEXITIES.find((c) => c.id === selection.complexity);

  return [
    product ? `Тип: ${product.label}` : null,
    size ? `Размер: ${size.label}${size.hint ? ` (${size.hint})` : ""}` : null,
    color ? `Цвет: ${color.label}` : null,
    complexity ? `Сложность: ${complexity.label}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
