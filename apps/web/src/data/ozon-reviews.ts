import type { Review } from "@/lib/ozon-types";

// Снимок отзывов из кабинета продавца Ozon (seller.ozon.ru → Товары → Отзывы).
// Seller API отдаёт отзывы только на подписке Premium Plus, поэтому пока
// храним их здесь. Берём только отзывы, которые Ozon показывает покупателям;
// имя автора — как на витрине: имя + первая буква фамилии.
// Снято: 2026-09-23.

type SnapshotReview = Omit<Review, "source" | "productSku"> & {
  productOfferId: string;
};

const SNAPSHOT: SnapshotReview[] = [
  {
    id: "01a06851-b1b3-7737-960c-e84dedd3a593",
    productOfferId: "BELT_003",
    productTitle: "Пояс",
    rating: 5,
    text: "Красивая вещь, но хотелось бы потолще сам пояс, а то провисает от тяжести плетения",
    date: "2026-09-03T17:30:58Z",
    reviewerName: "Галина П.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-15/5672bdde-2a5a-4c61-851d-e4b63632a6a3.jpeg",
    ],
  },
  {
    id: "01a01a79-fb99-7337-9e9d-6721dd9a465e",
    productOfferId: "BELT_002",
    productTitle: "Пояс",
    rating: 5,
    text: "Качественный пояс, упаковка очень красивая\n\nСоветую подрезать и завязывать узлы на концах до первой носки, иначе нити могут сильно растрепаться",
    date: "2026-08-19T14:43:21Z",
    reviewerName: "Покупатель Ozon",
    photos: [],
  },
  {
    id: "019febac-faea-70d5-ae12-4b2b681c0b4e",
    productOfferId: "PLT-MACR-008",
    productTitle: "Накидка пляжная",
    rating: 5,
    text: "Платье 👗 потрясающее, очень красивое и сидит великолепно. Упаковка тоже на высшем уровне. 😎🙂🤗. Благодарю всех причастных и того кто связал, сплёл/сшил и упаковал. Буду следить за новыми моделями 😉.",
    date: "2026-08-10T12:36:52Z",
    reviewerName: "Гульнара Б.",
    photos: [],
  },
  {
    id: "019fcd36-d338-7cc7-b424-69bfc999eb77",
    productOfferId: "ELKA_002",
    productTitle: "Елка панно макраме",
    rating: 5,
    text: "Замечательная елочка 🌲 такую и хотела. Мне наскучила искусственная елка. Она пылится и занимает место. А ставлю ее раз в год на 10-12 дней. Эту можно на стене оставить хоть на 2 месяца. Планирую украшать деревянными игрушками и возможно гирляндой.",
    date: "2026-08-04T15:08:57Z",
    reviewerName: "Алёна К.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-12/66f86930-dd6a-4a84-9f32-a4d8888724a9.jpeg",
    ],
  },
  {
    id: "019f98f4-cc43-7bdb-ad09-4784411c5889",
    productOfferId: "Heart_RED",
    productTitle: "Сумка «Сердце»",
    rating: 5,
    text: "Боже, что за роскошество?😍❤️ спасибо🙏🏻",
    date: "2026-07-25T11:08:06Z",
    reviewerName: "Алина Ш.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-14/02717760-719c-4738-af56-94ad557c68c3.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-15/752f71cd-1714-49cc-987c-c02ac5af32b0.jpeg",
    ],
  },
  {
    id: "019f282d-414d-7a90-8b37-aa0e4ca855c5",
    productOfferId: "Heart_marsala",
    productTitle: "Сумка «Сердце»",
    rating: 5,
    text: "Крутая😍❤️ Спасибо за мою прелесть💕",
    date: "2026-07-03T13:31:48Z",
    reviewerName: "Алина Ш.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-11/f0298479-25ce-4626-8ca4-a0b44ab1ab66.jpeg",
    ],
  },
  {
    id: "019f0450-e0b9-7a4b-8287-dcde4eba66f3",
    productOfferId: "PLATE-001",
    productTitle: "Сервировочные салфетки из хлопкового шнура",
    rating: 5,
    text: "Шикарные стильные салфетки! Качество превосходное! И очень хороший размер. Спасибо большое!💞",
    date: "2026-06-26T14:24:00Z",
    reviewerName: "Елена Т.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-14/09f5d7d7-be27-4f93-b9d0-a32e4ea66699.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-13/b24c61a6-6b20-4d66-bc0c-b0e43ba25b7c.jpeg",
    ],
  },
  {
    id: "019effb5-e43c-7766-9a9a-66efd54621cd",
    productOfferId: "AVSK-MKRM-03",
    productTitle: "Авоська макраме",
    rating: 5,
    text: "Авоська классная, как на картинке.",
    date: "2026-06-25T16:56:15Z",
    reviewerName: "Марина",
    photos: [],
  },
  {
    id: "019ec6ab-b801-7ac4-bd69-becb693182a6",
    productOfferId: "BELT_004",
    productTitle: "Пояс",
    rating: 5,
    text: "Пояс подошел под многие образы, отличного качества. При росте 165, если носить на талии, доходит до лодыжек. При меньшем росте можно подрезать. Яркий, красивый. Упакован очень хорошо и с любовью))",
    date: "2026-06-14T15:07:27Z",
    reviewerName: "Виктория С.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-12/c066edeb-0871-4e41-8599-361fb5dd08da.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-14/085810de-224c-41de-9997-5aea45b6499a.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-11/e3b7007b-9baa-442e-be92-3bd53ef92ae5.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-14/81db8061-7c01-4089-9ec8-48334975a44b.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-15/a5fa9248-39a6-4775-910e-a4d9515f2ecf.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-15/0f49c014-8d7c-4b6a-a985-e464bf126556.jpeg",
    ],
  },
  {
    id: "019e8cd3-03c4-70cb-9472-beb303f924bd",
    productOfferId: "BELT_003",
    productTitle: "Пояс",
    rating: 4,
    text: "Очень куцо получается,брала как припинда .не хватает ещё одного рядя не с 20ти а с 25 ,для пояса нужно укрепление,нитка тяжёлая будет отвисать .сделано аккуратно, цвет красивый , нитки приятные.\nВ носке не доработка,не рекомендую!!!посмотрите какие они должны быть!",
    date: "2026-06-03T09:31:43Z",
    reviewerName: "Татьяна М.",
    photos: [],
  },
  {
    id: "019e8c4f-2333-77b5-abc2-c9e1c4ae09cf",
    productOfferId: "BELT_002",
    productTitle: "Пояс",
    rating: 5,
    text: "Пояс просто шикарный! Очень качественно сплетён и он - трансформер, его можно носить как просто на талии, так и на груди - спереди или сзади! В общем, прекрасный аксессуар, который может внести разнообразие во множество образов.",
    date: "2026-06-03T07:07:41Z",
    reviewerName: "Мария С.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-14/1f38fe73-c5ec-4470-ba44-0c1b0e4584d2.jpeg",
    ],
  },
  {
    id: "019e7dba-6741-724b-b28a-ffae7f6496dd",
    productOfferId: "BELT_005",
    productTitle: "Пояс",
    rating: 5,
    text: "Особенно понравился с топом и джинсами. спасибо большое.\nотдельно стоит отметить внимание к упаковке, очень приятно было получить и раскрыть.",
    date: "2026-05-31T11:11:48Z",
    reviewerName: "Покупатель Ozon",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-11/ce87f405-e77d-455a-a566-19b61e6f389a.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-11/6515bf91-9603-41e9-92a7-195f6ea797e1.jpeg",
    ],
  },
  {
    id: "019e3ece-b0e6-7449-8bab-56d0522fe875",
    productOfferId: "Bag_Flower",
    productTitle: "Сумка из хлопкового шнура Flower",
    rating: 5,
    text: "Отличная сумочка, такой оригинальный дизайн🥰, сшита очень аккуратно, а цена просто подарок🔥",
    date: "2026-05-19T05:56:36Z",
    reviewerName: "Оля",
    photos: [],
  },
  {
    id: "019e35c3-a8b8-7dd3-8994-ad619cea1081",
    productOfferId: "BELT_002",
    productTitle: "Пояс",
    rating: 5,
    text: "Пояс огонь, сделан очень круто\nк сожалению, фото только в маленьком зеркале, но видно более менее\nединственное шнур держащий потолще бы, можно конечно в два оборота, но на моих габаритах два оборота еле еле сходятся\nна таком тонком шнуре провисает основная часть немного, если в два оборота сделать, не провисает",
    date: "2026-05-17T11:47:58Z",
    reviewerName: "Покупатель Ozon",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-14/38dbe718-4d5e-40c8-926a-43d3e563f0c8.jpeg",
    ],
  },
  {
    id: "019ce0e0-e9bc-7921-831e-e9f7c09a78f9",
    productOfferId: "AVSK-MKRM-01",
    productTitle: "Авоська макраме",
    rating: 5,
    text: "Очень красивая. На вб в два раза дороже такая модель. Спасибо огромное !",
    date: "2026-04-23T10:40:15Z",
    reviewerName: "Евгения К.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-14/a737cd18-1daa-4298-b521-676a76aed2d5.jpeg",
      "https://ir.ozone.ru/s3/rp-photo-14/00cbee15-f3da-41aa-a50f-26130ec65f7c.jpeg",
    ],
  },
  {
    id: "019dadde-ac9e-72b1-8bcd-e004b7e954ba",
    productOfferId: "Bag_Flower",
    productTitle: "Сумка из хлопкового шнура Flower",
    rating: 5,
    text: "Сумочка очень красивая и оригинальная, красивый изумрудный цвет, в комплекте два ремешка, хлопковый и цепочка, удобная и вместительная. Минус для меня только один, на фото фурнитура серебряная, пришла с золотой, выкупила, но очень часто цвет фурнитуры принципиально важен",
    date: "2026-04-21T02:30:12Z",
    reviewerName: "Катя Л.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-12/e32bec77-6b4e-40b5-916c-5f47afbfbabe.jpeg",
    ],
  },
  {
    id: "019d35e7-d491-79de-b38c-25a7de98dd53",
    productOfferId: "PLT-MACR-001",
    productTitle: "Накидка пляжная",
    rating: 5,
    text: "Это что за произведение искусства, целую ваши руки , смотря на такие вещи точно понимаешь, что все мы частички Бога! обожаю стиль бохо и все что с ним связано, если отзыв можно редактировать, обещаю добавить фоточки с фотосессии, такая красота должна блистать ,ну и как минимум висеть в моей коллекции и радовать глаза  Низкий вам поклон",
    date: "2026-03-28T19:25:48Z",
    reviewerName: "Ольга Д.",
    photos: [
      "https://ir.ozone.ru/s3/rp-photo-13/c3afe15e-60ed-4c79-a972-425028f5d6a4.jpeg",
    ],
  },
  {
    id: "019d3028-bbff-77cf-b4de-0f69493c8fbc",
    productOfferId: "BAG-White",
    productTitle: "Сумка из хлопкового шнура",
    rating: 4,
    text: "Сумка красивая, смутило крепление ручек к сумке, хлипенькие",
    date: "2026-03-27T16:48:01Z",
    reviewerName: "Ольга Я.",
    photos: [],
  },
  {
    id: "019ce647-6758-76bd-8994-89379eae35d5",
    productOfferId: "PLT-MACR-002",
    productTitle: "Накидка пляжная",
    rating: 5,
    text: "Если есть в мире идеальные вещи - то это платье в их числе🥰😍невероятное, приятное к телу, сделано очень аккуратно, хлопковый шнур.....  волнительно было заказывать без единого отзыва, но этот риск того стоил))))",
    date: "2026-03-13T08:19:50Z",
    reviewerName: "Алёна В.",
    photos: [],
  },
];

