export const ELKA_KIT_SLUG = "nabor-makrame-elka";
export const ELKA_WORKSHOP_SLUG = "elka-makrame";
export const ELKA_KIT_OWNER_PRICE_KOPECKS = 98_000;

/** Цена в копейках; скидка никогда не повышает текущую цену каталога. */
export function elkaKitPrice(
  slug: string,
  catalogPrice: number,
  eligible: boolean,
): number {
  return eligible && slug === ELKA_KIT_SLUG
    ? Math.min(catalogPrice, ELKA_KIT_OWNER_PRICE_KOPECKS)
    : catalogPrice;
}
