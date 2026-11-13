import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import {
  and,
  type CampaignAttribution,
  courseAccess,
  type Database,
  eq,
  orders,
  productOrderItems,
  productOrders,
  products,
  sql,
  user,
  workshopOrderNotifications,
  workshops,
} from "@stariva/db";
import { sendKitAccessEmail } from "@stariva/emails";
import { kitWorkshopOrderId } from "@stariva/web-api";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { accessUrl, errorReason, recipientColumns } from "./brief";

/** Полная оплата согласно productOrderStatus в схеме commerce/orders. */
const PAID = new Set<string>([
  "paid",
  "ozon_order_failed",
  "fulfilling",
  "shipped",
  "delivered",
  "ready_to_ship",
]);

function secretToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Как у доступа, открытого при оплате: мастер-класс из набора с сайта. */
function kitAttribution(): CampaignAttribution {
  const touch = {
    utm_source: "kit",
    utm_medium: "site",
    landing: "/order",
    at: new Date().toISOString(),
  };
  return { first: touch, last: touch };
}

/** Аккаунт покупателя по почте; гостю заводим новый, как при оплате на сайте. */
async function buyerId(db: Database, email: string, name: string) {
  const address = email.trim().toLowerCase();
  const find = () =>
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(sql`lower(${user.email})`, address))
      .limit(2);
  let matches = await find();
  if (matches.length === 0) {
    await db
      .insert(user)
      .values({ id: crypto.randomUUID(), name, email: address })
      .onConflictDoNothing({ target: user.email });
    matches = await find();
  }
  if (matches.length > 1) {
    throw new ORPCError("CONFLICT", {
      message:
        "Найдено несколько аккаунтов с этой почтой — проверьте покупателя",
    });
  }
  const [found] = matches;
  if (!found) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Не удалось завести аккаунт покупателя",
    });
  }
  return found.id;
}

/** Сохраняет отметку отдельно от доставки: эту операцию безопасно повторять. */
async function recordAccessSent(db: Database, orderId: string) {
  try {
    await db
      .insert(workshopOrderNotifications)
      .values({
        orderId,
        kind: "booked",
        channel: "email",
        sentAt: sql`now()`,
        leaseUntil: null,
      })
      .onConflictDoUpdate({
        target: [
          workshopOrderNotifications.orderId,
          workshopOrderNotifications.kind,
          workshopOrderNotifications.channel,
        ],
        set: { sentAt: sql`now()`, leaseUntil: null },
      });
    return { recorded: true, warning: null };
  } catch (error) {
    logger.error("workshops.kit_access.mark_failed", error, { orderId });
    return {
      recorded: false,
      warning: "Письмо отправлено, но отметка не сохранена",
    };
  }
}

/**
 * Отправляет покупателю набора письмо с доступом к урокам — кнопка в заказе.
 * Обычно письмо уходит само при оплате; кнопка нужна, когда оно не дошло.
 * Если доступ ещё не открыт (заказ оплачен до привязки мастер-класса или
 * вебхук не сработал), сначала открывает его: создаёт заказ мастер-класса
 * на 0 ₽ с тем же id, что и оплата на сайте, так что второй раз доступ не
 * выдаётся. В письме — ссылка в кабинет и пояснение, что коробку привезёт Ozon.
 *
 * @example client.admin.workshops.sendKitAccess({ orderId: "order_1", workshopSlug: "elka-makrame" })
 */
