import type { Product } from "./catalog/types";

/** Merchandising only: prices, stock, photos and Ozon SKUs always come from products.
 * Publish figurines as interior / ornaments, sets as interior / ornament_sets
 * and printable packaging as interior / gift_boxes; madeToOrder=false.
 * Sets are separately packed stock with their own SKU, never virtual bundles.
 * The base set SKU is without the printable box: packaging is a separate
 * gift_boxes product, so the buyer can choose either variant.
 */
export const NEW_YEAR_PATH = "/novogodnie-ukrasheniya";
export const NEW_YEAR_IMAGE =
  "/images/new-year/collection-russkaya-skazka.webp";

export const ornaments = [
  {
    id: "shar",
    name: "Цветочный шар",
    detail:
      "Круглый подвес с крупным цветком, веточками и растительным узором.",
  },
  {
    id: "window",
    name: "Резной наличник",
    detail: "Распахнутые ставни и узоры, вдохновлённые деревянным зодчеством.",
  },
  {
    id: "balalaika",
    name: "Балалайка",
    detail: "Узорный корпус, тонкий гриф и тёплый музыкальный образ.",
  },
  {
    id: "petukh",
    name: "Петушок",
    detail: "Нарядный петушок с цветком на крыле — символ домашнего тепла.",
  },
  {
    id: "bublik",
    name: "Венок с бантом",
    detail: "Круглый подвес с ажурной серединой и растительным узором.",
  },
] as const;

export type Ornament = (typeof ornaments)[number];
export const ornamentSlug = (id: Ornament["id"]) =>
  `novogodnee-ukrashenie-${id}`;
export const ornamentImage = (id: Ornament["id"]) =>
  `/images/new-year/${id}.png`;

export const ornamentSets = [
  {
    slug: "novogodniy-nabor-zimniy-uyut",
    name: "Зимний уют",
    description:
      "Знакомые с детства символы зимы. Для небольшой ёлки или праздничного уголка дома.",
  },
  {
    slug: "novogodniy-nabor-russkaya-skazka",
    name: "Русская сказка",
    description:
      "Вся коллекция: пять разных историй на одной ёлке — от петушка до резного наличника.",
  },
] satisfies {
  slug: string;
  name: string;
  description: string;
}[];

export function isNewYearProduct(slug: string): boolean {
  return (
    ornaments.some((item) => ornamentSlug(item.id) === slug) ||
    ornamentSets.some((set) => set.slug === slug)
  );
}

export const NEW_YEAR_SUBCATEGORIES = [
  "ornaments",
  "ornament_sets",
  "gift_boxes",
] as const;

export type NewYearSubcategory = (typeof NEW_YEAR_SUBCATEGORIES)[number];

export function isNewYearSubcategory(
  subcategory: string,
): subcategory is NewYearSubcategory {
  return (NEW_YEAR_SUBCATEGORIES as readonly string[]).includes(subcategory);
}

/** Компактная карточка товара для интерактивного конфигуратора. */
export interface NewYearConfiguratorProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: number;
  currency: string;
  images: string[];
  category: Product["category"];
  subcategory: Product["subcategory"];
  ozonSku?: number;
  inStock: boolean;
  stockAvailable: number;
  material: string;
  dimensions?: string;
  color?: string;
}

export function toNewYearConfiguratorProduct(
  product: Product,
): NewYearConfiguratorProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    price: product.price,
    currency: product.currency,
    images: product.images,
    category: product.category,
    subcategory: product.subcategory,
    ozonSku: product.ozonSku,
    inStock: product.inStock,
    stockAvailable: product.stockAvailable,
    material: product.material,
    dimensions: product.dimensions,
    color: product.color,
  };
}

/** id статического эскиза по slug'у товара; нужен только как визуальный fallback. */
export function ornamentIdForSlug(slug: string): Ornament["id"] | undefined {
  const prefix = "novogodnee-ukrashenie-";
  if (!slug.startsWith(prefix)) return undefined;
  const id = slug.slice(prefix.length);
  return ornaments.some((item) => item.id === id)
    ? (id as Ornament["id"])
    : undefined;
}

export function ornamentDetailForSlug(slug: string): string | undefined {
  const id = ornamentIdForSlug(slug);
  return id ? ornaments.find((item) => item.id === id)?.detail : undefined;
}

/** Фото товара из базы; локальный эскиз — только если фото ещё не загружено. */
export function newYearProductImage(
  product: Pick<NewYearConfiguratorProduct, "images" | "slug">,
): string {
  const image = product.images[0];
  if (image && !image.endsWith("/placeholder.jpg")) return image;
  const ornamentId = ornamentIdForSlug(product.slug);
  return ornamentId ? ornamentImage(ornamentId) : "/placeholder.jpg";
}

function isLegacyOrnament(product: Product): boolean {
  return (
    product.subcategory === "planters" &&
    ornaments.some((item) => ornamentSlug(item.id) === product.slug)
  );
}

function isLegacySet(product: Product): boolean {
  return (
    product.subcategory === "planters" &&
    ornamentSets.some((set) => set.slug === product.slug)
  );
}

function isLegacyBox(product: Product): boolean {
  return product.subcategory === "planters" && product.slug.includes("korob");
}

export interface NewYearProductGroups {
  ornaments: Product[];
  sets: Product[];
  boxes: Product[];
}

/**
 * Товары сезонного раздела из каталога. Основной признак — подкатегория,
 * а совпадение старых slug'ов с planters оставлено для переходного периода.
 */
export function groupNewYearProducts(
  products: Product[],
): NewYearProductGroups {
  return {
    ornaments: products.filter(
      (product) =>
        product.subcategory === "ornaments" || isLegacyOrnament(product),
    ),
    sets: products.filter(
      (product) =>
        product.subcategory === "ornament_sets" || isLegacySet(product),
    ),
    boxes: products.filter(
      (product) => product.subcategory === "gift_boxes" || isLegacyBox(product),
    ),
  };
}
