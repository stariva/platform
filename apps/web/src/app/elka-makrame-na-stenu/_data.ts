import type { Product } from "@/lib/catalog/types";
import { ORDER_DEADLINE_LABEL } from "@/lib/elka/data";
import { madeToOrderLeadTimeOf } from "@/lib/made-to-order";

/** Своё у страницы готовых ёлок; общее с мастер-классом — в lib/elka. */

/** Якорь витрины моделей. */
export const TREES_MODELS_ID = "models";
/** Якорь блока для бизнеса. */
export const TREES_BUSINESS_ID = "business";

export interface Audience {
  title: string;
  text: string;
  image: string;
  alt: string;
}

export const AUDIENCES: Audience[] = [
  {
    title: "Квартира и загородный дом",
    text: "Новогоднее настроение без иголок на полу и без места под живую ель. Вешается за минуту, после праздников сворачивается и хранится годами.",
    image: "/images/elka/hero.png",
    alt: "Ёлка макраме над комодом в скандинавской гостиной",
  },
  {
    title: "Детская",
    text: "Безопасно для детей и животных: мягкий хлопок, ничего не бьётся и не падает. Украшайте вместе фетровыми и деревянными игрушками.",
    image: "/images/elka/kids.png",
    alt: "Небольшая ёлка-панно в технике макраме над кроватью в детской",
  },
  {
    title: "Отели и базы отдыха",
    text: "Праздничный акцент в лобби, на ресепшене и в номерах. Не требует ухода и не нарушает пожарных требований, как живая ель.",
    image: "/images/elka/hotel.png",
    alt: "Ёлка макраме на стене за стойкой ресепшена отеля",
  },
  {
    title: "Рестораны и кафе",
    text: "Готовая фотозона, которую гости выкладывают в соцсети. Не занимает посадочные места и не мешает официантам.",
    image: "/images/elka/restaurant.png",
    alt: "Ёлка-панно в технике макраме на кирпичной стене в кафе",
  },
  {
    title: "Салоны, студии и шоурумы",
    text: "Стильный новогодний декор в спокойных натуральных оттенках: бежевая или хаки ёлка впишется в интерьер и фирменную палитру.",
    image: "/images/elka/office.png",
    alt: "Ёлка макраме цвета хаки в интерьере салона красоты",
  },
];

export const COMPARISON = [
  {
    feature: "Не осыпается и не пахнет пластиком",
    macrame: true,
    live: false,
    artificial: false,
  },
  {
    feature: "Не занимает места на полу",
    macrame: true,
    live: false,
    artificial: false,
  },
  {
    feature: "Безопасна для детей и животных",
    macrame: true,
    live: false,
    artificial: false,
  },
  {
    feature: "Хранится в небольшой коробке",
    macrame: true,
    live: false,
    artificial: false,
  },
  {
    feature: "Служит много лет",
    macrame: true,
    live: false,
    artificial: true,
  },
  {
    feature: "Натуральный материал",
    macrame: true,
    live: true,
    artificial: false,
  },
];

const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);
const upperFirst = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Размеры и оттенки — из ёлок в базе, остальное про работу с бизнесом. */
export function businessPoints(trees: Product[]) {
  const sizes = trees
    .filter((tree) => tree.dimensions)
    .map((tree) =>
      tree.bestFor
        ? `${tree.dimensions} — ${lowerFirst(tree.bestFor)}`
        : tree.dimensions,
    );
  const colors = [
    ...new Set(
      trees.flatMap((tree) =>
        (tree.color ?? "")
          .split(",")
          .map((color) => color.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
  ];
  return [
    ...(sizes.length > 0
      ? [{ title: "Размеры", text: `${sizes.join("; ")}.` }]
      : []),
    ...(colors.length > 0
      ? [
          {
            title: "Спокойные оттенки",
            text: `${upperFirst(colors.join(", "))} — легко впишутся в интерьер.`,
          },
        ]
      : []),
    ...BUSINESS_TERMS,
  ];
}

const BUSINESS_TERMS = [
  {
    title: "Партия для сети",
    text: "Одинаковые ёлки для нескольких филиалов или номерного фонда отеля.",
  },
  {
    title: "Документы",
    text: "Договор, чек для бухгалтерии и доставка по всей России.",
  },
];

/** Размеры и сроки в ответах — из ёлок в базе. */
export function buildFaq(trees: Product[]) {
  const sizes = trees
    .filter((tree) => tree.dimensions)
    .map((tree) =>
      tree.color
        ? `${tree.dimensions} (${lowerFirst(tree.color)})`
        : tree.dimensions,
    );
  return [
    {
      question: "Ёлка успеет к Новому году?",
      answer: `Да. Под заказ ёлка плетётся ${madeToOrderLeadTimeOf(trees)}, доставка по России — 2–7 дней. Чтобы точно получить ёлку к празднику, оформите заказ до ${ORDER_DEADLINE_LABEL}. Ёлка из наличия уходит в доставку на следующий день.`,
    },
    ...FAQ_HANGING,
    {
      question: "Можно ли заказать другой цвет или размер?",
      answer:
        sizes.length > 0
          ? `Ёлки есть в таких размерах: ${sizes.join("; ")}. Других размеров нет.`
          : "Размеры и оттенки ёлок уточните у Ольги — она подскажет, что можно сплести к празднику.",
    },
    ...FAQ_REST,
  ];
}

const FAQ_HANGING = [
  {
    question: "Как повесить ёлку макраме на стену?",
    answer:
      "Ёлка вешается на стену за деревянную звезду — достаточно одного гвоздя, крючка или самоклеящегося крючка на 2–3 кг. Сверлить стену не обязательно.",
  },
];

const FAQ_REST = [
  {
    question: "Можно ли заказать ёлки для отеля, ресторана или офиса?",
    answer:
      "Да. Ольга сплетёт партию одинаковых ёлок для сети, отеля или офиса — по договору и с чеком для бухгалтерии. Напишите, какая модель и сколько штук нужно, — она рассчитает стоимость и сроки.",
  },
  {
    question: "Как хранить ёлку после праздников?",
    answer:
      "Расправьте бахрому, сверните панно, положите в хлопковый мешок или коробку и храните в сухом месте. Ёлка служит много лет и не теряет форму.",
  },
  {
    question: "Как ухаживать за ёлкой макраме?",
    answer:
      "Стирать целиком не нужно: в ёлке есть деревянные детали, от воды они разбухают, могут треснуть и оставить пятна на шнуре. Пыль уберите мягкой щёткой или пылесосом на слабой мощности, а пятно на шнуре аккуратно промокните влажной салфеткой, не задевая дерево. Если бахрома помялась, расправьте её и сбрызните водой из пульверизатора.",
  },
];
