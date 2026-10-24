import { grantAccess } from "@/lib/account/access";
import { issueNpdReceipt } from "@/lib/npd/issue";
import {
  markOrderCanceled,
  markOrderPaid,
  type WorkshopOrder,
} from "@/lib/payments/orders";
import type { Payment } from "@/lib/payments/payment";
import { fetchPayment } from "@/lib/payments/status";
import { notifyWorkshopBooked } from "./notifications";
import { earnsPreorderBonus } from "./preorder-bonus";
import { getWorkshopBySlug } from "./workshops-db";

/**
 * Применяет статус платежа к заказу мастер-класса: при успехе выдаёт доступ
 * и отправляет письмо о покупке. Платёж должен быть получен у провайдера
 * (API YooKassa, подписанное уведомление Robokassa), а не из тела запроса.
 */
export async function applyWorkshopPayment(
  order: WorkshopOrder,
  payment: Payment,
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

  // Вне wasUpdated: если прошлый вызов упал до чека, повтор вебхука его догонит
  const title = workshop?.title ?? order.workshopSlug;
  await issueNpdReceipt({
    payment,
    target: { kind: "workshop", orderId: order.id },
    services: [
      {
        name: `Доступ к видеоматериалу «${title}»`,
        amount: order.amount,
        quantity: 1,
      },
    ],
    email: { to: order.contactEmail, subject: `мастер-классу «${title}»` },
    expected: 1,
  });
}

/**
 * Покупатель вернулся с оплаты раньше вебхука: спрашиваем статус у провайдера
 * сами, чтобы сразу показать «Вы записаны». Сбой — не страшно, придёт вебхук.
 * false означает сбой сверки: отправку напоминания нужно отложить.
 */
export async function syncPendingWorkshopOrder(
  order: WorkshopOrder,
): Promise<boolean> {
  if (order.status !== "pending" || !order.paymentId) return true;
  try {
    const payment = await fetchPayment(order.paymentId);
    if (payment) await applyWorkshopPayment(order, payment);
    return true;
  } catch (error) {
    console.error(`[payments] Не удалось сверить заказ ${order.id}:`, error);
    return false;
  }
}
