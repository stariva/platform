import type { Product } from "./catalog/types";
import { productSectionKey } from "./products";

interface HomeCopy {
  title: string;
  details: string;
}

/**
 * Подписи карточек «Примеры работ» на главной. Сами товары отмечаются
 * в админке переключателем «Показывать на главной», а заголовок и текст
 * берутся по разделу каталога (ключи — как у productSectionKey).
 */
const sectionCopy: Record<string, HomeCopy> = {
  clothes: {
    title: "Одежда по вашим меркам",
    details: "Подберу длину и посадку, помогу снять мерки и выбрать цвет.",
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
    details: "Подберу размер и оттенок под ваш интерьер.",
  },
};

export function getHomeCopy(
  product: Pick<Product, "category" | "subcategory">,
): HomeCopy {
  return (
    sectionCopy[productSectionKey(product)] ?? {
      title: "Сплету для вас",
      details: "Размер, цвет и детали обсудим вместе.",
    }
  );
}
