/** The landing and checkout share this price allocation; checkout validates it again. */
export type KitAccessMode = "single_lesson" | "separate_gifts";

export function resolveKitOrderGift(
  mode: KitAccessMode | null | undefined,
  gift?: boolean,
): boolean | undefined {
  return mode ? mode === "separate_gifts" : gift;
}

export const KIT_COLORS = [
  {
    slug: "nabor-makrame-elka-bezhevyy",
    label: "Бежевый",
    hint: "Для светлых интерьеров, сканди и минимализма",
    swatch: "#e9dac2",
  },
  {
    slug: "nabor-makrame-elka-shalfey",
    label: "Шалфей",
    hint: "Спокойный оттенок для белых, серых и пастельных стен",
    swatch: "#a9b5a4",
  },
  {
    slug: "nabor-makrame-elka",
    label: "Хаки",
    hint: "Хвойный акцент для светлой стены и тёплого дерева",
    swatch: "#767b56",
  },
] as const;

const KIT_SLUGS = new Set<string>(KIT_COLORS.map((color) => color.slug));

export function isElkaKitSlug(slug: string): boolean {
  return KIT_SLUGS.has(slug);
}

export interface KitBundleLine {
  productSlug: string;
  quantity: number;
  price: number; // kopecks per unit
  fulfillmentType?: string;
}

/**
 * Цены набора складываются из материалов и видеоурока — по 990 ₽. Урок всегда
 * оплачивается полностью за каждый доступ, скидка действует только на
 * материалы: 2 набора — по 900 ₽ (−90 ₽ с комплекта), 3 набора — по 810 ₽
 * (−180 ₽ с комплекта).
 */
const KIT_LESSON_PRICE_KOPECKS = 99_000;
const KIT_MATERIALS_LIST_PRICE_KOPECKS = 99_000;
const KIT_MATERIALS_UNIT_PRICE_KOPECKS: Partial<Record<number, number>> = {
  2: 90_000,
  3: 81_000,
};

function kitLessonsTotal(count: number, mode: KitAccessMode): number {
  return KIT_LESSON_PRICE_KOPECKS * (mode === "single_lesson" ? 1 : count);
}

export function kitBundleTotal(
  count: number,
  mode: KitAccessMode,
): number | null {
  const materials = KIT_MATERIALS_UNIT_PRICE_KOPECKS[count];
  if (!materials) return null;
  return materials * count + kitLessonsTotal(count, mode);
}

/**
 * Зачёркнутая база комплекта: те же доступы к уроку, но материалы без
 * скидки. Экономия на материалах — 180 ₽ для двух наборов, 540 ₽ для трёх.
 */
export function kitBundleBaseTotal(
  count: number,
  mode: KitAccessMode,
): number | null {
  const materials = KIT_MATERIALS_UNIT_PRICE_KOPECKS[count];
  if (!materials) return null;
  return (
    KIT_MATERIALS_LIST_PRICE_KOPECKS * count + kitLessonsTotal(count, mode)
  );
}

/** Цена одного набора внутри комплекта: 1 395 ₽, 1 890 ₽ и так далее. */
export function kitBundleUnitPrice(
  count: number,
  mode: KitAccessMode,
): number | null {
  const total = kitBundleTotal(count, mode);
  return total && total % count === 0 ? total / count : null;
}

/** Return null unless the entire order is an eligible two or three kit bundle. */
export function priceKitBundleLines<T extends KitBundleLine>(
  lines: T[],
  mode: KitAccessMode,
): T[] | null {
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = kitBundleTotal(count, mode);
  if (
    !total ||
    !lines.length ||
    lines.some(
      (line) =>
        !isElkaKitSlug(line.productSlug) ||
        line.fulfillmentType === "made_to_order" ||
        line.quantity < 1,
    )
  )
    return null;
  const listTotal = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  if (listTotal < total) return null;
  const unit = total / count;
  if (!Number.isInteger(unit)) return null;
  return lines.map((line) => ({ ...line, price: unit }));
}
