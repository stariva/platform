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

export interface KitBundleLine {
  productSlug: string;
  quantity: number;
  price: number; // kopecks per unit
  fulfillmentType?: string;
}

export function kitBundleTotal(
  count: number,
  mode: KitAccessMode,
): number | null {
  if (count === 2) return mode === "single_lesson" ? 333_000 : 378_000;
  if (count === 3) return mode === "single_lesson" ? 468_000 : 540_000;
  return null;
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
        !KIT_SLUGS.has(line.productSlug) ||
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
