import { baseEnv, env } from "@/env";
import {
  deliverNotification,
  type Notification,
} from "@/lib/custom-order/delivery";
import { notificationConfigured } from "@/lib/custom-order/inbox";
import {
  formatDetailsUpdatedMessage,
  formatOzonFailedMessage,
  formatPaidOrderMessage,
  type OrderMessage,
} from "./order-message";
import {
  claimStaffNotification,
  getProductOrderById,
  getProductOrderItems,
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

/** Покупатель дополнил детали заказа под заказ — сообщаем мастеру, не ломая ответ покупателю. */
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
