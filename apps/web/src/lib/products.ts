import type { Category } from "./ozon-types";

export const categories: Category[] = [
  {
    slug: "clothes",
    name: "Одежда",
    description:
      "Туники, накидки, пояса и комплекты из натурального хлопка, созданные вручную в технике макраме",
    image: "/images/catalog/category-clothes.jpg",
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
