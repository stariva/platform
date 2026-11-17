export interface CatalogWorkshop {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  level: string;
  length: string;
}
/** Визуальная подборка, пока мобильный публичный каталог не доступен через API. */
export const catalogWorkshops: [CatalogWorkshop, ...CatalogWorkshop[]] = [
  {
    id: "tree",
    title: "Плетёная ёлка",
    category: "Декор",
    image: "/images/workshop-tree.png",
    description:
      "Создайте праздничный декор своими руками — от первого узла до последней детали.",
    level: "Для начинающих",
    length: "В своём темпе",
  },
  {
    id: "tunic",
    title: "Туника из макраме",
    category: "Одежда",
    image: "/images/workshop-tunic.png",
    description:
      "Лёгкая вещь с характером: освоите узоры и соберёте цельный образ.",
    level: "С опытом",
    length: "В своём темпе",
  },
  {
    id: "mini",
    title: "Платье мини",
    category: "Одежда",
    image: "/images/workshop-mini.png",
    description:
      "Выразительный силуэт и удовольствие от каждого этапа плетения.",
    level: "С опытом",
    length: "В своём темпе",
  },
];
