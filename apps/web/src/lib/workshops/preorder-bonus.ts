/** Мастер-класс в подарок тем, кто оформил предзаказ основного. */
export interface PreorderBonus {
  /** Адрес курса-подарка; курс может появиться в базе позже — доступ ждёт его. */
  slug: string;
  /** «мастер-класс по большой ёлке 75 × 150 см» — для писем и страниц. */
  title: string;
  /** «3 ноября» — когда подарок откроется. */
  releaseLabel: string;
}

const BONUSES: Record<string, PreorderBonus> = {
  "elka-makrame": {
    slug: "elka-makrame-bolshaya",
    title: "мастер-класс по большой ёлке 75 × 150 см",
    releaseLabel: "3 ноября",
  },
};

/** Курс сам является подарком за предзаказ другого курса. */
export function isPreorderBonusSlug(slug: string): boolean {
  return Object.values(BONUSES).some((bonus) => bonus.slug === slug);
}

/** Основной курс, к предзаказу которого дарят этот. */
export function preorderBonusParent(slug: string): string | undefined {
  return Object.entries(BONUSES).find(([, bonus]) => bonus.slug === slug)?.[0];
}

/**
 * Курс-подарок не продаём, пока его дарят: основной курс ещё на предзаказе.
 * Иначе один и тот же курс на сайте одновременно и подарок, и товар.
 */
export function isGiftOnly(
  slug: string,
  parentReleaseAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!preorderBonusParent(slug) || !parentReleaseAt) return false;
  return now.getTime() < parentReleaseAt.getTime();
}

/** Подарок к курсу, если он есть. */
export function preorderBonusFor(slug: string): PreorderBonus | undefined {
  return BONUSES[slug];
}

/**
 * Подарок положен, если заказ оформлен до старта основного курса. Берём
 * момент оформления, а не оплаты: вебхук может прийти уже после старта.
 */
export function earnsPreorderBonus({
  workshopSlug,
  orderedAt,
  releaseAt,
}: {
  workshopSlug: string;
  orderedAt: Date;
  releaseAt: Date | null | undefined;
}): PreorderBonus | undefined {
  const bonus = preorderBonusFor(workshopSlug);
  if (!bonus || !releaseAt) return undefined;
  return orderedAt.getTime() < releaseAt.getTime() ? bonus : undefined;
}
