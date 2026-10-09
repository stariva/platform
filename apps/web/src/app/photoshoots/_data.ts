const CDN = "https://cdn.stariva.ru/products";
const CLOTHES = "/catalog/clothes";

export interface Look {
  name: string;
  href: string;
  image: string;
}

export interface Scenario {
  id: string;
  label: string;
  title: string;
  places: string;
  description: string;
  tips: string[];
  image: string;
  imageAlt: string;
  looks: Look[];
}

const looks = {
  brick: {
    name: "Туника макраме кирпичная",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-2739`,
    image: `${CDN}/9bb99b03-56d3-4334-9b5d-b9e571447331/7415e25e72f05711.jpg`,
  },
  sand: {
    name: "Накидка макраме песочная",
    href: `${CLOTHES}/stariva-makrame-nakidka-iz-khlopkovogo-shnura-ruchnoy-raboty-9377`,
    image: `${CDN}/137b20f1-69da-4cf2-bf4c-8e8d7bd6fe2a/f4c9714bb1dd2400.jpg`,
  },
  milk: {
    name: "Туника макраме молочная",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-3983`,
    image: `${CDN}/e4a87059-1650-40b3-81ec-ce9c1b8d499f/e2a894fcadc85b94.jpg`,
  },
  beige: {
    name: "Туника макраме бежевая",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-9594`,
    image: `${CDN}/2133fb4d-9740-4868-b303-868abbf7066e/48edb8b12668df56.jpg`,
  },
  ivoryJacket: {
    name: "Жакет макраме айвори",
    href: `${CLOTHES}/zhaket-kofta-makrame-4447`,
    image: `${CDN}/b705ac0c-0464-421a-ba10-a68a5c965239/ac92064a0a919152.jpg`,
  },
  blue: {
    name: "Туника макраме голубая",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-3900`,
    image: `${CDN}/9ca69709-f127-4b85-836b-75cc177ebcf0/b716a6ff4c09016e.jpg`,
  },
  navy: {
    name: "Туника макраме тёмно-синяя",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-4312`,
    image: `${CDN}/ebfdcaf4-81d1-4e71-855d-25c3ca24d98b/076bf0cd42878564.jpg`,
  },
  set: {
    name: "Комплект макраме: топ и юбка",
    href: `${CLOTHES}/plyazhniy-komplekt-makrame-top-i-yubka-nakidka-na-kupalnik-8804`,
    image: `${CDN}/d550ecd6-fd95-4034-8328-0ede6e0ce320/5c9adb15c97093a4.jpg`,
  },
  gold: {
    name: "Платье макраме макси золотистое",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-poliefirnogo-shnura-8007`,
    image: `${CDN}/2408672d-fb1d-48ed-99fb-77b06f76f16b/8252bc431b3a91e3.jpg`,
  },
  lurex: {
    name: "Туника макраме с люрексом",
    href: `${CLOTHES}/stariva-makrame-tunika-plyazhnaya-khlopok-s-lyureksom-5565`,
    image: `${CDN}/42f481b2-d3cd-4b1a-a9d0-ceaf6d008568/1a86f01ea673c0b1.jpg`,
  },
  black: {
    name: "Туника макраме чёрная",
    href: `${CLOTHES}/stariva-makrame-tunika-iz-khlopkovogo-shnura-ruchnoy-raboty-7167`,
    image: `${CDN}/1437428e-ea34-4ac7-a272-7f6653b14574/f73970902f90f480.jpg`,
  },
} satisfies Record<string, Look>;

