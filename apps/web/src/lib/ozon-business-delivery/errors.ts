import { z } from "zod";

// Тело ошибки Ozon: `{ error: { code?, message }, details? }`. Если поля
// пришли другого типа, в сообщение попадёт начало тела, а не «[object Object]»
const errorBodySchema = z.object({
  error: z
    .object({
      code: z.string().nullish(),
      message: z.string().optional(),
    })
    .optional(),
});

/** Ответ Ozon Delivery API с ошибкой: код и описание из тела `{ error }`. */
export class OzonBusinessDeliveryError extends Error {
  /**
   * До этой ошибки клиент уже обменял ключи на свежий токен, и OAuth его
   * принял. Такой 401 — не сломанные ключи, а скорее сбой на стороне Ozon
   * (см. isOzonBusinessTokenRejected).
   */
  readonly tokenRefreshed: boolean;

  constructor(
    readonly path: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly detail: string,
    tokenRefreshed = false,
  ) {
    super(
      `ozon_business_delivery_request_failed_${status} ${path}${code ? ` ${code}` : ""}: ${detail}` +
        (tokenRefreshed ? " (after a fresh token)" : ""),
    );
    this.name = "OzonBusinessDeliveryError";
    this.tokenRefreshed = tokenRefreshed;
  }

  static fromResponse(
    path: string,
    status: number,
    body: string,
    tokenRefreshed = false,
  ): OzonBusinessDeliveryError {
    let code: string | undefined;
    let detail = body.slice(0, 500);
    try {
      const parsed = errorBodySchema.safeParse(JSON.parse(body));
      if (parsed.success) {
        code = parsed.data.error?.code ?? undefined;
        detail = parsed.data.error?.message ?? detail;
      }
    } catch {
      // Тело не JSON (например, страница прокси) — оставляем текст как есть
    }
    return new OzonBusinessDeliveryError(
      path,
      status,
      code,
      detail,
      tokenRefreshed,
    );
  }
}

/**
 * Ozon не принял ключи (неверные или отозванные) или не выдал токен с нужными
 * доступами. Само это не пройдёт, в отличие от сбоя связи: нужен человек.
 * Временные ответы токен-сервера (408/429/5xx) — не здесь, см.
 * OzonBusinessTokenOutageError.
 */
export class OzonBusinessAccessError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`ozon_business_delivery_oauth_failed_${status}: ${detail}`);
    this.name = "OzonBusinessAccessError";
  }
}

/**
 * Токен-сервер Ozon не выдал токен по временной причине (408, 429, 5xx):
 * ключи не виноваты, повтор позже обычно проходит. Формат сообщения тот же,
 * что и раньше, чтобы логи оставались сопоставимыми.
 */
export class OzonBusinessTokenOutageError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`ozon_business_delivery_oauth_failed_${status}: ${detail}`);
    this.name = "OzonBusinessTokenOutageError";
  }
}

/**
 * Ошибка доступа, а не временный сбой: ключи, права приложения, токен.
 * 401 от API сюда не входит: к нему клиент уже обновил токен, значит ключи
 * OAuth принял — это отдельный случай, см. isOzonBusinessTokenRejected.
 */
export function isOzonBusinessAccessError(error: unknown): boolean {
  return (
    error instanceof OzonBusinessAccessError ||
    (error instanceof OzonBusinessDeliveryError && error.status === 403)
  );
}

/**
 * API ответил 401 уже со свежим токеном: клиент один раз обменял ключи
 * заново и получил тот же ответ. OAuth при этом наши ключи принял —
 * значит, «ключи неверны или отозваны» тут не обязательно. Если вдобавок
 * тело ответа не в формате ошибок API («401 Unauthorized» текстом), это
 * похоже на разовый сбой на стороне Ozon: только выданный токен ещё не
 * подействовал или споткнулись их шлюз и защита от ботов. Повтор обычно
 * проходит, поэтому покупателю стоит предложить попробовать ещё раз.
 */
export function isOzonBusinessTokenRejected(
  error: unknown,
): error is OzonBusinessDeliveryError {
  return error instanceof OzonBusinessDeliveryError && error.status === 401;
}

/**
 * Ozon недоступен целиком: ответа нет (сеть, таймаут) или не работает
 * авторизация (ключи, токен, их шлюз). Бизнес-ответа при этом не получено —
 * в отличие от isOzonBusinessRejection, — поэтому покупателю можно не
 * отказывать, а идти по запасному пути: цена-заглушка и догонялка воркером.
 */
export function isOzonBusinessOutage(error: unknown): boolean {
  if (isOzonBusinessAccessError(error)) return true;
  // Токен-сервер перегружен или лежит (408/429/5xx) — временный сбой,
  // не внутренняя ошибка: покупателю нужна заглушка, а прогону — повтор
  if (error instanceof OzonBusinessTokenOutageError) return true;
  if (error instanceof OzonBusinessDeliveryError) {
    return [401, 408, 429].includes(error.status) || error.status >= 500;
  }
  // Сеть: обрыв, таймаут, DNS — ответа Ozon не было. Внутренние ошибки кода
  // (неожиданный редирект, чужая схема ответа) заглушкой не маскируем: их
  // должен блокировать разработчик, а не обходить покупатель.
  return (
    error instanceof Error &&
    error.name !== "ZodError" &&
    !error.message.startsWith("ozon_business_delivery_")
  );
}

/**
 * Ozon отклонил сам запрос (400, 404, 422 и т. п.): повтор с теми же данными
 * вернёт то же. Не относится к доступу, `408` и `429` — они временные.
 */
export function isOzonBusinessRejection(
  error: unknown,
): error is OzonBusinessDeliveryError {
  return (
    error instanceof OzonBusinessDeliveryError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 403, 408, 429].includes(error.status)
  );
}

/**
 * Заказ в Ozon создан, но отправление не подтверждено к отгрузке (чаще всего
 * не хватило баланса кабинета). Заказ уже существует, поэтому его номера
 * нужно сохранить: повтор создал бы второй такой же.
 */
export class ParcelNotApprovedError extends Error {
  constructor(
    readonly parcel: { orderId: string; postingNumbers: string[] },
    cause: unknown,
  ) {
    super(
      `ozon_business_parcel_not_approved: заказ ${parcel.orderId}, отправления ${parcel.postingNumbers.join(", ")}`,
      { cause },
    );
    this.name = "ParcelNotApprovedError";
  }
}
