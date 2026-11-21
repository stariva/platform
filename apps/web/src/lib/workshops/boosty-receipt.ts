import { db, eq, orders, user } from "@stariva/db";
import { issueNpdReceipt } from "@/lib/npd/issue";
import { kopecksToValue } from "@/lib/payments/payment";
import { getBundle } from "./bundles";
import { getWorkshopBySlug } from "./workshops-db";

/**
 * Чек Boosty-покупки: вебхука от Boosty нет, поэтому выписываем его сами,
 * когда заказ стал оплаченным — автоактивацией по email или сверкой в
 * админке. Как при оплате ЮKassa: чек уходит в «Мой налог» и ждёт отправки
 * из карточки заказа.
 *
 * Выписка идентемпотентна (заявка НПД занимает заказ один раз), а сбой не
 * бросает исключение: мастер получает алерт и привязывает чек ссылкой в
 * админке, как раньше.
 *
 * false — заказ не оплачен или оплачен не через Boosty: чек не положен.
 */
export async function issueBoostyOrderReceipt(
  orderId: string,
): Promise<boolean> {
  const [order] = await db
    .select({
      status: orders.status,
      paymentId: orders.paymentId,
      amount: orders.amount,
      contactEmail: orders.contactEmail,
      accountEmail: user.email,
      workshopSlug: orders.workshopSlug,
      bundleSlug: orders.bundleSlug,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (order?.status !== "paid" || !order.paymentId?.startsWith("boosty:")) {
    return false;
  }

  const workshop = await getWorkshopBySlug(order.workshopSlug, "owned");
  const title = workshop?.title ?? order.workshopSlug;
  const bundle = getBundle(order.bundleSlug);
  const name = bundle
    ? `Доступ к видеоматериалам «${title}» и ${bundle.extras.map((extra) => extra.title).join(", ")}`
    : `Доступ к видеоматериалу «${title}»`;

  await issueNpdReceipt({
    // Ключ заявки НПД — сам заказ: paymentId «boosty:<slug>» общий у всех
    // покупателей мастер-класса, по нему заявки задваивались бы
    payment: {
      id: `boosty:${orderId}`,
      status: "succeeded",
      paid: true,
      amount: { value: kopecksToValue(order.amount), currency: "RUB" },
      captured_at: (order.paidAt ?? order.createdAt).toISOString(),
    },
    target: { kind: "workshop", orderId },
    services: [
      {
        name,
        amount: order.amount,
        quantity: 1,
      },
    ],
    email: {
      to: order.contactEmail ?? order.accountEmail,
      subject: bundle
        ? `комбо мастер-классов «${bundle.title}»`
        : `мастер-классу «${title}»`,
    },
    expected: 1,
  });
  return true;
}
