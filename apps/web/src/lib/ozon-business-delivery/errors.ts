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
  constructor(
    readonly path: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly detail: string,
  ) {
    super(
      `ozon_business_delivery_request_failed_${status} ${path}${code ? ` ${code}` : ""}: ${detail}`,
    );
    this.name = "OzonBusinessDeliveryError";
  }

  static fromResponse(
    path: string,
    status: number,
    body: string,
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
    return new OzonBusinessDeliveryError(path, status, code, detail);
  }
}

/**
 * Ozon не принял ключи (неверные или отозванные) или не выдал токен с нужными
 * доступами. Само это не пройдёт, в отличие от сбоя связи: нужен человек.
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

/** Ошибка доступа, а не временный сбой: ключи, права приложения, токен. */
export function isOzonBusinessAccessError(error: unknown): boolean {
  return (
    error instanceof OzonBusinessAccessError ||
    (error instanceof OzonBusinessDeliveryError &&
      (error.status === 401 || error.status === 403))
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
