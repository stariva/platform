import { BONUS_TREE_SIZE, WORKSHOP_TREE_SIZE } from "@/lib/elka/data";
import type { WorkshopBundle } from "@/lib/workshops/bundles";
import {
  formatPrice,
  formatReleaseDate,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";
import { CARE_FAQ, REGISTRATION_FAQ } from "../elka-makrame/_data";

/** Комбо, которое продаёт эта страница. */
export const KOMBO_SLUG = "elka-makrame-kombo";

/** Якоря лендинга комбо — свои, чтобы цели не смешивались с другими ёлками. */
export const SECTION_ID = "kombo";
export const BUY_ID = "kombo-buy";
export const QUICK_BUY_ID = "kombo-quick-buy";

/** Варианты покупки на лендинге: комбо или одна из ёлок. */
export type KomboChoiceId = "kombo" | "small" | "big";

/**
 * Ссылка, которая выбирает вариант в форме оплаты и прокручивает к ней:
 * `/elka-makrame-kombo#kombo-buy-big`.
 */
export function choiceHash(id: Exclude<KomboChoiceId, "kombo">) {
  return `${BUY_ID}-${id}`;
}

export interface KomboChoice {
  id: KomboChoiceId;
  name: string;
  /** Размеры под названием варианта. */
  note: string;
  /** Курс, на который оформляется заказ; у комбо — основной. */
  slug: string;
  bundle?: string;
  price: number;
  /** Зачёркнутая цена: у комбо — по отдельности, у предзаказа — обычная. */
  oldPrice?: number;
  /** «до 3 ноября» и т. п. — пометка под ценой. */
  badge?: string;
  title: string;
  preorder: boolean;
  buyLabel: string;
  buyGoal: string;
  summary: string;
  /** Последний шаг «Как проходит запись» — когда откроются уроки. */
  access: string;
}

/** Комбо первым — его форма открыта по умолчанию. */
export function komboChoices(
  bundle: WorkshopBundle,
  small: Workshop,
  big: Workshop,
  now = new Date(),
): [KomboChoice, ...KomboChoice[]] {
  const { price, separately, saving, smallReleaseLabel, bigReleaseLabel } =
    komboOffer(bundle, small, big, now);
  const single = (
    id: Exclude<KomboChoiceId, "kombo">,
    workshop: Workshop,
    name: string,
    size: string,
  ): KomboChoice => {
    const preorder = isPreorder(workshop, now) && workshop.releaseAt;
    const releaseLabel = preorder ? formatReleaseDate(preorder) : undefined;
    return {
      id,
      name,
      note: size,
      slug: workshop.slug,
      price: workshop.price,
      oldPrice:
        releaseLabel && (workshop.regularPrice ?? 0) > workshop.price
          ? workshop.regularPrice
          : undefined,
      badge: releaseLabel ? `Предзаказ, уроки ${releaseLabel}` : undefined,
      title: workshop.title,
      preorder: Boolean(releaseLabel),
      buyLabel: `${releaseLabel ? "Оформить предзаказ" : "Купить"} за ${formatPrice(workshop.price)}`,
      buyGoal: `elka_kombo_buy_${id}`,
      summary:
        "Один мастер-класс в видеоуроках: схема, расчёт шнура и список материалов — доступ навсегда.",
      access: releaseLabel
        ? `Уроки откроются ${releaseLabel} — напомним на email`
        : "Уроки открываются сразу — с телефона или компьютера",
    };
  };
  return [
    {
      id: "kombo",
      name: "Обе ёлки — комбо",
      note: `${WORKSHOP_TREE_SIZE.replace(" см", "")} и ${BONUS_TREE_SIZE}`,
      slug: small.slug,
      bundle: bundle.slug,
      price,
      oldPrice: saving > 0 ? separately : undefined,
      badge: saving > 0 ? `Выгоднее на ${formatPrice(saving)}` : undefined,
      title: `Комбо «${bundle.title}»`,
      preorder: false,
      buyLabel: `Купить комбо за ${formatPrice(price)}`,
      buyGoal: "elka_kombo_buy",
      summary:
        "Два мастер-класса одним заказом: видеоуроки, схемы и списки материалов — доступ навсегда.",
      access:
        smallReleaseLabel || bigReleaseLabel
          ? `Ёлка ${WORKSHOP_TREE_SIZE} откроется ${smallReleaseLabel ?? "сразу"}, большая — ${bigReleaseLabel ?? "сразу"}`
          : "Оба мастер-класса открываются сразу — с телефона или компьютера",
    },
    single("small", small, "Только ёлка", WORKSHOP_TREE_SIZE),
    single("big", big, "Только большая ёлка", BONUS_TREE_SIZE),
  ];
}

/**
 * Цена комбо против покупки по отдельности — по сегодняшним ценам на
 * сайте, чтобы экономия на странице всегда была честной.
 */
export function komboOffer(
  bundle: WorkshopBundle,
  small: Workshop,
  big: Workshop,
  now = new Date(),
) {
  const price = bundle.priceKopecks / 100;
  const separately = small.price + big.price;
  const smallPreorder = isPreorder(small, now) && small.releaseAt;
  const bigPreorder = isPreorder(big, now) && big.releaseAt;
  return {
    price,
    separately,
    saving: Math.max(separately - price, 0),
    smallReleaseLabel: smallPreorder
      ? formatReleaseDate(smallPreorder)
      : undefined,
    /** «3 ноября», пока уроки большой ёлки не открылись. */
    bigReleaseLabel: bigPreorder ? formatReleaseDate(bigPreorder) : undefined,
  };
}

/** Вопросы о комбо; про регистрацию и уход — общие с другими ёлками. */
export function komboFaq(
  bundle: WorkshopBundle,
  small: Workshop,
  big: Workshop,
) {
  const { price, separately, bigReleaseLabel } = komboOffer(bundle, small, big);
  return [
    {
      question: "Что входит в комбо?",
      answer: `Два мастер-класса в видеоуроках: ёлка ${WORKSHOP_TREE_SIZE} и большая ёлка ${BONUS_TREE_SIZE}. Вместе они стоят ${formatPrice(price)} — по отдельности вышло бы ${formatPrice(separately)}. К каждому — схема, расчёт шнура и список материалов.`,
    },
    {
      question: "Можно купить только одну ёлку?",
      answer: `Да. В форме оплаты выберите нужный мастер-класс: ёлка ${WORKSHOP_TREE_SIZE} — ${formatPrice(small.price)}, большая ёлка ${BONUS_TREE_SIZE} — ${formatPrice(big.price)}.${separately > price ? ` Обе сразу в комбо — дешевле на ${formatPrice(separately - price)}.` : ""}`,
    },
    {
      question: "Когда откроются уроки?",
      answer: bigReleaseLabel
        ? `Уроки по ёлке ${WORKSHOP_TREE_SIZE} откроются в личном кабинете сразу после оплаты. Большая ёлка — ${bigReleaseLabel}: она появится в том же кабинете сама, доплачивать ничего не нужно.`
        : "Оба мастер-класса откроются в личном кабинете сразу после оплаты. Смотрите в своём темпе и пересматривайте сколько угодно.",
    },
    {
      question: "Справлюсь, если никогда не плели макраме?",
      answer:
        "Да. Начните с ёлки поменьше: на ней Ольга показывает каждый узел от первого шага до бахромы. Большую ёлку плетут теми же узлами — просто рядов больше. Если вопрос всё же возникнет, напишите Ольге, она ответит.",
    },
    {
      question: "Один мастер-класс у меня уже есть. Можно купить комбо?",
      answer:
        "Комбо оформляется на email, на котором ещё нет ни одного из двух мастер-классов. Если один уже куплен, возьмите второй отдельно — выберите его в форме оплаты на этой странице.",
    },
    REGISTRATION_FAQ,
    ...CARE_FAQ,
  ];
}
