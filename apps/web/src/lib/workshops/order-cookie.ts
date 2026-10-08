import { timingSafeEqual } from "node:crypto";

/**
 * Cookie браузера, оформившего заказ мастер-класса: «<orderId>.<telegramToken>».
 * Открывает только страницу «Вы записаны» этого заказа. Вход в кабинет она
 * не даёт: email мог ввести не его владелец, поэтому кабинет — через письмо.
 */
export const WORKSHOP_ORDER_COOKIE = "stariva_workshop_order";

export function workshopOrderCookieValue(order: {
  id: string;
  telegramToken: string | null;
}): string {
  return `${order.id}.${order.telegramToken ?? ""}`;
}

/** Cookie подходит к заказу: тот же id и та же секретная метка. */
export function cookieMatchesOrder(
  cookie: string | undefined,
  order: { id: string; telegramToken: string | null },
): boolean {
  if (!cookie || !order.telegramToken) return false;
  const expected = Buffer.from(workshopOrderCookieValue(order));
  const actual = Buffer.from(cookie);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
