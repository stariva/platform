import type { FAQItem } from "@/components/stariva/json-ld";
import type { Product } from "@/lib/catalog/types";
import { GNOME_PAIR_PRICE_KOPECKS, GNOME_TAILS } from "@/lib/commerce/bundles";
import { IN_STOCK_SHIP_DAYS, isPurchasable } from "@/lib/in-stock";
import { formatPrice } from "@/lib/workshops-data";

/** Лендинг пары гномов — на него ведёт реклама. */
export const GNOMES_PATH = "/gnomy";

/** Якоря лендинга — свои, чтобы цели не смешивались с другими страницами. */
export const GNOMES_SECTION_ID = "gnomy";
export const GNOMES_CARDS_ID = "gnomy-cards";

/** Хвосты slug гномов общие с ценой комплекта в корзине (lib/commerce/bundles). */
const [PUMPKIN_TAIL, FLY_AGARIC_TAIL] = GNOME_TAILS;

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
 * Что можно купить прямо сейчас и сколько это стоит. По отдельности гномы
 * стоят по цене каталога; вместе — цена комплекта (её же считают корзина и
 * сервер, `applyBundlePricing`), если она ниже суммы.
 */
export function pairOffer(gnomes: Product[]) {
  const available = gnomes.filter(isPurchasable);
  const regular = available.reduce((sum, p) => sum + p.price, 0);
  const isPair = available.length === 2;
  const price = isPair
    ? Math.min(regular, GNOME_PAIR_PRICE_KOPECKS / 100)
    : regular;
  return {
    available,
    price,
    regularPrice: regular,
    saving: regular - price,
    /** Есть оба гнома — продаём парой, иначе страница честно говорит об одном. */
    isPair,
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
      lead: "Тыква и Мухомор — добрые хранители домашнего уюта на всю зиму. Связаны вручную из мягкой плюшевой пряжи, ростом 40–45 см. Тёплая охра Тыквы — к достатку и полной чаше, красный колпак Мухомора — к празднику и сказке. Поставьте пару под ёлку, на подоконник или комод и встречайте Новый год с настроением.",
      badge: `В единственном экземпляре · отправим за ${IN_STOCK_SHIP_DAYS}`,
      scarcity:
        "В наличии одна пара. Такую же к Новому году Ольга может не успеть связать.",
      inStock: true,
    };
  }
  if (only) {
    return {
      title: "Вязаный гном",
      lead: `${only.name}: интерьерный декор ручной вязки. Второго гнома сейчас нет в наличии — напишите Ольге, она подскажет, можно ли связать такого же.`,
      badge: `В единственном экземпляре · отправим за ${IN_STOCK_SHIP_DAYS}`,
      scarcity:
        "Остался один гном. Такого же к Новому году Ольга может не успеть связать.",
      inStock: true,
    };
  }
  return {
    title: "Вязаные гномы",
    lead: "Тыква и Мухомор — интерьерный декор ручной вязки. Сейчас обоих нет в наличии: напишите Ольге, она подскажет, можно ли связать такого же и к какому сроку.",
    badge: "Каждый гном — в единственном экземпляре",
    scarcity: null,
    inStock: false,
  };
}

/** Текст над общими отзывами: у единственного экземпляра своих отзывов нет. */
export function reviewsNote(offer: ReturnType<typeof pairOffer>): string {
  if (offer.isPair)
    return "Гномы связаны в единственном экземпляре и ждут свой дом. А вот что покупатели пишут о других работах Ольги.";
  if (offer.available.length === 1)
    return "Гном связан в единственном экземпляре и ждёт свой дом. А вот что покупатели пишут о других работах Ольги.";
  return "Каждый гном связан в единственном экземпляре. Вот что покупатели пишут о других работах Ольги.";
}

/** «Высота около 40 см» → «около 40 см»: рост встраивается в середину фразы. */
function heightOf(product: Product): string | undefined {
  return product.dimensions?.replace(/^высота\s+/i, "").trim() || undefined;
}

function shortName(product: Product): string {
  if (product.slug.endsWith(PUMPKIN_TAIL)) return "Тыква";
  if (product.slug.endsWith(FLY_AGARIC_TAIL)) return "Мухомор";
  return product.name;
}

/** Рост гномов одной живой фразой — без склейки строк из базы. */
function sizeAnswer(gnomes: Product[]): string {
  const sized = gnomes.flatMap((gnome) => {
    const height = heightOf(gnome);
    return height ? [{ name: shortName(gnome), height }] : [];
  });
  const [first, second] = sized;
  if (!first) return "Около 40–45 см.";
  if (!second) return `${first.name} — ${first.height}.`;
  if (first.height === second.height) return `Оба гнома — ${first.height}.`;
  return `${first.name} — ${first.height}, ${second.name} — ${second.height}. Рядом эта разница в росте смотрится особенно живо.`;
}

/** Вопросы покупателей — те же, что приходят Ольге про готовых гномов. */
export function gnomesFaq(gnomes: Product[]): FAQItem[] {
  return [
    {
      question: "Какого размера гномы?",
      answer: `${sizeAnswer(gnomes)} Гном такого роста заметен в комнате и не теряется на полке — ему подойдёт место под ёлкой, на подоконнике или на консоли в прихожей.`,
    },
    {
      question: "Из чего сделаны гномы?",
      answer:
        "Ольга вяжет их вручную из мягкой плюшевой пряжи: фактура бархатистая, гнома приятно взять в руки. Внутри упругий холлофайбер — он держит форму и не сбивается. Каждый гном единственный: оттенки и пропорции могут чуть отличаться от фото.",
    },
    {
      question: "Когда отправите и как доставите?",
      answer: `Гномы, которые есть в наличии, уже связаны и готовы к отправке — отправим за ${IN_STOCK_SHIP_DAYS} после оплаты. Доставка в пункты выдачи Ozon по всей России: пункт выбирается на карте при оформлении, стоимость и срок видны ещё до оплаты. Упаковка в крафт и лён — в подарок.`,
    },
    {
      question: "Успею ли получить гномов к Новому году?",
      answer: `Отправим за ${IN_STOCK_SHIP_DAYS} после оплаты, дальше посылка идёт до выбранного пункта выдачи Ozon. Срок доставки виден при оформлении, ещё до оплаты, — сверьте его с нужной датой. Чем раньше закажете, тем спокойнее до праздников.`,
    },
    {
      question: "Как оплатить?",
      answer:
        "Онлайн на защищённой странице ЮKassa сразу после оформления заказа. Наложенным платежом оплатить нельзя — заказ отправляется после оплаты.",
    },
    {
      question: "Можно купить только одного гнома?",
      answer:
        "Да, каждый гном продаётся и отдельно — у него на странице своя кнопка «В корзину». Если взять обоих сразу, комплект выходит дешевле: цена комплекта применяется автоматически, когда оба гнома в корзине.",
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
