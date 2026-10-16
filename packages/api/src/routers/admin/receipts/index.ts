import { ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import { SELLER_INN } from "@stariva/config/seller";
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
import {
  detectImageType,
  isPublicStorageConfigured,
  receiptImageKey,
  uploadPublicObject,
} from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { checkReceipt, parseReceiptLink } from "./link";
import { loadReceiptsExpected } from "./summary";

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

/** Картинка чека для покупателя: наша копия, а если её нет — на сервисе ФНС. */
const receiptImage = (receipt: ReceiptRow) => receipt.imageUrl ?? receipt.url;

/**
 * Кладёт копию картинки чека в наш бакет и возвращает её адрес. Без бакета
 * или при сбое — null: чек остаётся со ссылкой на ФНС, привязка не срывается.
 */
async function storeCopy(
  receipt: Pick<ReceiptRow, "inn" | "number">,
  image: Uint8Array,
): Promise<string | null> {
  const contentType = detectImageType(image);
  if (!contentType || !isPublicStorageConfigured()) return null;
  try {
    return await uploadPublicObject(
      receiptImageKey(receipt.inn, receipt.number, contentType),
      image,
      contentType,
    );
  } catch (error) {
    logger.error("receipts.copy.failed", error, {
      inn: receipt.inn,
      number: receipt.number,
    });
    return null;
  }
}

/**
 * Чеку, привязанному до появления копий, снимает копию сейчас — пока ФНС
 * отвечает. Не получилось — чек уходит со ссылкой на ФНС, как раньше.
 */
async function ensureCopy(db: Database, receipt: ReceiptRow) {
  if (receipt.imageUrl) return receipt;
  const check = await checkReceipt(receipt.url, { attempts: 2 });
  if (check.status !== "found") return receipt;
  const imageUrl = await storeCopy(receipt, check.image);
  if (!imageUrl) return receipt;
  const [updated] = await db
    .update(orderReceipts)
    .set({ imageUrl })
    .where(eq(orderReceipts.id, receipt.id))
    .returning();
  return updated ?? receipt;
}

const toReceipt = (receipt: ReceiptRow) => ({
  id: receipt.id,
  number: receipt.number,
  url: receiptImage(receipt),
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
  stored: ReceiptRow,
  order: { to: string | null; subject: string },
): Promise<{ receipt: ReceiptRow; emailError: string | null }> {
  if (!order.to) {
    return { receipt: stored, emailError: "У покупателя нет email" };
  }
  const receipt = await ensureCopy(db, stored);
  try {
    await sendReceiptEmail({
      to: order.to,
      subject: order.subject,
      receiptNumber: receipt.number,
      receiptUrl: receiptImage(receipt),
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
    return {
      to: order.to,
      receipts: rows.map(toReceipt),
      // Сколько чеков положено по числу оплат — карточка заказа предупреждает о нехватке
      expected: await loadReceiptsExpected(context.db, input),
    };
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
    if (check.status === "not_found") {
      throw new ORPCError("BAD_REQUEST", {
        message: "ФНС не нашла такой чек — проверьте ссылку",
      });
    }
    if (check.status === "unavailable") {
      logger.warn("receipts.check.unavailable", {
        reason: check.reason,
        url: link.url,
      });
      throw new ORPCError("BAD_GATEWAY", {
        message: `Не удалось проверить чек в «Мой налог»: ${check.reason}. Попробуйте через минуту`,
      });
    }

    const imageUrl = await storeCopy(link, check.image);

    const [receipt] = await context.db
      .insert(orderReceipts)
      .values({
        productOrderId: input.kind === "product" ? input.orderId : null,
        workshopOrderId: input.kind === "workshop" ? input.orderId : null,
        inn: link.inn,
        number: link.number,
        url: link.url,
        imageUrl,
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
