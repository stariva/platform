import { formatReleaseDate } from "@/lib/workshops-data";

/**
 * Комбо: несколько мастер-классов одним заказом по своей цене. Заказ
 * оформляется на первый курс (письма, «Вы записаны», чек), а с пометкой
 * комбо в заказе оплата выдаёт доступ и к остальным.
 */
export interface WorkshopBundle {
  slug: string;
  /** «Две ёлки макраме» — для платежа, чека и писем. */
  title: string;
  /** Адрес лендинга комбо — на него ведут реклама и письмо о брошенной оплате. */
  path: string;
  /** Цена комбо в копейках. */
  priceKopecks: number;
  /** Основной курс: на него оформляется заказ. */
  main: string;
  /** Курсы, которые выдаются вместе с основным. */
  extras: BundleExtra[];
}

export interface BundleExtra {
  slug: string;
  /** «мастер-класс по большой ёлке 75 × 150 см» — для писем и страниц. */
  title: string;
  /** Старт уроков, как в админке: до него обещаем, когда курс откроется. */
  releaseAt?: string;
}

const BUNDLES: Record<string, WorkshopBundle> = {
  "elka-makrame-kombo": {
    slug: "elka-makrame-kombo",
    title: "Две ёлки макраме",
    path: "/elka-makrame-kombo",
    priceKopecks: 159_000,
    main: "elka-makrame",
    extras: [
      {
        slug: "elka-makrame-bolshaya",
        title: "мастер-класс по большой ёлке 75 × 150 см",
        releaseAt: "2026-11-03T07:00:00.000Z",
      },
    ],
  },
};

export function getBundle(slug: string | null | undefined) {
  return slug ? BUNDLES[slug] : undefined;
}

/** Все курсы комбо: основной первым. */
export function bundleSlugs(bundle: WorkshopBundle): string[] {
  return [bundle.main, ...bundle.extras.map((extra) => extra.slug)];
}

/**
 * Второй курс комбо для писем и страницы «Вы записаны»: до старта — когда
 * откроется, после — без даты, он уже в кабинете.
 */
export function bundleExtraFor(
  bundleSlug: string | null | undefined,
  now = new Date(),
): { title: string; releaseLabel?: string } | undefined {
  const extra = getBundle(bundleSlug)?.extras[0];
  if (!extra) return undefined;
  const { releaseAt } = extra;
  const upcoming = releaseAt && Date.parse(releaseAt) > now.getTime();
  return {
    title: extra.title,
    releaseLabel: upcoming ? formatReleaseDate(releaseAt) : undefined,
  };
}
