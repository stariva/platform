/**
 * Цена курса после старта уроков, в рублях. В админке хранится цена
 * предзаказа; когда уроки открываются, скидка заканчивается сама — без
 * ручной правки цены в день старта. Чтобы поменять цену после старта,
 * правьте её здесь.
 */
const PRICE_AFTER_RELEASE: Record<string, number> = {
  "elka-makrame": 990,
  "elka-makrame-bolshaya": 990,
};

/** Цена после старта, если у курса есть скидка предзаказа. */
export function priceAfterRelease(slug: string): number | undefined {
  return PRICE_AFTER_RELEASE[slug];
}

/**
 * Цена на сейчас: до старта — цена из админки, после — цена после старта.
 * Цена из админки выше цены после старта не снижается.
 */
export function currentWorkshopPrice({
  slug,
  price,
  releaseAt,
  now = new Date(),
}: {
  slug: string;
  price: number;
  releaseAt: Date | null | undefined;
  now?: Date;
}): number {
  const regular = priceAfterRelease(slug);
  if (regular === undefined || price >= regular) return price;
  const released = !releaseAt || releaseAt.getTime() <= now.getTime();
  return released ? regular : price;
}
