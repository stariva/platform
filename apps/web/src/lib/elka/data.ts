import type { Product } from "@/lib/ozon-types";

/**
 * Общее для страниц ёлки: мастер-класса (/elka-makrame) и готовых ёлок
 * (/elka-makrame-na-stenu), а ещё главной, блога и sitemap. Без серверных
 * зависимостей — модуль можно импортировать и в клиентских компонентах.
 */

/** Страница мастер-класса по ёлке. */
export const WORKSHOP_PATH = "/elka-makrame";
/** Страница готовых ёлок. */
export const TREES_PATH = "/elka-makrame-na-stenu";

export const WORKSHOP_SLUG = "elka-makrame";
/** Цена мастер-класса после выхода. Предзаказная цена берётся из базы. */
export const WORKSHOP_REGULAR_PRICE = 990;
/** Показываем, пока мастер-класс не опубликован в базе. */
export const WORKSHOP_PREORDER_FALLBACK_PRICE = 690;
/** Ёлка из этого мастер-класса. Неразрывные пробелы — размер не рвётся переносом. */
export const WORKSHOP_TREE_SIZE = "50 × 110 см";
/**
 * Подарок за предзаказ: второй мастер-класс — большая ёлка. Доступ выдаётся
 * сам при оплате предзаказа (lib/workshops/preorder-bonus.ts) и появится в
 * кабинете, когда курс elka-makrame-bolshaya опубликуют в админке.
 */
export const BONUS_TREE_SIZE = "75 × 150 см";
/** Подпись старта, пока у курса в админке не задана дата «Старт уроков». */
export const WORKSHOP_RELEASE_LABEL = "20 октября";
/** Выход мастер-класса по большой ёлке. */
export const BONUS_RELEASE_LABEL = "3 ноября";

/** Заказ до этой даты успевает к празднику: 2–3 дня плетения и доставка. */
export const ORDER_DEADLINE_DAY = 20;
export const ORDER_DEADLINE_LABEL = `${ORDER_DEADLINE_DAY} декабря`;

/**
 * Текст лендинга про модель ёлки. Цена, фото, ссылка и наличие — только
 * у товара из базы (по slug), здесь их нет.
 */
export interface TreeModel {
  slug: string;
  name: string;
  color: string;
  size: string;
  bestFor: string;
  highlights: string[];
}

/** Модель и её товар из базы; модели без опубликованного товара не показываем. */
export interface ModelWithProduct {
  model: TreeModel;
  product: Product;
}

export const TREE_MODELS: TreeModel[] = [
  {
    slug: "elka-panno-makrame-0687",
    name: "Ёлка в технике макраме, бежевая",
    color: "Бежевый, натуральный, молочный",
    size: "70–75 × 150 см",
    bestFor: "Гостиная, лобби отеля, зал ресторана",
    highlights: [
      "Заметна с порога — работает как фотозона",
      "Три оттенка: бежевый, натуральный, молочный",
      "Вешается за звезду на один крючок — без сверления",
    ],
  },
  {
    slug: "elka-panno-makrame-8124",
    name: "Ёлка в технике макраме, хаки",
    color: "Хаки",
    size: "45 × 100 см",
    bestFor: "Детская, прихожая, салон, ресепшен",
    highlights: [
      "Компактная — для небольших стен",
      "Глубокий природный оттенок",
      "Вешается за звезду на один крючок — без сверления",
    ],
  },
];

/** Фото ёлки у покупателя с идеей украшения — для галереи на обеих страницах. */
export interface CustomerLook {
  slug: string;
  image: string;
  alt: string;
  title: string;
  text: string;
  /** Метка поверх фото, например связь с соседним кадром. */
  note?: string;
  /** object-position: где на фото ёлка, чтобы она не обрезалась в плитке. */
  position?: string;
}

/** Порядок важен: первые два кадра — одна ёлка в двух нарядах, они идут рядом. */
export const CUSTOMER_LOOKS: CustomerLook[] = [
  {
    slug: "deer-medallions",
    image: "/images/elka/customers/deer-medallions.webp",
    alt: "Ёлка макраме на стене в детской с деревянными оленями на узлах и тремя медальонами с бантами на перекладине",
    title: "Олени и медальоны",
    text: "Деревянные олени — прямо на узлах, медальоны с бантами — на перекладине.",
    position: "50% 30%",
  },
  {
    slug: "paper-flags",
    image: "/images/elka/customers/paper-flags.webp",
    alt: "Та же ёлка макраме без игрушек, с бусинами на бахроме и бумажными флажками на концах перекладины",
    title: "Флажки и бусины",
    text: "Та же ёлка в другой раз: игрушки сняли, на перекладину повесили бумажные флажки.",
    note: "Та же ёлка",
    position: "50% 30%",
  },
  {
    slug: "fairy-lights",
    image: "/images/elka/customers/fairy-lights.webp",
    alt: "Ёлка макраме с гирляндой-нитью и маленькими игрушками светится вечером на стене рядом с игрушечной мышкой",
    title: "Гирлянда в узлах",
    text: "Нить с огоньками продета прямо в плетение — вечером ёлка светит как ночник.",
    position: "30% 50%",
  },
  {
    slug: "wooden-stars",
    image: "/images/elka/customers/wooden-stars.webp",
    alt: "Ёлка макраме без игрушек на светлой стене из вагонки, на бахроме деревянные звёзды и бусины",
    title: "Ничего лишнего",
    text: "Деревянные звёзды и бусины на бахроме — ёлка хороша и без игрушек.",
    position: "50% 40%",
  },
  {
    slug: "veranda-milk",
    image: "/images/elka/customers/veranda-milk.webp",
    alt: "Молочная ёлка макраме в беседке под гирляндой из заснеженной хвои, ниже — плетёные кресла",
    title: "Молочная — в беседке",
    text: "Светлая ёлка под «заснеженной» хвойной гирляндой — праздничный уголок за городом.",
    position: "50% 100%",
  },
  {
    slug: "bead-stars",
    image: "/images/elka/customers/bead-stars.webp",
    alt: "Ёлка макраме в спальне с тремя звёздами из деревянных бусин и звёздочками на бахроме",
    title: "Звёзды из бусин",
    text: "Три звезды из деревянных бусин в тон бахроме — спокойно и в одной гамме.",
    position: "50% 20%",
  },
];
