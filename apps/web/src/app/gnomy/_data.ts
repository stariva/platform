import type { FAQItem } from "@/components/stariva/json-ld";
import type { Product } from "@/lib/catalog/types";
import { IN_STOCK_SHIP_DAYS, isPurchasable } from "@/lib/in-stock";
import { formatPrice } from "@/lib/workshops-data";

/** Лендинг пары гномов — на него ведёт реклама. */
export const GNOMES_PATH = "/gnomy";

/** Якоря лендинга — свои, чтобы цели не смешивались с другими страницами. */
export const GNOMES_SECTION_ID = "gnomy";
export const GNOMES_CARDS_ID = "gnomy-cards";

/**
 * Slug товара — название с Ozon и последние четыре цифры Ozon ID. Название
 * меняется, хвост остаётся, поэтому гномов узнаём по хвосту.
 */
const PUMPKIN_TAIL = "-9563";
const FLY_AGARIC_TAIL = "-0554";

export interface Gnomes {
  pumpkin?: Product;
  flyAgaric?: Product;
}

export function pickGnomes(products: Product[]): Gnomes {
  return {
    pumpkin: products.find((p) => p.slug.endsWith(PUMPKIN_TAIL)),
    flyAgaric: products.find((p) => p.slug.endsWith(FLY_AGARIC_TAIL)),
  };
}

/** Найденные гномы: Тыква первой, как в блоге. */
export function gnomeList({ pumpkin, flyAgaric }: Gnomes): Product[] {
  return [pumpkin, flyAgaric].filter((p): p is Product => Boolean(p));
}

/**
 * Что можно купить прямо сейчас и сколько это стоит. Цены берутся из каталога:
 * скидка на странице — это `oldPrice` у товаров в админке, а не отдельная
 * логика корзины.
 */
export function pairOffer(gnomes: Product[]) {
  const available = gnomes.filter(isPurchasable);
  const price = available.reduce((sum, p) => sum + p.price, 0);
  const regular = available.reduce(
    (sum, p) => sum + Math.max(p.oldPrice ?? p.price, p.price),
    0,
  );
  return {
    available,
    price,
    regularPrice: regular,
    saving: regular - price,
    /** Есть оба гнома — продаём парой, иначе страница честно говорит об одном. */
    isPair: available.length === 2,
  };
}

/** Подпись кнопки «в корзину» для всего набора. */
export function pairButtonLabel(offer: ReturnType<typeof pairOffer>): string {
  if (offer.isPair) return `Оба гнома в корзину — ${formatPrice(offer.price)}`;
  const [only] = offer.available;
  return only
    ? `${only.name} в корзину — ${formatPrice(only.price)}`
    : "Гномов сейчас нет в наличии";
}

/**
 * Заголовок и текст первого экрана по наличию: обещаем пару, только пока есть
 * оба гнома; с одним — говорим об одном, без наличия — не обещаем отправку.
 */
export function heroCopy(offer: ReturnType<typeof pairOffer>) {
  const [only] = offer.available;
  if (offer.isPair) {
    return {
      title: "Два вязаных гнома",
      lead: "Тыква и Мухомор: интерьерный декор ручной вязки высотой 40–45 см. Поставьте на каминную полку, подоконник или комод — а к декабрю смените соседей, и гномы останутся новогодним акцентом.",
      inStock: true,
    };
  }
  if (only) {
    return {
      title: "Вязаный гном",
      lead: `${only.name}: интерьерный декор ручной вязки. Второго гнома сейчас нет в наличии — напишите Ольге, она подскажет, можно ли связать такого же.`,
      inStock: true,
    };
  }
  return {
    title: "Вязаные гномы",
    lead: "Тыква и Мухомор — интерьерный декор ручной вязки. Сейчас обоих нет в наличии: напишите Ольге, она подскажет, можно ли связать такого же и к какому сроку.",
    inStock: false,
  };
}

/** Вопросы покупателей — те же, что приходят Ольге про готовых гномов. */
export function gnomesFaq(gnomes: Product[]): FAQItem[] {
  const heights = [...new Set(gnomes.map((p) => p.dimensions).filter(Boolean))];
  return [
    {
      question: "Какого размера гномы?",
      answer: `${heights.length > 0 ? `${heights.join(" и ")}.` : "Около 40–45 см."} Это заметный предмет декора, а не мелочь, которая теряется на полке: ему нужна своя «сцена» — каминная полка, подоконник или консоль в прихожей.`,
    },
    {
      question: "Из чего сделаны гномы?",
      answer:
        "Связаны вручную из мягкой плюшевой пряжи с бархатистой фактурой, набиты упругим холлофайбером — он держит форму и не сбивается. Каждый гном единственный: оттенки и пропорции могут чуть отличаться от фото.",
    },
    {
      question: "Когда отправите и как доставите?",
      answer: `Гномы, которые есть в наличии, уже связаны и готовы к отправке — отправим за ${IN_STOCK_SHIP_DAYS} после оплаты. Доставка в пункты выдачи Ozon по всей России: пункт выбирается на карте при оформлении, стоимость и срок видны ещё до оплаты. Упаковка в крафт и лён — в подарок.`,
    },
    {
      question: "Как оплатить?",
      answer:
        "Онлайн на защищённой странице ЮKassa сразу после оформления заказа. Наложенным платежом оплатить нельзя — заказ отправляется после оплаты.",
    },
    {
      question: "Можно купить только одного гнома?",
      answer:
        "Да. У каждого гнома на странице своя кнопка «В корзину». Пара удобна тем, что один заказ и одна доставка, а гномы на полке друг друга поддерживают.",
    },
    {
      question: "Как ухаживать за гномом?",
      answer:
        "Пыль снимайте сухой мягкой щёткой или роликом для одежды; при необходимости пятно можно аккуратно убрать влажной салфеткой или мыльной пеной, не погружая в воду. Берегите от открытого огня, радиаторов и прямого солнца. Гном — интерьерное украшение, он не рассчитан на детские игры.",
    },
    {
      question: "Можно заказать такого же гнома или другого цвета?",
      answer:
        "Напишите Ольге — она подскажет, можно ли связать такого же и к какому сроку. Если успеть к празднику, лучше написать заранее.",
    },
  ];
}
