import type { Category } from "./ozon-types";

export const categories: Category[] = [
  {
    slug: "clothes",
    name: "Одежда",
    description:
      "Туники, накидки, пояса и комплекты из натурального хлопка, созданные вручную в технике макраме",
    image: "/images/catalog/category-clothes.jpg",
    hero: {
      image: "/images/catalog/hero-clothes-editorial.webp",
      alt: "Туника, топ и пояс из хлопкового макраме на деревянной вешалке",
      width: 2164,
      height: 727,
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
    image: "/images/catalog/category-decor.jpg",
    hero: {
      image: "/images/catalog/hero-bags-editorial.webp",
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
      "Абажуры, панно, плейсменты и вигвамы — изделия, которые создают уют в вашем доме",
    image: "/images/catalog/category-interior.jpg",
    hero: {
      image: "/images/catalog/hero-interior-editorial.webp",
      alt: "Хлопковый абажур и панно макраме в интерьере при дневном свете",
      width: 2172,
      height: 724,
      objectPosition: "69% top",
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
