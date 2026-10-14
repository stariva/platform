import type { AdChannel } from "@stariva/db/schema";

export const CHANNEL_LABELS: Record<AdChannel, string> = {
  yandex_direct: "Яндекс Директ",
  vk_ads: "VK Реклама",
  telegram: "Telegram",
  avito: "Авито",
  bloggers: "Блогеры",
  social: "Соцсети",
  other: "Другое",
};

export const CHANNELS = Object.keys(CHANNEL_LABELS) as AdChannel[];

/** Источник клиента в том виде, в каком его отдаёт `admin.crm.*`. */
export interface SourceView {
  key: string;
  kind: "campaign" | "utm" | "none";
  manual: boolean;
  campaignId: string | null;
  name: string | null;
  channel: AdChannel | null;
  archived: boolean;
  utmSource: string | null;
  utmCampaign: string | null;
}

export const utmLabel = (source: string | null, campaign: string | null) =>
  [source, campaign].filter(Boolean).join(" / ");

/** Название источника: кампания, UTM-метки или «не с рекламы». */
export function sourceLabel(source: SourceView): string {
  if (source.kind === "campaign") return source.name ?? "Кампания удалена";
  if (source.kind === "utm")
    return utmLabel(source.utmSource, source.utmCampaign);
  return "Не с рекламы";
}

export const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export const day = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "Europe/Moscow",
});

export const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

/** «2026-10-13» → 13 окт. 2026 г.; дата расхода — день, без часового пояса. */
export const formatDay = (value: string) =>
  day.format(new Date(`${value}T12:00:00+03:00`));

/** Сегодня по Москве, для полей даты. */
export const todayInMoscow = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Сколько стоил один покупатель; без покупателей — не посчитать. */
export const costPer = (spend: number, count: number) =>
  spend > 0 && count > 0 ? rubles.format(spend / count) : "—";

/** Сколько рублей выручки принёс рубль рекламы. */
export function payback(revenue: number, spend: number): string {
  if (spend <= 0) return "—";
  return `×${(revenue / spend).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}`;
}

/** Окупилась ли реклама: зелёный — да, красный — нет, без расхода — никак. */
export function paybackTone(revenue: number, spend: number) {
  if (spend <= 0) return "";
  return revenue >= spend
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-destructive";
}

/** Где посмотреть сделку: заказ, запись на мастер-класс или нигде. */
export function dealHref(deal: { kind: string; id: string }) {
  if (deal.kind === "product") return `/orders/${deal.id}`;
  if (deal.kind === "workshop") {
    return `/workshop-orders?status=all&q=${encodeURIComponent(deal.id)}`;
  }
  return null;
}

export const DEAL_KIND_LABELS: Record<string, string> = {
  product: "Заказ с сайта",
  workshop: "Мастер-класс",
  manual: "Вне сайта",
};

/**
 * Телефон и почта из поля «контакт» заявки: туда пишут что угодно —
 * номер, почту, ник в Telegram. Что не распознано, остаётся пустым.
 */
export function parseContact(raw: string | null | undefined) {
  const value = raw ?? "";
  const email = value.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/)?.[0] ?? "";
  const phone =
    value
      .match(/\+?\d[\d\s()-]{8,}\d/g)
      ?.find((match) => match.replace(/\D/g, "").length >= 10) ?? "";
  return { phone: phone.trim(), email };
}
