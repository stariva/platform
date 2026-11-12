import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  type CampaignAttribution,
  courseAccess,
  type Database,
  eq,
  orders,
  productOrders,
  sql,
  user,
  workshopOrderNotifications,
  workshops,
} from "@stariva/db";
import { kitWorkshopOrderId } from "@stariva/web-api";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { sendBriefForOrder } from "./brief";

/** Заказ набора ещё не оплачен или деньги вернули — бриф не положен. */
const UNPAID = new Set<string>([
  "pending",
  "canceled",
  "refunded",
  "requested",
  "awaiting_deposit",
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
  const address = email.toLowerCase();
  await db
    .insert(user)
    .values({ id: crypto.randomUUID(), name, email: address })
    .onConflictDoNothing({ target: user.email });
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, address));
  if (!found) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Не удалось завести аккаунт покупателя",
    });
  }
  return found.id;
}

/**
 * Отправляет PDF-бриф мастер-класса покупателю набора — кнопка в заказе.
 * Если доступ к урокам ещё не открыт (заказ оплачен до привязки мастер-класса
 * или письмо при оплате не ушло), сначала открывает его: создаёт заказ
 * мастер-класса на 0 ₽ с тем же id, что и оплата на сайте, так что второй раз
 * доступ не выдаётся. В письме — PDF и ссылка в кабинет с уроками.
 *
 * @example client.admin.workshops.sendKitBrief({ orderId: "order_1", workshopSlug: "elka-makrame" })
 */
export const sendKitBrief = adminProcedure
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
    if (UNPAID.has(order.status)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Заказ не оплачен — бриф отправляем после оплаты",
      });
    }

    const [workshop] = await db
      .select({ slug: workshops.slug, materialFiles: workshops.materialFiles })
      .from(workshops)
      .where(eq(workshops.slug, input.workshopSlug));
    if (!workshop) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }
    // Проверяем до выдачи доступа: без PDF отправлять нечего
    if (workshop.materialFiles.length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "У мастер-класса нет PDF — загрузите бриф в карточке курса",
      });
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
      const contactEmail = email;
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

    const result = await sendBriefForOrder(db, workshopOrderId);
    if (!existing) {
      // В письме с брифом уже есть ссылка на уроки — письмо о покупке сайт
      // вдогонку слать не должен. Если бриф не ушёл, отметки нет, и сайт
      // сам дошлёт письмо о покупке с PDF.
      await db
        .insert(workshopOrderNotifications)
        .values({
          orderId: workshopOrderId,
          kind: "booked",
          channel: "email",
          sentAt: sql`now()`,
          leaseUntil: null,
        })
        .onConflictDoNothing();
    }
    return { ...result, opened: !existing };
  });
