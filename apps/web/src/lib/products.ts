import type { Category, Product } from "./ozon-types";

export const categories: Category[] = [
  {
    slug: "clothes",
    name: "Одежда",
    description:
      "Туники, накидки, пояса и комплекты из натурального хлопка, созданные вручную в технике макраме",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-clothes-macrame-v4.jpg",
    hero: {
      image:
        "https://cdn.stariva.ru/site/images/catalog/hero-clothes-macrame-v4.webp",
      alt: "Две модели на фоне моря в топе, юбке и платье в технике макраме из хлопкового шнура",
      width: 1671,
      height: 557,
      objectPosition: "72% center",
    },
    subcategories: [
      { slug: "dresses", name: "Туники и накидки", categorySlug: "clothes" },
      { slug: "tops", name: "Топы и комплекты", categorySlug: "clothes" },
      { slug: "belts", name: "Пояса", categorySlug: "clothes" },
    ],
  },
  {
    slug: "bags",
    name: "Сумки",
    description:
      "Авоськи, сумки и корзины ручной работы из хлопкового шнура в технике макраме",
    image: "https://cdn.stariva.ru/site/images/catalog/category-decor.jpg",
    hero: {
      image:
        "https://cdn.stariva.ru/site/images/catalog/hero-bags-editorial.webp",
      alt: "Плетёная хлопковая сумка и клатч на деревянной скамье",
      width: 2172,
      height: 724,
      objectPosition: "72% top",
    },
    subcategories: [
      { slug: "totes", name: "Сумки", categorySlug: "bags" },
      { slug: "crossbody", name: "Авоськи", categorySlug: "bags" },
      { slug: "baskets", name: "Корзины", categorySlug: "bags" },
    ],
  },
  {
    slug: "interior",
    name: "Декор интерьера",
    description:
      "Панно, плейсменты и вигвамы — изделия, которые создают уют в вашем доме",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-interior-macrame-v5.jpg",
    hero: {
      image:
        "https://cdn.stariva.ru/site/images/catalog/hero-interior-macrame-v5.webp",
      alt: "Подвесной светильник и зелёная настенная ёлка в технике макраме из хлопкового шнура в светлой гостиной",
      width: 1671,
      height: 557,
      objectPosition: "60% top",
    },
    subcategories: [
      { slug: "lampshades", name: "Абажуры", categorySlug: "interior" },
      { slug: "tipis", name: "Вигвамы и кресла", categorySlug: "interior" },
      { slug: "pannos", name: "Панно", categorySlug: "interior" },
      { slug: "placemats", name: "Плейсменты", categorySlug: "interior" },
      { slug: "planters", name: "Игрушки и прочее", categorySlug: "interior" },
    ],
  },
];

/**
 * Разделы каталога, которые видит покупатель (меню, /catalog, 404).
 * Абажуры — отдельный раздел со своей страницей, хотя в данных это
 * подкатегория interior; «Декор интерьера» показывается без них.
 */
export const LAMPSHADES_HREF = "/abazhury";
export const LAMPSHADE_SUBCATEGORY = "lampshades";

export const catalogSections = [
  {
    label: "Абажуры",
    href: LAMPSHADES_HREF,
    desc: "Модели ручного плетения для дома и кафе",
    image: "https://cdn.stariva.ru/site/images/catalog/category-interior.jpg",
  },
  {
    label: "Одежда",
    href: "/catalog/clothes",
    desc: "Платья, топы и накидки из натурального хлопка ручного плетения",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-clothes-macrame-v4.jpg",
  },
  {
    label: "Сумки",
    href: "/catalog/bags",
    desc: "Авторские сумки, авоськи и корзины в технике макраме",
    image: "https://cdn.stariva.ru/site/images/catalog/category-bags.jpg",
  },
  {
    label: "Декор интерьера",
    href: "/catalog/interior",
    desc: "Панно, вигвамы, плейсменты и аксессуары для дома",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-interior-macrame-v5.jpg",
  },
];

/** Раздел каталога для хлебных крошек товара: абажуры ведут на свою страницу. */
export function getProductSection(category: Category, subcategory: string) {
  return subcategory === LAMPSHADE_SUBCATEGORY
    ? { name: "Абажуры", href: LAMPSHADES_HREF }
    : { name: category.name, href: `/catalog/${category.slug}` };
}

/** Ключ раздела товара: абажуры отдельно, остальное — по категории. */
export function productSectionKey(
  product: Pick<Product, "category" | "subcategory">,
): string {
  return product.subcategory === LAMPSHADE_SUBCATEGORY
    ? LAMPSHADE_SUBCATEGORY
    : product.category;
}

/** Разделы для фильтров витрины и фида, ключи — как у productSectionKey. */
export const sectionFilters = [
  { slug: LAMPSHADE_SUBCATEGORY, name: "Абажуры" },
  ...categories.map((c) => ({ slug: c.slug, name: c.name })),
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function formatPrice(price: number, currency: string = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
