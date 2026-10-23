import type { Payment } from "./payment";
import { getRobokassaPayment, parseRobokassaPaymentId } from "./robokassa";
import { getPayment } from "./yookassa";

/**
 * Актуальный статус платежа заказа у того провайдера, который его принял:
 * paymentId «robokassa:<номер>» — счёт Robokassa, остальные — ЮKassa.
 * null — платежа нет.
 */
export async function fetchPayment(paymentId: string): Promise<Payment | null> {
  const invoiceId = parseRobokassaPaymentId(paymentId);
  if (invoiceId !== null) return getRobokassaPayment(invoiceId);
  return getPayment(paymentId);
}
