import { isElkaKitSlug } from "./elka-kit-bundle";

export const ELKA_KIT_SLUG = "nabor-makrame-elka";
export const ELKA_WORKSHOP_SLUG = "elka-makrame";
/** Материалы набора без видеоурока: урок у покупателя мастер-класса уже есть. */
export const ELKA_KIT_OWNER_PRICE_KOPECKS = 99_000;

/**
 * Цена в копейках для любой расцветки набора «Ёлка макраме»; скидка никогда не
 * повышает текущую цену каталога.
 */
export function elkaKitPrice(
  slug: string,
  catalogPrice: number,
  eligible: boolean,
): number {
  return eligible && isElkaKitSlug(slug)
    ? Math.min(catalogPrice, ELKA_KIT_OWNER_PRICE_KOPECKS)
    : catalogPrice;
}
