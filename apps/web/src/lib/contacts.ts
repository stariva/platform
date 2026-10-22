import { SELLER } from "@/lib/legal";

/** Каналы связи с мастером. Единственный источник ссылок для всего сайта. */
export const CONTACTS = {
  master: "Ольга Карпычева",
  telegramHandle: "@Olga_Stariva",
  telegramUrl: "https://t.me/Olga_Stariva",
  whatsappUrl: "https://wa.me/79778722546",
  maxUrl:
    "https://max.ru/u/f9LHodD0cOKBrgW8OBs1SDxy3mN7vPE34uus8lQhO22DEoOybjJE57AQMIg",
  phone: SELLER.phone,
  phoneHref: SELLER.phoneHref,
  hours: "пн–сб, 10:00–20:00 МСК",
  avatar: "https://cdn.stariva.ru/site/images/about/founder-2026.jpg",
} as const;

export type ContactChannel = "telegram" | "whatsapp" | "max" | "phone";

/** Та же ссылка с точностью до регистра, слэша в конце и параметров (?text= у WhatsApp). */
function sameLink(href: string, contact: string) {
  try {
    const url = new URL(href);
    const target = new URL(contact);
    return (
      url.host.toLowerCase() === target.host.toLowerCase() &&
      url.pathname.replace(/\/$/, "").toLowerCase() ===
        target.pathname.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Канал связи с мастером по адресу ссылки; null — ссылка не к мастеру
 * (например, на бота напоминаний t.me/…Bot).
 */
export function contactChannelOf(href: string): ContactChannel | null {
  if (/^tel:/i.test(href)) return "phone";
  if (sameLink(href, CONTACTS.telegramUrl)) return "telegram";
  if (sameLink(href, CONTACTS.whatsappUrl)) return "whatsapp";
  if (sameLink(href, CONTACTS.maxUrl)) return "max";
  return null;
}

/** WhatsApp — единственный из каналов, который принимает готовый текст. */
export function whatsappUrl(message?: string) {
  return message
    ? `${CONTACTS.whatsappUrl}?text=${encodeURIComponent(message)}`
    : CONTACTS.whatsappUrl;
}
