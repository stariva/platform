import type { Product } from "./ozon-types";
import { productSectionKey } from "./products";

interface HomeCopy {
  title: string;
  details: string;
}

/**
 * Подписи карточек «Изделия мастерской» на главной. Сами товары отмечаются
 * в админке переключателем «Показывать на главной», а заголовок и текст
 * берутся по разделу каталога (ключи — как у productSectionKey).
 */
const sectionCopy: Record<string, HomeCopy> = {
  clothes: {
    title: "Одежда по вашим меркам",
    details: "Подберём длину и посадку. Поможем снять мерки и выбрать цвет.",
  },
  lampshades: {
    title: "Абажур для вашего пространства",
    details:
      "Обсудим диаметр, высоту, оттенок и крепление. Комплектацию уточним до изготовления.",
  },
  bags: {
    title: "Сумка под ваш ритм",
    details:
      "Согласуем размер, цвет и длину ремня. Фурнитуру уточним до изготовления.",
  },
  interior: {
    title: "Декор для вашего дома",
    details: "Подберём размер и оттенок под ваш интерьер.",
  },
};

export function getHomeCopy(
  product: Pick<Product, "category" | "subcategory">,
): HomeCopy {
  return (
    sectionCopy[productSectionKey(product)] ?? {
      title: "Сплетём для вас",
      details: "Размер, цвет и детали обсудим для вашего заказа.",
    }
  );
}