export const scenarios: Scenario[] = [
  {
    id: "morocco",
    label: "Марокко",
    title: "Сахара, риады и медины",
    places: "Мерзуга, Марракеш, Шефшауэн, Эс-Сувейра",
    description:
      "Терракотовые стены, ковры, латунные фонари и бесконечные дюны. Тёплые оттенки макраме сливаются с песком и глиной, а длинная бахрома красиво летит на ветру в пустыне.",
    tips: [
      "Кирпичный и песочный — в тон глиняным стенам риада",
      "Молочный — контраст на фоне синих улиц Шефшауэна",
      "Снимайте в дюнах за час до заката",
    ],
    image: "/images/photoshoots/morocco-riad.png",
    imageAlt: "Внутренний двор марокканского риада с арками и фонтаном",
    looks: [looks.brick, looks.sand, looks.milk],
  },
  {
    id: "wedding",
    label: "Свадьба и love story",
    title: "Бохо-свадьба у моря",
    places: "Выездная регистрация, welcome-party, утро невесты",
    description:
      "Светлое макраме — альтернатива классическому платью для выездной церемонии на берегу, второго образа на вечеринку или съёмки love story. Подружкам невесты — в одной гамме.",
    tips: [
      "Молочный и айвори — для невесты, бежевый — для подружек",
      "Жакет айвори поверх слип-платья — образ на вечер",
      "Длину бахромы и подкладку подгоним под ваши мерки",
    ],
    image: "/images/photoshoots/wedding-sea.png",
    imageAlt: "Свадебная арка с макраме и пампасной травой на пляже на закате",
    looks: [looks.milk, looks.ivoryJacket, looks.beige],
  },
  {
    id: "sea",
    label: "Море и острова",
    title: "Белые террасы и синее море",
    places: "Санторини, Крит, Бодрум, Мальдивы",
    description:
      "Белые домики, бугенвиллея и глубокий синий — идеальный фон для голубого, тёмно-синего и светлых оттенков. Макраме надевается поверх купальника и с пляжа переходит в ужин у воды.",
    tips: [
      "Голубой и тёмно-синий — в тон морю",
      "Комплект топ + юбка — для съёмки на яхте",
      "Лучший свет — утро до 10:00 и закат",
    ],
    image: "/images/photoshoots/sea-coast.png",
    imageAlt: "Белая терраса на скале над синим морем на греческом острове",
    looks: [looks.blue, looks.navy, looks.set],
  },
  {
    id: "desert",
    label: "Пустыня и road trip",
    title: "Каньоны, дюны и дороги",
    places: "Дубай, Иордания, Каппадокия, Алтай",
    description:
      "Ретро-кабриолет, пыльная дорога и закатное солнце. Золотистый шнур и люрекс бликуют в контровом свете, а чёрная туника даёт графичный силуэт на фоне песка.",
    tips: [
      "Золотистый и люрекс — для контрового света на закате",
      "Чёрный — графика на фоне светлого песка",
      "Возьмите сандалии на завязках — они продолжают линию бахромы",
    ],
    image: "/images/photoshoots/desert-road.png",
    imageAlt:
      "Винтажный кабриолет на пустынной дороге среди каньонов на закате",
    looks: [looks.gold, looks.lurex, looks.black],
  },
];

export const steps = [
  {
    title: "Расскажите о поездке",
    text: "Куда едете, когда съёмка, какой фотограф и настроение. Пришлите референсы — подберём образ под локацию.",
  },
  {
    title: "Выберите модель и цвет",
    text: "Берите готовую модель из каталога или закажите любую в другом цвете, длине и с подкладкой.",
  },
  {
    title: "Снимем мерки",
    text: "Ольга подскажет, как снять мерки дома. Платье плетётся точно по фигуре.",
  },
  {
    title: "Доставим к поездке",
    text: "Изготовление 7–14 дней. Срок обсудим заранее и отправим так, чтобы платье было у вас до вылета.",
  },
];

export const faq = [
  {
    q: "Можно ли заказать платье из фото в другом цвете?",
    a: "Да. Любую модель из каталога можно сплести в другом цвете шнура, изменить длину бахромы или добавить подкладку. Палитру покажем в мессенджере.",
  },
  {
    q: "Успеете ли вы к моей поездке?",
    a: "Обычно изготовление занимает 7–14 дней плюс доставка. Напишите дату вылета — Ольга скажет, реально ли успеть, ещё до оплаты. Модели «В наличии» отправляем быстрее.",
  },
  {
    q: "Подойдёт ли макраме для свадьбы?",
    a: "Да, для выездной церемонии, второго вечернего образа или love story. Для невесты рекомендуем молочный или айвори с подкладкой в тон кожи.",
  },
  {
    q: "Как платье перенесёт перелёт?",
    a: "Хлопковый шнур не мнётся так, как ткань. Сложите платье в мешочек, а на месте просто расправьте бахрому руками или отпарьте.",
  },
  {
    q: "Можно ли одеть в одном стиле подружек невесты или всю семью?",
    a: "Да, делаем групповые заказы: в одной гамме или в разных оттенках одной палитры. Обсудим количество и сроки индивидуально.",
  },
];
