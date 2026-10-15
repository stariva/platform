/** ИНН Ольги — тот же, что в реквизитах продавца (apps/web/src/lib/legal.ts). */
export const SELLER_INN = "502480197143";

const RECEIPT_HOST = "lknpd.nalog.ru";
// /api/v1/receipt/<ИНН>/<номер>/print — так «Мой налог» делится чеком;
// /json и ссылку без хвоста тоже принимаем, ведут к тому же чеку
const RECEIPT_PATH =
  /^\/api\/v1\/receipt\/(\d{12})\/([0-9a-z]+)(?:\/(?:print|json))?\/?$/i;

export interface ReceiptLink {
  inn: string;
  number: string;
  /** Картинка чека — её показываем покупателю. */
  url: string;
}

/** Разбирает ссылку на чек из «Мой налог»; null — это не ссылка на чек. */
export function parseReceiptLink(raw: string): ReceiptLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.hostname !== RECEIPT_HOST) return null;
  const match = RECEIPT_PATH.exec(url.pathname);
  if (!match?.[1] || !match[2]) return null;
  const inn = match[1];
  const number = match[2].toLowerCase();
  return {
    inn,
    number,
    url: `https://${RECEIPT_HOST}/api/v1/receipt/${inn}/${number}/print`,
  };
}

export type ReceiptCheck = "found" | "not_found" | "unavailable";

/**
 * Есть ли такой чек в ФНС: существующий отдаёт картинку, неизвестный — 422.
 * Сумму так не сверить — JSON чека закрыт авторизацией.
 */
export async function checkReceipt(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReceiptCheck> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    await res.body?.cancel();
    if (res.ok && res.headers.get("content-type")?.startsWith("image/")) {
      return "found";
    }
    return res.status === 404 || res.status === 422
      ? "not_found"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
