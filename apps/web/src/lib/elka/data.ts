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

export interface TreeModel {
  slug: string;
  href: string;
  name: string;
  color: string;
  size: string;
  fallbackPrice: number;
  fallbackOldPrice?: number;
  fallbackImage: string;
  bestFor: string;
  highlights: string[];
}

/** Модель и её карточка на Ozon — карточки может не быть, тогда цена и фото из модели. */
export interface ModelWithProduct {
  model: TreeModel;
  product?: Product;
}

export const TREE_MODELS: TreeModel[] = [
  {
    slug: "elka-panno-makrame-0687",
    href: "/catalog/interior/elka-panno-makrame-0687",
    name: "Ёлка в технике макраме, бежевая",
    color: "Бежевый, натуральный, молочный",
    size: "70–75 × 150 см",
    fallbackPrice: 4500,
    fallbackOldPrice: 11500,
    fallbackImage: "/images/elka/elka-cream-interior.jpg",
    bestFor: "Гостиная, лобби отеля, зал ресторана",
    highlights: [
      "Заметна с порога — работает как фотозона",
      "Три оттенка: бежевый, натуральный, молочный",
      "Вешается за звезду на один крючок — без сверления",
    ],
  },
  {
    slug: "elka-panno-makrame-8124",
    href: "/catalog/interior/elka-panno-makrame-8124",
    name: "Ёлка в технике макраме, хаки",
    color: "Хаки",
    size: "45 × 100 см",
    fallbackPrice: 3700,
    fallbackOldPrice: 10000,
    fallbackImage: "/images/elka/elka-green-festive.jpg",
    bestFor: "Детская, прихожая, салон, ресепшен",
    highlights: [
      "Компактная — для небольших стен",
      "Глубокий природный оттенок",
      "Вешается за звезду на один крючок — без сверления",
    ],
  },
];
