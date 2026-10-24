import {
  and,
  cartEvents,
  chatConversations,
  contactClicks,
  count,
  customOrderRequests,
  eq,
  gte,
  notInArray,
  orders,
  productOrders,
  reviews,
  sql,
  user,
  videoAccessLog,
  workshopAccessCodes,
} from "@stariva/db";

import { adminProcedure } from "../../../orpc";
import { moscowDay, toMoscowDay } from "../crm/model";
import { viewerKey } from "../workshops/views";

/**
 * Сколько нового появилось в разделах админки с начала дня по Москве — для
 * циферок в боковом меню. Заказ с сайта считается, когда покупатель дошёл
 * до оплаты или оставил заявку под заказ: неоплаченные и отменённые — шум.
 * Запись на мастер-класс — по оплате, корзина — по первому событию,
 * просмотр — как строка на странице просмотров (зритель × урок).
 *
 * @example client.admin.stats.today()
 */
export const today = adminProcedure.handler(async ({ context }) => {
  const since = moscowDay(toMoscowDay(new Date()));
  const db = context.db;
  const total = (rows: { total: number }[]) => rows[0]?.total ?? 0;

  const [
    siteOrders,
    carts,
    requests,
    reviewRows,
    workshopOrders,
    views,
    accessCodes,
    clicks,
    users,
    chats,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(productOrders)
      .where(
        and(
          gte(productOrders.createdAt, since),
          notInArray(productOrders.status, ["pending", "canceled"]),
        ),
      ),
    // Новая корзина — у которой сегодня первое событие
    db
      .select({ total: sql<number>`count(distinct ${cartEvents.cartId})::int` })
      .from(cartEvents)
      .where(
        and(
          gte(cartEvents.createdAt, since),
          sql`not exists (select 1 from ${cartEvents} e where e.cart_id = ${cartEvents.cartId} and e.created_at < ${since.toISOString()})`,
        ),
      ),
    db
      .select({ total: count() })
      .from(customOrderRequests)
      .where(gte(customOrderRequests.createdAt, since)),
    db
      .select({ total: count() })
      .from(reviews)
      .where(gte(reviews.createdAt, since)),
    db
      .select({ total: count() })
      .from(orders)
      .where(and(eq(orders.status, "paid"), gte(orders.paidAt, since))),
    db
      .select({
        total: sql<number>`count(distinct (${viewerKey}, ${videoAccessLog.workshopSlug}, ${videoAccessLog.lessonId}))::int`,
      })
      .from(videoAccessLog)
      .where(gte(videoAccessLog.createdAt, since)),
    db
      .select({ total: count() })
      .from(workshopAccessCodes)
      .where(gte(workshopAccessCodes.redeemedAt, since)),
    db
      .select({ total: count() })
      .from(contactClicks)
      .where(gte(contactClicks.createdAt, since)),
    db.select({ total: count() }).from(user).where(gte(user.createdAt, since)),
    db
      .select({ total: count() })
      .from(chatConversations)
      .where(gte(chatConversations.createdAt, since)),
  ]);

  return {
    orders: total(siteOrders),
    carts: total(carts),
    requests: total(requests),
    reviews: total(reviewRows),
    workshopOrders: total(workshopOrders),
    workshopViews: total(views),
    accessCodes: total(accessCodes),
    contactClicks: total(clicks),
    users: total(users),
    chats: total(chats),
  };
});
