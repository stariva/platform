/** Merchandising only: prices, stock and Ozon SKUs always come from products.
 * Publish these slugs as interior / planters, madeToOrder=false.
 * Sets are separately packed stock with their own SKU, never virtual bundles.
 */
export const NEW_YEAR_PATH = "/novogodnie-ukrasheniya";
export const NEW_YEAR_IMAGE = "/images/new-year/collection.jpg";

export const ornaments = [
  {
    id: "bell",
    name: "Колокольчик",
    detail: "Бант, цветочная розетка и праздничный звон в силуэте.",
  },
  {
    id: "bublik",
    name: "Венок с бантом",
    detail: "Круглый подвес с ажурной серединой и растительным узором.",
  },
  {
    id: "house",
    name: "Пряничный домик",
    detail:
      "Маленькое окошко, заснеженная крыша и настроение домашнего праздника.",
  },
  {
    id: "ornament",
    name: "Кокошник",
    detail:
      "Ажурный орнамент и выразительный силуэт народного головного убора.",
  },
  {
    id: "samovar",
    name: "Самовар",
    detail: "Узорный самовар — маленький символ большого гостеприимства.",
  },
  {
    id: "snowflake",
    name: "Снежинка",
    detail: "Шесть лучей и цветочная розетка в центре.",
  },
  {
    id: "star",
    name: "Звезда",
    detail: "Пятиконечная звезда с цветочным узором.",
  },
  {
    id: "varezhka",
    name: "Варежка",
    detail: "Зимний силуэт с манжетой и нежным растительным орнаментом.",
  },
  {
    id: "window",
    name: "Резной наличник",
    detail: "Распахнутые ставни и узоры, вдохновлённые деревянным зодчеством.",
  },
] as const;

export type Ornament = (typeof ornaments)[number];
export const ornamentSlug = (id: Ornament["id"]) =>
  `novogodnee-ukrashenie-${id}`;
export const ornamentImage = (id: Ornament["id"]) =>
  `/images/new-year/${id}.svg`;

export const ornamentSets = [
  {
    slug: "novogodniy-nabor-zimniy-uyut",
    name: "Зимний уют",
    description:
      "Знакомые с детства символы зимы. Для небольшой ёлки или праздничного уголка дома.",
    ids: ["house", "varezhka", "star", "bublik", "bell", "snowflake"],
  },
  {
    slug: "novogodniy-nabor-russkaya-skazka",
    name: "Русская сказка",
    description:
      "Вся коллекция: от пряничного домика до резного наличника. Девять разных историй на одной ёлке.",
    ids: ornaments.map((item) => item.id),
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
