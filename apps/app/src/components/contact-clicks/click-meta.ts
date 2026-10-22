import type { ContactClickChannel } from "@stariva/db/schema";

export const CHANNEL_LABELS: Record<ContactClickChannel, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  max: "MAX",
  phone: "Звонок",
};

export const CONTACT_CHANNELS = Object.keys(
  CHANNEL_LABELS,
) as ContactClickChannel[];

/** Блоки сайта (data-location) по-русски; остальные показываем как есть. */
const SOURCE_LABELS: Record<string, string> = {
  footer: "подвал",
  chat: "чат с Никой",
  mobile_bar: "панель внизу на телефоне",
  product: "карточка товара",
  cart: "корзина",
  reviews: "отзывы",
  home_master: "главная, блок о мастере",
  custom_order: "индивидуальный заказ",
  elka_workshop: "мастер-класс «Ёлка»",
  elka_faq: "мастер-класс «Ёлка», вопросы",
  elka_big: "большая ёлка",
  elka_big_faq: "большая ёлка, вопросы",
  elka_trees: "ёлки на стену",
  elka_trees_faq: "ёлки на стену, вопросы",
  elka_b2b: "ёлки на стену для бизнеса",
  b2b_hero: "для кафе, первый экран",
  b2b_contacts: "для кафе, контакты",
  designers_brief: "дизайнерам, бриф",
  designers_contacts: "дизайнерам, контакты",
  account_order: "заказ в кабинете",
};

export const sourceLabel = (source: string | null) =>
  source ? (SOURCE_LABELS[source] ?? source) : null;
