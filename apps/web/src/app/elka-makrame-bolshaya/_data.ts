import { BONUS_TREE_SIZE } from "@/lib/elka/data";
import {
  formatPrice,
  formatReleaseDate,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";
import { CARE_FAQ, REGISTRATION_FAQ } from "../elka-makrame/_data";

/** Якоря лендинга большой ёлки — свои, чтобы не путать цели с маленькой. */
export const SECTION_ID = "big-tree";
export const BUY_ID = "big-tree-buy";
export const QUICK_BUY_ID = "big-tree-quick-buy";

/** Предзаказ и старт уроков большой ёлки. */
export function bigTreeOffer(workshop: Workshop, now = new Date()) {
  const preorder = isPreorder(workshop, now);
  return {
    price: workshop.price,
    preorder,
    regularPrice: preorder ? workshop.regularPrice : undefined,
    releaseLabel: workshop.releaseAt
      ? formatReleaseDate(workshop.releaseAt)
      : undefined,
  };
}

/** Вопросы о большой ёлке; про вес и крепление — своё, у неё полтора метра. */
export function bigTreeFaq(workshop: Workshop) {
  const { preorder, releaseLabel, regularPrice } = bigTreeOffer(workshop);
  const start =
    preorder && releaseLabel
      ? {
          question: "Когда откроются уроки?",
          answer: `${releaseLabel}. Оплатив предзаказ сейчас, вы фиксируете цену ${formatPrice(workshop.price)}${regularPrice ? ` вместо ${formatPrice(regularPrice)}` : ""}, а в день старта уроки появятся в личном кабинете — мы напомним на email.`,
        }
      : {
          question: "Как проходит мастер-класс?",
          answer: `Это мастер-класс в видеоуроках: вы сплетёте ёлку ${BONUS_TREE_SIZE}. Уроки появятся в личном кабинете сразу после оплаты — смотрите в своём темпе и пересматривайте сколько угодно.`,
        };
  return [
    start,
    {
      question: "Справлюсь, если никогда не плели макраме?",
      answer:
        "Да. Ольга показывает каждый шаг: от расчёта шнура и первых узлов до бахромы. Если вопрос всё же возникнет — напишите ей, она ответит.",
    },
    {
      question: "Сколько шнура понадобится?",
      answer:
        "Толщина, цвет и метраж — в PDF-брифе к мастер-классу. Он откроется вместе с уроками, чтобы вы купили ровно столько шнура, сколько нужно.",
    },
    REGISTRATION_FAQ,
    ...CARE_FAQ,
  ];
}
