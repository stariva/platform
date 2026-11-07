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
      const parsed = JSON.parse(body) as {
        error?: { code?: string | null; message?: string };
      };
      code = parsed.error?.code ?? undefined;
      detail = parsed.error?.message ?? detail;
    } catch {
      // Тело не JSON (например, страница прокси) — оставляем текст как есть
    }
    return new OzonBusinessDeliveryError(path, status, code, detail);
  }
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
