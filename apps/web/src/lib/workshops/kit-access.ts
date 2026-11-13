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
  workshopAccessCodes,
  workshops,
} from "@stariva/db/schema";
import {
  generateAccessCode,
  kitCodeNote,
  kitWorkshopOrderId,
} from "@stariva/web-api";
import { and, eq, sql } from "drizzle-orm";
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

// Совпадение случайного кода с уже выданным — почти невероятно, но бывает
const CODE_ATTEMPTS = 5;

/**
 * Подарок: вместо письма выдаём по коду на каждый мастер-класс набора. Код
 * печатают на купоне и кладут в коробку, получатель вводит его на /code.
 * Идемпотентно: повторный вебхук не выдаёт второй код на тот же курс.
 */
async function issueGiftCodes(orderNumber: number, slugs: string[]) {
  const note = kitCodeNote(orderNumber);
  await db.transaction(async (tx) => {
    // Два вебхука подряд не должны выдать два кода на один курс
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`gift-codes:${note}`}, 0))`,
    );
    for (const slug of slugs) {
      const [existing] = await tx
        .select({ id: workshopAccessCodes.id })
        .from(workshopAccessCodes)
        .where(
          and(
            eq(workshopAccessCodes.channel, "kit"),
            eq(workshopAccessCodes.note, note),
            eq(workshopAccessCodes.workshopSlug, slug),
          ),
        )
        .limit(1);
      if (existing) continue;

      let issued = false;
      for (let attempt = 0; attempt < CODE_ATTEMPTS && !issued; attempt++) {
        const [row] = await tx
          .insert(workshopAccessCodes)
          .values({
            id: crypto.randomUUID(),
            code: generateAccessCode(),
            workshopSlug: slug,
            channel: "kit",
            // Мастер-класс уже оплачен в цене набора
            amount: 0,
            note,
          })
          .onConflictDoNothing({ target: workshopAccessCodes.code })
          .returning({ id: workshopAccessCodes.id });
        issued = Boolean(row);
      }
      if (!issued) throw new Error("access_code_not_issued");
      console.info(
        `[workshops/kit] Заказ №${orderNumber}: подарок, выдан код на «${slug}»`,
      );
    }
  });
}

/**
 * Набор оплатили на сайте — открываем мастер-класс, который идёт с ним, на
 * почту покупателя: письмо со ссылкой на уроки уходит сразу после оплаты, а
 * коробку привозит Ozon. Заказ мастер-класса создаётся на 0 ₽: он оплачен в
 * цене набора.
 *
 * Подарок (`gift`) почту не использует: доступ выдаётся кодом на купоне в
 * коробке, а получатель сам открывает уроки. Письма покупателю нет, даже если
 * он оставил почту.
 *
 * Идемпотентно, вызывается при каждом вебхуке об оплате. Без почты (её не
 * оставили и заказ оформлен без входа) ничего не делает — тогда мастер кладёт
 * в коробку купон с кодом.
 */
export async function grantKitWorkshops(productOrderId: string): Promise<void> {
  const [order] = await db
    .select({
      id: productOrders.id,
      number: productOrders.number,
      gift: productOrders.gift,
      userId: productOrders.userId,
      contactEmail: productOrders.contactEmail,
      contactName: productOrders.contactName,
      visitor: productOrders.visitor,
    })
    .from(productOrders)
    .where(eq(productOrders.id, productOrderId))
    .limit(1);
  if (!order) return;

  // Новые позиции используют снимок; старые сохраняют связь через каталог.
  const linked = await db
    .selectDistinct({ slug: workshops.slug })
    .from(productOrderItems)
    .leftJoin(products, eq(products.slug, productOrderItems.productSlug))
    .innerJoin(
      workshops,
      eq(
        workshops.slug,
        sql`case when ${productOrderItems.workshopLinkCaptured} then ${productOrderItems.workshopSlug} else ${products.workshopSlug} end`,
      ),
    )
    .where(and(eq(productOrderItems.orderId, productOrderId)));
  if (linked.length === 0) return;

  if (order.gift) {
    await issueGiftCodes(
      order.number,
      linked.map(({ slug }) => slug),
    );
    return;
  }

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
