import type { Product } from "./catalog/types";

/** Merchandising only: prices, photos and descriptions always come from products.
 * Publish figurines as interior / ornaments, sets as interior / ornament_sets
 * and printable packaging as interior / gift_boxes; madeToOrder=true.
 * They are produced after payment, so neither stock nor Ozon Seller SKUs are
 * needed: delivery is calculated and shipped through Ozon Delivery for Business.
 * The base set is without the printable box: packaging is a separate
 * gift_boxes product, so the buyer can choose either variant.
 */
export const NEW_YEAR_PATH = "/novogodnie-ukrasheniya";
export const NEW_YEAR_IMAGE = "/images/new-year/hero-russkaya-skazka-v2.webp";
export const NEW_YEAR_CARD_IMAGE =
  "/images/new-year/category-russkaya-skazka.webp";

/**
 * Посылка любой конфигурации новогоднего набора — по ней Ozon считает доставку
 * до оплаты. Выбранная покупателем коробка не меняет внешний отправочный размер:
 * все составы помещаются в одинаковый транспортный короб.
 */
export const NEW_YEAR_PARCEL = {
  weightGrams: 700,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
} as const;

/** Отдельные фигурки печатаются партиями: меньше этого количества заказ не принимаем. */
export const MIN_NEW_YEAR_ORNAMENT_QUANTITY = 7;

export function pluralFigurines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "фигурка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "фигурки";
  }
  return "фигурок";
}

export const ornaments = [
  {
    id: "shar",
    name: "Ёлочный шар",
    detail:
      "Круглый подвес с крупным цветком, веточками и растительным узором.",
  },
  {
    id: "matryoshka",
    name: "Матрёшка",
    detail:
      "Расписная матрёшка в цветочном платке — самый узнаваемый народный образ.",
  },
  {
    id: "loshadka",
    name: "Лошадка",
    detail: "Узорная лошадка с цветочной сбруей — образ народной игрушки.",
  },
  {
    id: "house",
    name: "Домик",
    detail: "Уютный домик с резными ставнями и тёплым светом в окнах.",
  },
  {
    id: "samovar",
    name: "Самовар",
    detail:
      "Нарядный самовар с цветочной розеткой — символ чаепития и гостеприимства.",
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
    name: "Петух",
    detail: "Нарядный петух с цветком на крыле — символ домашнего тепла.",
  },
  {
    id: "bublik",
    name: "Баранка",
    detail: "Круглый подвес с ажурной серединой и растительным узором.",
  },
  {
    id: "koza",
    name: "Коза",
    detail:
      "Нарядная коза с цветком на роге — символ достатка и весёлой святки.",
  },
  {
    id: "kozlik",
    name: "Козлик",
    detail:
      "Шаловливый козлик с цветочным узором — добрый знак наступающего года.",
  },
  {
    id: "snowflake",
    name: "Снежинка",
    detail: "Ажурная снежинка с цветочной розеткой и народным орнаментом.",
  },
  {
    id: "bell",
    name: "Колокольчик",
    detail: "Нарядный колокольчик с бантом, цветочной розеткой и бусинами.",
  },
  {
    id: "star",
    name: "Звезда",
    detail: "Пятиконечная звезда с резным цветком и молочным контуром.",
  },
  {
    id: "varezhka",
    name: "Варежка",
    detail: "Тёплая варежка с цветком, завитками и уютным зимним узором.",
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
      "Семь уютных символов зимы — от снежинки до самовара. Для ёлки или праздничного уголка дома.",
    ids: [
      "snowflake",
      "varezhka",
      "bell",
      "star",
      "house",
      "samovar",
      "bublik",
    ],
  },
  {
    slug: "novogodniy-nabor-russkaya-skazka",
    name: "Русская сказка",
    description:
      "Семь образов народной сказки на одной ёлке — от матрёшки до резного наличника.",
    ids: [
      "shar",
      "matryoshka",
      "petukh",
      "loshadka",
      "balalaika",
      "window",
      "koza",
    ],
  },
] satisfies {
  slug: string;
  name: string;
  description: string;
  ids: Ornament["id"][];
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
  madeToOrder: boolean;
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
    madeToOrder: product.madeToOrder,
    material: product.material,
    dimensions: product.dimensions,
    color: product.color,
  };
}

export interface NewYearSetCompositionItem<TProduct> {
  id: Ornament["id"];
  name: string;
  slug: string;
  product?: TProduct;
}

export interface NewYearSetMerchandising<TProduct> {
  definition?: (typeof ornamentSets)[number];
  items: NewYearSetCompositionItem<TProduct>[];
  separateTotal?: number;
  savings?: number;
}

/**
 * Мерчандайзинговые данные готового набора: статический состав коллекции
 * плюс актуальные цены отдельных фигурок из каталога. Если хотя бы одной
 * фигурки нет в каталоге, честное сравнение цен не показываем.
 */
export function newYearSetMerchandising<
  TSet extends { slug: string; price: number; currency: string },
  TOrnament extends { slug: string; price: number; currency: string },
>(
  setProduct: TSet,
  ornamentProducts: TOrnament[],
): NewYearSetMerchandising<TOrnament> {
  const definition = ornamentSets.find((set) => set.slug === setProduct.slug);
  if (!definition) return { items: [] };

  const items = definition.ids.map((id) => {
    const slug = ornamentSlug(id);
    return {
      id,
      name: ornaments.find((item) => item.id === id)?.name ?? id,
      slug,
      product: ornamentProducts.find((product) => product.slug === slug),
    };
  });
  const canCompare =
    items.length > 0 &&
    items.every(
      (item) =>
        item.product &&
        item.product.price > 0 &&
        item.product.currency === setProduct.currency,
    );
  const separateTotal = canCompare
    ? items.reduce((sum, item) => sum + (item.product?.price ?? 0), 0)
    : undefined;
  const savings =
    separateTotal !== undefined && separateTotal > setProduct.price
      ? separateTotal - setProduct.price
      : undefined;

  return { definition, items, separateTotal, savings };
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

/** Сколько физических фигурок в одной единице товара: одна отдельная или состав набора. */
export function newYearFigurinesPerItem(slug: string): number {
  if (ornamentIdForSlug(slug)) return 1;
  return ornamentSets.find((set) => set.slug === slug)?.ids.length ?? 0;
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

const LEGACY_BOX_SLUGS = ["novogodnyaya-podarochnaya-korobka"];

export function newYearSubcategoryFor(
  product: Pick<Product, "slug" | "subcategory">,
): NewYearSubcategory | undefined {
  if (isNewYearSubcategory(product.subcategory)) return product.subcategory;
  if (product.subcategory !== "planters") return undefined;
  if (ornaments.some((item) => ornamentSlug(item.id) === product.slug)) {
    return "ornaments";
  }
  if (ornamentSets.some((set) => set.slug === product.slug)) {
    return "ornament_sets";
  }
  if (LEGACY_BOX_SLUGS.includes(product.slug)) return "gift_boxes";
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
  const groups: NewYearProductGroups = { ornaments: [], sets: [], boxes: [] };
  for (const product of products) {
    switch (newYearSubcategoryFor(product)) {
      case "ornaments":
        groups.ornaments.push(product);
        break;
      case "ornament_sets":
        groups.sets.push(product);
        break;
      case "gift_boxes":
        groups.boxes.push(product);
        break;
    }
  }
  return groups;
}
