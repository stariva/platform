import { baseEnv, env } from "@/env";
import {
  deliverNotification,
  type Notification,
} from "@/lib/custom-order/delivery";
import { notificationConfigured } from "@/lib/custom-order/inbox";
import { paymentOutcome } from "./made-to-order-flow";
import {
  formatDetailsUpdatedMessage,
  formatMadeToOrderPaymentMessage,
  formatMadeToOrderRequestMessage,
  formatOzonFailedMessage,
  formatPaidOrderMessage,
  type OrderMessage,
} from "./order-message";
import {
  claimPaymentNotification,
  claimStaffNotification,
  getOrderPayment,
  getProductOrderById,
  getProductOrderItems,
  listOrderPayments,
  releasePaymentNotification,
  releaseStaffNotification,
} from "./orders";

function send(
  id: string,
  { title, message }: OrderMessage,
  scope: string,
): Promise<boolean> {
  const notification: Notification = {
    id,
    title,
    message,
    emailSubject: `${title} · Stariva`,
    idempotencyScope: scope,
    photoBase64: null,
    photoType: null,
  };
  return deliverNotification(notification, {
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    telegramChatId: env.TELEGRAM_CHAT_ID,
    emailKey: baseEnv.RESEND_API_KEY,
    emailFrom: env.ORDER_EMAIL_FROM,
    emailTo: env.ORDER_EMAIL_TO,
  });
}

/**
 * Один раз сообщает мастеру об оплаченном заказе. Если отправка не удалась,
 * бросает ошибку — webhook ответит 500, YooKassa повторит, и мы попробуем снова.
 * Если каналов уведомлений нет вовсе — только громко пишем в лог, иначе
 * YooKassa повторяла бы webhook до бесконечности.
 */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  if (!notificationConfigured()) {
    console.error(
      `[order-notifications] КРИТИЧНО: заказ ${orderId} оплачен, но уведомления мастеру не настроены`,
    );
    return;
  }
  if (!(await claimStaffNotification(orderId))) return;

  try {
    const order = await getProductOrderById(orderId);
    if (!order) return;
    const message = formatPaidOrderMessage(
      order,
      await getProductOrderItems(orderId),
    );
    if (!(await send(orderId, message, "order-paid"))) {
      throw new Error("staff_notification_failed");
    }
  } catch (error) {
    await releaseStaffNotification(orderId);
    throw error;
  }
}

/**
 * Сообщает мастеру о новой заявке под заказ. Заявка уже сохранена, поэтому
 * сбой отправки не ломает ответ покупателю: право на уведомление
 * возвращается, а заявка всё равно видна в админке среди «Требуют действия».
 */
export async function notifyMadeToOrderRequested(
  orderId: string,
): Promise<void> {
  if (!notificationConfigured()) {
    console.error(
      `[order-notifications] Заявка под заказ ${orderId} создана, но уведомления мастеру не настроены`,
    );
    return;
  }
  if (!(await claimStaffNotification(orderId))) return;

  try {
    const order = await getProductOrderById(orderId);
    if (!order) return;
    const message = formatMadeToOrderRequestMessage(
      order,
      await getProductOrderItems(orderId),
    );
    if (!(await send(orderId, message, "order-request"))) {
      throw new Error("staff_notification_failed");
    }
  } catch (error) {
    await releaseStaffNotification(orderId);
    console.error(
      `[order-notifications] Не удалось сообщить о заявке ${orderId}:`,
      error,
    );
  }
}

/**
 * Один раз сообщает мастеру об оплате этапа заказа под заказ — или громко,
 * если оплата не зачлась (двойная, после изменения условий). Как и для
 * оплаченного заказа, при сбое отправки бросает ошибку, чтобы YooKassa повторила webhook.
 */
export async function notifyMadeToOrderPayment(
  paymentId: string,
): Promise<void> {
  if (!notificationConfigured()) {
    console.error(
      `[order-notifications] КРИТИЧНО: платёж ${paymentId} получен, но уведомления мастеру не настроены`,
    );
    return;
  }
  if (!(await claimPaymentNotification(paymentId))) return;

  try {
    const payment = await getOrderPayment(paymentId);
    const order = payment && (await getProductOrderById(payment.orderId));
    if (!payment || !order) return;
    const outcome = paymentOutcome(
      order,
      await listOrderPayments(order.id),
      payment,
    );
    const message = formatMadeToOrderPaymentMessage(order, payment, outcome);
    if (!(await send(paymentId, message, "order-payment"))) {
      throw new Error("staff_notification_failed");
    }
  } catch (error) {
    await releasePaymentNotification(paymentId);
    throw error;
  }
}

/** Оплата прошла, а отправление в Ozon не создалось — нужна ручная обработка. */
export async function notifyOzonOrderFailed(orderId: string): Promise<void> {
  try {
    const order = await getProductOrderById(orderId);
    if (!order) return;
    // Каждая неудачная попытка — отдельное напоминание, поэтому ключ уникален
    await send(
      `${orderId}/${Date.now()}`,
      formatOzonFailedMessage(order),
      "order-ozon-failed",
    );
  } catch (error) {
    console.error("[order-notifications] Не удалось отправить алерт:", error);
  }
}

/** Покупатель дополнил заявку под заказ — сообщаем мастеру, не ломая ответ покупателю. */
export async function notifyMadeToOrderDetailsUpdated(
  orderId: string,
): Promise<void> {
  try {
    const order = await getProductOrderById(orderId);
    if (!order) return;
    await send(
      `${orderId}/${Date.now()}`,
      formatDetailsUpdatedMessage(order, await getProductOrderItems(orderId)),
      "order-details",
    );
  } catch (error) {
    console.error("[order-notifications] Не удалось отправить детали:", error);
  }
}
