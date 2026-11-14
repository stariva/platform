/**
 * Ошибка Ozon Доставки. `infrastructure` — сбой не покупателя и не заказа, а
 * связи с Ozon или наших ключей: сеть, таймаут, 5xx, 401/403, протухший
 * refresh-токен, непонятный ответ. Из-за такого сбоя оформление не
 * блокируется — заказ принимается с ручной доставкой. Остальное (Ozon
 * отказал по существу: пункт выключен, адрес не обслуживается) покупателю
 * показывается как есть.
 */
export class OzonDeliveryError extends Error {
  readonly infrastructure: boolean;

  constructor(message: string, infrastructure: boolean) {
    super(message);
    this.name = "OzonDeliveryError";
    this.infrastructure = infrastructure;
  }
}

export function isOzonInfrastructureError(
  error: unknown,
): error is OzonDeliveryError {
  return error instanceof OzonDeliveryError && error.infrastructure;
}

/**
 * HTTP-статусы, при которых виноваты не данные запроса: ключи (401, 403),
 * таймаут (408), лимиты (429) и любые 5xx.
 */
export function isInfrastructureStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}
