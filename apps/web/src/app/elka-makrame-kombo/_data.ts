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
  const bigPreorder = isPreorder(big, now) && big.releaseAt;
  return {
    price,
    separately,
    saving: Math.max(separately - price, 0),
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
        "Комбо оформляется на email, на котором ещё нет ни одного из двух мастер-классов. Если один уже куплен, второй выгоднее взять отдельно — на его странице.",
    },
    REGISTRATION_FAQ,
    ...CARE_FAQ,
  ];
}
