/**
 * Платёж в том виде, в каком его применяют к заказу, — общий для ЮKassa и
 * Robokassa. Поля повторяют платёж YooKassa: он был первым, и обработка
 * заказов написана под него. Получать его нужно у провайдера (API или
 * подписанное уведомление), а не из тела запроса как есть.
 */
export interface Payment {
  /** id платежа в ЮKassa или «robokassa:<номер счёта>». */
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: {
    value: string; // "1490.00"
    currency: string; // "RUB"
  };
  /** ISO 8601: когда платёж создан и когда деньги списаны. */
  created_at?: string;
  captured_at?: string;
  metadata?: Record<string, string>;
}

/** Сумма в копейках → строка "1490.00", как её отдают провайдеры. */
export function kopecksToValue(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
