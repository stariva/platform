import { grantAccess } from "@/lib/account/access";
import {
  markOrderCanceled,
  markOrderPaid,
  type WorkshopOrder,
} from "@/lib/payments/orders";
import { getPayment, type YooKassaPayment } from "@/lib/payments/yookassa";
import { notifyWorkshopBooked } from "./notifications";
import { earnsPreorderBonus } from "./preorder-bonus";
import { getWorkshopBySlug } from "./workshops-db";

/**
 * Применяет статус платежа YooKassa к заказу мастер-класса: при успехе
 * выдаёт доступ и отправляет письмо о покупке. Платёж должен быть получен
 * напрямую из API YooKassa, а не из тела уведомления.
 */
export async function applyWorkshopPayment(
  order: WorkshopOrder,
  payment: YooKassaPayment,
): Promise<void> {
  if (payment.status === "canceled") {
    await markOrderCanceled(order.id);
    return;
  }
  if (payment.status !== "succeeded" || !payment.paid) return;

  const expectedValue = (order.amount / 100).toFixed(2);
  if (payment.amount.value !== expectedValue) {
    console.error(
      `[payments] Несовпадение суммы для заказа ${order.id}: ожидалось ${expectedValue}, получено ${payment.amount.value}`,
    );
    return;
  }

  const wasUpdated = await markOrderPaid(order.id);
  // Доступ выдаём в любом случае (grantAccess идемпотентен) — на случай,
  // если заказ уже был помечен оплаченным, а доступ не записался
  await grantAccess(order.userId, order.workshopSlug, order.id);

  // Подарок за предзаказ: курс может ещё не существовать в базе — доступ
  // дождётся его и появится в кабинете, когда курс опубликуют
  const workshop = await getWorkshopBySlug(order.workshopSlug, "owned");
  const bonus = earnsPreorderBonus({
    workshopSlug: order.workshopSlug,
    orderedAt: order.createdAt,
    releaseAt: workshop?.releaseAt ? new Date(workshop.releaseAt) : null,
  });
  if (bonus) await grantAccess(order.userId, bonus.slug, order.id);

  if (wasUpdated) {
    console.info(
      `[payments] Заказ ${order.id} оплачен, доступ к «${order.workshopSlug}» выдан`,
    );
    await notifyWorkshopBooked(order.id);
  }
}

/**
 * Покупатель вернулся с оплаты раньше вебхука: спрашиваем статус у YooKassa
 * сами, чтобы сразу показать «Вы записаны». Сбой — не страшно, придёт вебхук.
 */
export async function syncPendingWorkshopOrder(
  order: WorkshopOrder,
): Promise<void> {
  if (order.status !== "pending" || !order.paymentId) return;
  try {
    await applyWorkshopPayment(order, await getPayment(order.paymentId));
  } catch (error) {
    console.error(`[payments] Не удалось сверить заказ ${order.id}:`, error);
  }
}
