import { getOrderById, type WorkshopOrder } from "@/lib/payments/orders";
import {
  getPayment,
  kopecksToValue,
  type YooKassaPayment,
} from "@/lib/payments/yookassa";
import { cookieMatchesOrder } from "./order-cookie";

export interface WorkshopPurchase {
  userId: string;
  workshopSlug: string;
  /** Комбо или null: заказ одного курса не открываем вместо комбо и наоборот. */
  bundleSlug?: string | null;
  amountKopecks: number;
}

/**
 * Заказ из cookie можно открыть снова: его оформил этот же браузер, на того же
 * покупателя, тот же курс и по той же цене, а платёж в ЮKassa уже создан.
 * Без проверки cookie гость, введя чужой email, получил бы метку Telegram
 * и страницу «Вы записаны» чужого заказа.
 */
export function canReuseOrder(
  order: WorkshopOrder,
  cookie: string | undefined,
  purchase: WorkshopPurchase,
): boolean {
  return (
    order.status === "pending" &&
    Boolean(order.paymentId) &&
    order.userId === purchase.userId &&
    order.workshopSlug === purchase.workshopSlug &&
    (order.bundleSlug ?? null) === (purchase.bundleSlug ?? null) &&
    order.amount === purchase.amountKopecks &&
    cookieMatchesOrder(cookie, order)
  );
}

/** Ссылка на оплату, пока ЮKassa ждёт по платежу ту же сумму; иначе null. */
export function pendingConfirmationUrl(
  payment: YooKassaPayment,
  amountKopecks: number,
): string | null {
  if (payment.status !== "pending") return null;
  if (payment.amount.value !== kopecksToValue(amountKopecks)) return null;
  return payment.confirmation?.confirmation_url ?? null;
}

/**
 * Неоплаченный заказ этого браузера, платёж по которому ещё жив. Покупатель
 * вернулся с формы оплаты и снова нажал «Купить» — отдаём тот же платёж,
 * а не заводим второй заказ, который потом истечёт и повиснет отменённым.
 */
export async function reusePendingOrder(
  cookie: string | undefined,
  purchase: WorkshopPurchase,
): Promise<{ order: WorkshopOrder; confirmationUrl: string } | null> {
  const orderId = cookie?.split(".")[0];
  if (!orderId) return null;
  const order = await getOrderById(orderId);
  if (!order?.paymentId || !canReuseOrder(order, cookie, purchase)) return null;

  try {
    const payment = await getPayment(order.paymentId);
    const confirmationUrl = pendingConfirmationUrl(
      payment,
      purchase.amountKopecks,
    );
    return confirmationUrl ? { order, confirmationUrl } : null;
  } catch (error) {
    // ЮKassa не ответила — не мешаем покупке, просто заводим новый заказ
    console.error("[payments/create] Не удалось проверить платёж:", error);
    return null;
  }
}