/** Buyer-visible Ozon reviews captured from the seller dashboard. */
export const OZON_REVIEWS: Review[] = SNAPSHOT.map((r) => ({
  ...r,
  source: "ozon",
}));

/**
 * Все оценки с доставленных заказов по артикулу (offer_id), включая
 * оценки без текста — именно из них Ozon считает рейтинг товара.
 */
export const OZON_RATINGS: Record<string, { sum: number; count: number }> = {
  BELT_002: { sum: 20, count: 4 },
  BELT_003: { sum: 9, count: 2 },
  BELT_004: { sum: 10, count: 2 },
  BELT_005: { sum: 5, count: 1 },
  "AVSK-MKRM-01": { sum: 5, count: 1 },
  "AVSK-MKRM-02": { sum: 5, count: 1 },
  "AVSK-MKRM-03": { sum: 5, count: 1 },
  "PLT-MACR-001": { sum: 5, count: 1 },
  "PLT-MACR-002": { sum: 5, count: 1 },
  "PLT-MACR-005": { sum: 10, count: 2 },
  "PLT-MACR-006": { sum: 5, count: 1 },
  "PLT-MACR-008": { sum: 5, count: 1 },
  "PLT-MACR-111": { sum: 5, count: 1 },
  "PLPHR-MACR-110": { sum: 5, count: 1 },
  UBKA_001: { sum: 5, count: 1 },
  ELKA_002: { sum: 5, count: 1 },
  Heart_RED: { sum: 10, count: 2 },
  Heart_marsala: { sum: 5, count: 1 },
  "KOMPLEKT-002": { sum: 5, count: 1 },
  "PLATE-001": { sum: 5, count: 1 },
  Bag_Flower: { sum: 10, count: 2 },
  "BAG-White": { sum: 4, count: 1 },
};
