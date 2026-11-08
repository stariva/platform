/**
 * Чат поддержки для тех, кто купил мастер-класс по ёлке. Приглашение закрытое,
 * поэтому модуль подключают только серверные страницы кабинета и «Вы записаны»:
 * в клиентский код ссылка не попадает.
 */
const TREE_SUPPORT_CHAT_URL = "https://t.me/+nzXZQ0mgbok1ZjZi";

/** Мастер-классы по ёлке: у каждого купившего есть доступ в чат. */
const TREE_WORKSHOP_SLUGS = new Set(["elka-makrame", "elka-makrame-bolshaya"]);

/** Ссылка на чат поддержки курса или null, если у курса его нет. */
export function supportChatUrl(workshopSlug: string): string | null {
  return TREE_WORKSHOP_SLUGS.has(workshopSlug) ? TREE_SUPPORT_CHAT_URL : null;
}
