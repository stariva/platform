import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@stariva/db";
import {
  type CampaignAttribution,
  courseAccess,
  orders,
  productOrderItems,
  productOrders,
  products,
  workshops,
} from "@stariva/db/schema";
import { kitWorkshopOrderId } from "@stariva/web-api";
import { and, eq, isNotNull } from "drizzle-orm";
import { getProductOrderCustomerEmail } from "@/lib/commerce/orders";
import { findOrCreateBuyer } from "./buyer";
import { notifyWorkshopBooked } from "./notifications";

function secretToken(): string {
  return randomBytes(24).toString("base64url");
}

/** В отчётах по меткам заказ виден как мастер-класс из набора с сайта. */
function kitAttribution(): CampaignAttribution {
  const touch = {
    utm_source: "kit",
    utm_medium: "site",
    landing: "/order",
    at: new Date().toISOString(),
  };
  return { first: touch, last: touch };
}

/**
 * Набор оплатили на сайте — открываем мастер-класс, который идёт с ним, на
 * почту покупателя: письмо со ссылкой на уроки и PDF уходит как при обычной
 * покупке. Заказ мастер-класса создаётся на 0 ₽: он оплачен в цене набора.
 *
 * Идемпотентно, вызывается при каждом вебхуке об оплате. Без почты (её не
 * оставили и заказ оформлен без входа) ничего не делает — тогда мастер кладёт
 * в коробку купон с кодом.
 */
export async function grantKitWorkshops(productOrderId: string): Promise<void> {
  const [order] = await db
    .select({
      id: productOrders.id,
      userId: productOrders.userId,
      contactEmail: productOrders.contactEmail,
      contactName: productOrders.contactName,
      visitor: productOrders.visitor,
    })
    .from(productOrders)
    .where(eq(productOrders.id, productOrderId))
    .limit(1);
  if (!order) return;

  // Только мастер-классы, которые есть в каталоге: связь у товара — просто slug
  const linked = await db
    .selectDistinct({ slug: workshops.slug })
    .from(productOrderItems)
    .innerJoin(products, eq(products.slug, productOrderItems.productSlug))
    .innerJoin(workshops, eq(workshops.slug, products.workshopSlug))
    .where(
      and(
        eq(productOrderItems.orderId, productOrderId),
        isNotNull(products.workshopSlug),
      ),
    );
  if (linked.length === 0) return;

  const email = await getProductOrderCustomerEmail(order);
  if (!email) {
    console.info(
      `[workshops/kit] Заказ ${productOrderId}: почты нет, мастер-класс к набору не открыт`,
    );
    return;
  }
  // Заказ из кабинета — уроки в тот же кабинет; гостю заводим аккаунт по почте,
  // войти в него можно только по ссылке из письма
  const userId =
    order.userId ?? (await findOrCreateBuyer(email, order.contactName)).id;

  for (const { slug } of linked) {
    const orderId = kitWorkshopOrderId(productOrderId, slug);
    const created = await db.transaction(async (tx) => {
      const [access] = await tx
        .insert(courseAccess)
        .values({
          id: crypto.randomUUID(),
          userId,
          workshopSlug: slug,
          orderId: null,
        })
        .onConflictDoNothing({
          target: [courseAccess.userId, courseAccess.workshopSlug],
        })
        .returning({ id: courseAccess.id });
      // Курс уже есть (куплен раньше или вебхук пришёл повторно) — заказ не нужен
      if (!access) return false;

      const now = new Date();
      await tx.insert(orders).values({
        id: orderId,
        userId,
        workshopSlug: slug,
        amount: 0,
        currency: "RUB",
        status: "paid",
        createdAt: now,
        paidAt: now,
        contactEmail: email,
        accessToken: secretToken(),
        telegramToken: secretToken(),
        attribution: kitAttribution(),
        visitor: order.visitor,
      });
      await tx
        .update(courseAccess)
        .set({ orderId })
        .where(eq(courseAccess.id, access.id));
      return true;
    });
    if (!created) continue;

    console.info(
      `[workshops/kit] Заказ ${productOrderId}: открыт мастер-класс «${slug}»`,
    );
    // Сбой письма не страшен: недошедшее дошлёт прогон напоминаний
    await notifyWorkshopBooked(orderId);
  }
}