export const sendKitAccess = adminProcedure
  .input(
    z.object({
      orderId: z.string().min(1),
      workshopSlug: z.string().trim().min(1).max(200),
    }),
  )
  .handler(async ({ context, input }) => {
    const { db } = context;
    const [order] = await db
      .select({
        id: productOrders.id,
        status: productOrders.status,
        gift: productOrders.gift,
        userId: productOrders.userId,
        contactEmail: productOrders.contactEmail,
        contactName: productOrders.contactName,
        visitor: productOrders.visitor,
      })
      .from(productOrders)
      .where(eq(productOrders.id, input.orderId));
    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    if (!PAID.has(order.status)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Заказ не оплачен — доступ открываем после оплаты",
      });
    }

    // Подарок: письмо с доступом покупателю раскрыло бы сюрприз и заняло бы
    // курс вместо получателя — доступ выдаётся только кодом на купоне
    if (order.gift) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Заказ — подарок: доступ выдаётся кодом на купоне, на почту не отправляется",
      });
    }

    // Мастер-класс должен идти с товаром из этого заказа
    const [linked] = await db
      .select({ id: productOrderItems.id })
      .from(productOrderItems)
      .leftJoin(products, eq(products.slug, productOrderItems.productSlug))
      .where(
        and(
          eq(productOrderItems.orderId, order.id),
          eq(
            sql`case when ${productOrderItems.workshopLinkCaptured} then ${productOrderItems.workshopSlug} else ${products.workshopSlug} end`,
            input.workshopSlug,
          ),
        ),
      )
      .limit(1);
    if (!linked) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Мастер-класс не входит в этот заказ",
      });
    }

    const [workshop] = await db
      .select({
        slug: workshops.slug,
        title: workshops.title,
        releaseAt: workshops.releaseAt,
      })
      .from(workshops)
      .where(eq(workshops.slug, input.workshopSlug));
    if (!workshop) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }

    const workshopOrderId = kitWorkshopOrderId(order.id, workshop.slug);
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, workshopOrderId));

    if (!existing) {
      let email = order.contactEmail?.trim() || null;
      if (!email && order.userId) {
        const [account] = await db
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, order.userId));
        email = account?.email ?? null;
      }
      if (!email) {
        throw new ORPCError("BAD_REQUEST", {
          message: "У заказа нет почты — выдайте код и напечатайте купон",
        });
      }
      const contactEmail = email.trim().toLowerCase();
      const userId =
        order.userId ?? (await buyerId(db, contactEmail, order.contactName));

      await db.transaction(async (tx) => {
        const now = new Date();
        await tx
          .insert(orders)
          .values({
            id: workshopOrderId,
            userId,
            workshopSlug: workshop.slug,
            amount: 0,
            currency: "RUB",
            status: "paid",
            createdAt: now,
            paidAt: now,
            contactEmail,
            accessToken: secretToken(),
            telegramToken: secretToken(),
            attribution: kitAttribution(),
            visitor: order.visitor,
          })
          // Вебхук об оплате мог успеть создать тот же заказ
          .onConflictDoNothing({ target: orders.id });
        // Курс уже куплен раньше — доступ остаётся за тем заказом
        await tx
          .insert(courseAccess)
          .values({
            id: crypto.randomUUID(),
            userId,
            workshopSlug: workshop.slug,
            orderId: workshopOrderId,
          })
          .onConflictDoNothing({
            target: [courseAccess.userId, courseAccess.workshopSlug],
          });
      });
    }

    const [recipient] = await db
      .select(recipientColumns)
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .where(eq(orders.id, workshopOrderId));
    if (!recipient?.to) {
      throw new ORPCError("BAD_REQUEST", {
        message: "У покупателя нет email",
      });
    }
    const { to } = recipient;
    try {
      // Без ключа идемпотентности: повторная отправка — осознанное действие
      await sendKitAccessEmail({
        to,
        workshopTitle: workshop.title,
        accessUrl: accessUrl(recipient),
        // Урок ещё не вышел — в письме дата открытия, а не «смотрите сейчас»
        releaseAt: workshop.releaseAt,
      });
    } catch (error) {
      logger.error("workshops.kit_access.send_failed", error, {
        orderId: workshopOrderId,
      });
      throw new ORPCError("BAD_GATEWAY", {
        message: `Письмо не ушло: ${errorReason(error)}`,
      });
    }
    // Отметка «письмо о покупке ушло» не даёт сайту прислать то же письмо
    // вдогонку
    const mark = await recordAccessSent(db, workshopOrderId);
    return { to, ...mark, opened: !existing };
  });
