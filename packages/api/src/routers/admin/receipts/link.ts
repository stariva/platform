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

const CHECK_ATTEMPTS = 3;
const CHECK_TIMEOUT_MS = 5_000;
const CHECK_DELAY_MS = 300;

export type ReceiptCheck =
  | { status: "found" }
  | { status: "not_found" }
  /** `reason` — что именно пошло не так, по-русски, чтобы показать в админке. */
  | { status: "unavailable"; reason: string };

/** Код сетевой ошибки (ENOTFOUND, ECONNRESET…) — fetch прячет его в `cause`. */
function networkCode(error: unknown): string | null {
  const cause = error instanceof Error ? error.cause : null;
  const code =
    cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  return typeof code === "string" ? code : null;
}

export interface CheckOptions {
  fetchImpl?: typeof fetch;
  /** Сколько раз спросить ФНС, прежде чем сдаться. */
  attempts?: number;
  /** Сколько ждать один ответ. */
  timeoutMs?: number;
  /** Пауза между попытками. */
  delayMs?: number;
}

/**
 * Есть ли такой чек в ФНС: существующий отдаёт картинку, неизвестный — 422.
 * Сумму так не сверить — JSON чека закрыт авторизацией.
 *
 * Сервис ФНС изредка зависает на одном запросе и тут же отвечает на
 * следующий, поэтому лучше несколько коротких попыток, чем одна долгая.
 * Повторяем только сбои — «найден» и «не найден» окончательны.
 */
export async function checkReceipt(
  url: string,
  {
    fetchImpl = fetch,
    attempts = CHECK_ATTEMPTS,
    timeoutMs = CHECK_TIMEOUT_MS,
    delayMs = CHECK_DELAY_MS,
  }: CheckOptions = {},
): Promise<ReceiptCheck> {
  let result = await checkOnce(url, fetchImpl, timeoutMs);
  for (let attempt = 2; attempt <= attempts; attempt++) {
    if (result.status !== "unavailable") return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await checkOnce(url, fetchImpl, timeoutMs);
  }
  return result.status === "unavailable" && attempts > 1
    ? { ...result, reason: `${result.reason}, попыток: ${attempts}` }
    : result;
}

async function checkOnce(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ReceiptCheck> {
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.body?.cancel();
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/")) return { status: "found" };
    if (res.status === 404 || res.status === 422) {
      return { status: "not_found" };
    }
    return {
      status: "unavailable",
      reason: res.ok
        ? `вместо картинки чека пришёл другой ответ (${type || "без типа"})`
        : `сервис ответил ошибкой ${res.status}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        status: "unavailable",
        reason: `сервис не ответил за ${timeoutMs / 1000} с`,
      };
    }
    const code = networkCode(error);
    return {
      status: "unavailable",
      reason: code ? `нет соединения (${code})` : "нет соединения",
    };
  }
}
