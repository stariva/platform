import { ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import {
  and,
  asc,
  type Database,
  eq,
  orderReceipts,
  orders,
  productOrders,
  user,
  workshops,
} from "@stariva/db";
import { sendReceiptEmail } from "@stariva/emails";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { checkReceipt, parseReceiptLink, SELLER_INN } from "./link";

/** Заказ, к которому привязан чек: на товары или на мастер-класс. */
const target = z.object({
  kind: z.enum(["product", "workshop"]),
  orderId: z.string().min(1),
});
type Target = z.infer<typeof target>;

type ReceiptRow = typeof orderReceipts.$inferSelect;

/** Кому и про что письмо с чеком; null — заказа нет. */
async function loadOrder(db: Database, { kind, orderId }: Target) {
  if (kind === "product") {
    const [row] = await db
      .select({
        number: productOrders.number,
        contactEmail: productOrders.contactEmail,
        accountEmail: user.email,
      })
      .from(productOrders)
      .leftJoin(user, eq(user.id, productOrders.userId))
      .where(eq(productOrders.id, orderId));
    if (!row) return null;
    return {
      to: row.contactEmail ?? row.accountEmail,
      subject: `заказу №${row.number}`,
      label: `заказу №${row.number}`,
    };
  }
  const [row] = await db
    .select({
      slug: orders.workshopSlug,
      title: workshops.title,
      contactEmail: orders.contactEmail,
      accountEmail: user.email,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug))
    .where(eq(orders.id, orderId));
  if (!row) return null;
  return {
    to: row.contactEmail ?? row.accountEmail,
    subject: `мастер-классу «${row.title ?? row.slug}»`,
    label: `записи на мастер-класс «${row.title ?? row.slug}»`,
  };
}

function targetOf(receipt: ReceiptRow): Target {
  return receipt.productOrderId
    ? { kind: "product", orderId: receipt.productOrderId }
    : { kind: "workshop", orderId: receipt.workshopOrderId ?? "" };
}

const toReceipt = (receipt: ReceiptRow) => ({
  id: receipt.id,
  number: receipt.number,
  url: receipt.url,
  createdAt: receipt.createdAt,
  emailedAt: receipt.emailedAt,
  emailedTo: receipt.emailedTo,
});

/**
 * Шлёт чек покупателю и отмечает, когда и куда. Ошибка письма не отменяет
 * привязку: чек уже сохранён, мастер отправит его повторно.
 */
async function emailReceipt(
  db: Database,
  receipt: ReceiptRow,
  order: { to: string | null; subject: string },
): Promise<{ receipt: ReceiptRow; emailError: string | null }> {
  if (!order.to) {
    return { receipt, emailError: "У покупателя нет email" };
  }
  try {
    await sendReceiptEmail({
      to: order.to,
      subject: order.subject,
      receiptNumber: receipt.number,
      receiptUrl: receipt.url,
    });
  } catch (error) {
    logger.error("receipts.email.failed", error, { receiptId: receipt.id });
    return { receipt, emailError: "Письмо не ушло, попробуйте ещё раз" };
  }
  const [updated] = await db
    .update(orderReceipts)
    .set({ emailedAt: new Date(), emailedTo: order.to })
    .where(eq(orderReceipts.id, receipt.id))
    .returning();
  return { receipt: updated ?? receipt, emailError: null };
}

/**
 * Чеки заказа и почта, на которую они уйдут.
 *
 * @example client.admin.receipts.forOrder({ kind: "product", orderId })
 */
const forOrder = adminProcedure
  .input(target)
  .handler(async ({ context, input }) => {
    const order = await loadOrder(context.db, input);
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    const rows = await context.db
      .select()
      .from(orderReceipts)
      .where(
        input.kind === "product"
          ? eq(orderReceipts.productOrderId, input.orderId)
          : eq(orderReceipts.workshopOrderId, input.orderId),
      )
      .orderBy(asc(orderReceipts.createdAt));
    return { to: order.to, receipts: rows.map(toReceipt) };
  });

/**
 * Привязывает к заказу чек по ссылке из «Мой налог» и, если `send`, сразу
 * отправляет его покупателю. Чек проверяется в ФНС: ИНН — Ольги, чек
 * существует. Один чек — один заказ.
 *
 * @example client.admin.receipts.attach({ kind: "product", orderId, link, send: true })
 */
const attach = adminProcedure
  .input(
    target.extend({
      link: z.string().trim().min(1).max(500),
      send: z.boolean().default(true),
    }),
  )
  .handler(async ({ context, input }) => {
    const link = parseReceiptLink(input.link);
    if (!link) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Это не ссылка на чек. В «Мой налог» откройте чек, нажмите «Поделиться» и скопируйте ссылку",
      });
    }
    if (link.inn !== SELLER_INN) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Чек выписан на другой ИНН: ${link.inn}`,
      });
    }
    const order = await loadOrder(context.db, input);
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

    // Ошибка «чек уже привязан» с тем заказом, к которому он привязан
    const taken = async () => {
      const [existing] = await context.db
        .select()
        .from(orderReceipts)
        .where(
          and(
            eq(orderReceipts.inn, link.inn),
            eq(orderReceipts.number, link.number),
          ),
        );
      if (!existing) return null;
      const owner = await loadOrder(context.db, targetOf(existing));
      return new ORPCError("CONFLICT", {
        message: owner
          ? `Этот чек уже привязан к ${owner.label}`
          : "Этот чек уже привязан к другому заказу",
      });
    };
    const duplicate = await taken();
    if (duplicate) throw duplicate;

    const check = await checkReceipt(link.url);
    if (check === "not_found") {
      throw new ORPCError("BAD_REQUEST", {
        message: "ФНС не нашла такой чек — проверьте ссылку",
      });
    }
    if (check === "unavailable") {
      throw new ORPCError("BAD_GATEWAY", {
        message: "Сервис «Мой налог» не ответил, попробуйте через минуту",
      });
    }

    const [receipt] = await context.db
      .insert(orderReceipts)
      .values({
        productOrderId: input.kind === "product" ? input.orderId : null,
        workshopOrderId: input.kind === "workshop" ? input.orderId : null,
        inn: link.inn,
        number: link.number,
        url: link.url,
      })
      .onConflictDoNothing()
      .returning();
    // Тот же чек успели привязать параллельно
    if (!receipt) {
      throw (
        (await taken()) ??
        new ORPCError("CONFLICT", { message: "Этот чек уже привязан" })
      );
    }

    if (!input.send) return { receipt: toReceipt(receipt), emailError: null };
    const sent = await emailReceipt(context.db, receipt, order);
    return { receipt: toReceipt(sent.receipt), emailError: sent.emailError };
  });

/**
 * Отправляет уже привязанный чек покупателю (ещё раз).
 *
 * @example client.admin.receipts.send({ id })
 */
const send = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [receipt] = await context.db
      .select()
      .from(orderReceipts)
      .where(eq(orderReceipts.id, input.id));
    if (!receipt)
      throw new ORPCError("NOT_FOUND", { message: "Чек не найден" });
    const order = await loadOrder(context.db, targetOf(receipt));
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    const sent = await emailReceipt(context.db, receipt, order);
    if (sent.emailError) {
      throw new ORPCError("BAD_REQUEST", { message: sent.emailError });
    }
    return toReceipt(sent.receipt);
  });

/**
 * Отвязывает чек от заказа — если привязали не тот. Сам чек в «Мой налог»
 * остаётся: аннулировать его можно только там.
 *
 * @example client.admin.receipts.remove({ id })
 */
const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(orderReceipts)
      .where(eq(orderReceipts.id, input.id))
      .returning({ id: orderReceipts.id });
    if (!removed)
      throw new ORPCError("NOT_FOUND", { message: "Чек не найден" });
    return removed;
  });

export const adminReceiptsRouter = { forOrder, attach, send, remove };
