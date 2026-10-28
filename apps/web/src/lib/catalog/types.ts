/** Отзыв в виде, в котором его показывает витрина (строка таблицы reviews). */
export interface Review {
  id: string;
  rating: number;
  text: string;
  date: string; // ISO-8601
  reviewerName: string;
  /** Артикул Ozon (offer_id), как он указан в источнике */
  productOfferId?: string;
  /** Название товара или объявления в источнике */
  productTitle?: string;
  /** Наши товары, на карточках которых показывается отзыв */
  productIds: string[];
  photos: string[];
  source: "ozon" | "avito" | "site";
}

// ─── Internal Product Types ───────────────────────────────────────────────────

// Internal Product Types
export type ProductCategory = "clothes" | "interior" | "bags";
export type ProductSubcategory =
  | "dresses"
  | "tops"
  | "belts"
  | "lampshades"
  | "tipis"
  | "pannos"
  | "placemats"
  | "planters"
  | "baskets"
  | "totes"
  | "crossbody"
  | "trees";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  oldPrice?: number;
  currency: string;
  images: string[];
  category: ProductCategory;
  subcategory: ProductSubcategory;
  ozonId?: number;
  /** Артикул продавца на Ozon (offer_id) */
  ozonOfferId?: string;
  /** Артикул продавца в Ozon (offer_id). */
  offerId?: string;
  /** fbs_sku/fbo_sku (или общий sku) — нужен для Ozon Доставка (checkout/order/create) */
  ozonSku?: number;
  ozonUrl?: string;
  /** Есть свободный остаток на Ozon — можно купить на сайте сразу. Иначе — под заказ через мастера. */
  inStock: boolean;
  /** Свободный остаток готовых изделий на нашем FBS-складе. */
  stockAvailable: number;
  /** Можно сплести под заказ — в размере и цвете покупателя. */
  madeToOrder: boolean;
  /** Срок изготовления под заказ, если отличается от общего MADE_TO_ORDER_DAYS. */
  leadTimeDays?: { min: number; max: number };
  seoTitle?: string;
  seoDescription?: string;
  material: string;
  dimensions?: string;
  careInstructions?: string;
  /** Автор идеи изделия — выводим сноской в карточке. */
  ideaAuthor?: string;
  color?: string;
  sizes?: string[];
  /** «Лучше всего для: …» — где изделие смотрится лучше всего. */
  bestFor?: string;
  /** Короткие преимущества списком. */
  highlights?: string[];
  featured?: boolean;
}

export interface Category {
  slug: ProductCategory;
  name: string;
  /** Заголовок страницы раздела под поисковые запросы, без «— Stariva». */
  seoTitle: string;
  description: string;
  image: string;
  hero: {
    image: string;
    alt: string;
    width: number;
    height: number;
    objectPosition: string;
  };
  subcategories: Subcategory[];
}

export interface Subcategory {
  slug: ProductSubcategory;
  name: string;
  categorySlug: ProductCategory;
}
