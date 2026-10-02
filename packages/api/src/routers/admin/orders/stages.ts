import { ORPCError } from "@orpc/server";
import {
  and,
  type Database,
  eq,
  inArray,
  productOrderItems,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { depositFor, paymentDueFrom, toKopecks } from "./stage-math";

/*
 * Этапы заказа под заказ, которые двигает мастер:
 * заявка → (условия, одобрение) → предоплата → изготовление → доплата → отправка.
 * Оплаты двигает webhook YooKassa на сайте, а не админка.
 */

type OrderRow = typeof productOrders.$inferSelect;
type OrderStatus = OrderRow["status"];

const rublesSchema = z.number().finite().nonnegative().max(10_000_000);

const conflict = () =>
  new ORPCError("CONFLICT", { message: "Заказ изменился, обновите страницу" });

/** Переводит заказ под заказ из одного из статусов `from`; CONFLICT, если он уже в другом. */
async function transition(
  db: Database,
  id: string,
  from: OrderStatus[],
  set: Partial<typeof productOrders.$inferInsert>,
) {
  const [updated] = await db
    .update(productOrders)
    .set(set)
    .where(
      and(
        eq(productOrders.id, id),
        eq(productOrders.kind, "made_to_order"),
        inArray(productOrders.status, from),
      ),
    )
    .returning({ id: productOrders.id, status: productOrders.status });
  if (!updated) throw conflict();
  return updated;
}

/**
 * Условия заявки: цены по позициям, доставка и срок изготовления. С
 * `approve` заодно одобряет заявку — фиксирует предоплату (50% стоимости
 * изделий) и даёт покупателю срок на оплату. Менять условия можно только до
 * одобрения: после него покупатель видит сумму и может платить.
 */
export const terms = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      items: z
        .array(z.object({ id: z.string().min(1), price: rublesSchema }))
        .max(50),
      amountDelivery: rublesSchema,
      leadTime: z.string().trim().max(120),
      approve: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, input }) =>
    context.db.transaction(async (tx) => {
      const [order] = await tx
        .select({ kind: productOrders.kind, status: productOrders.status })
        .from(productOrders)
        .where(eq(productOrders.id, input.id))
        .for("update");
      if (!order)
        throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
      if (order.kind !== "made_to_order" || order.status !== "requested") {
        throw new ORPCError("CONFLICT", {
          message:
            "Условия меняются только до одобрения — сначала верните заказ на согласование",
        });
      }

      const prices = new Map(
        input.items.map((item) => [item.id, toKopecks(item.price)]),
      );
      const items = await tx
        .select()
        .from(productOrderItems)
        .where(eq(productOrderItems.orderId, input.id));
      let amountProducts = 0;
      for (const item of items) {
        const price = prices.get(item.id) ?? item.price;
        if (price !== item.price) {
          await tx
            .update(productOrderItems)
            .set({ price })
            .where(eq(productOrderItems.id, item.id));
        }
        amountProducts += price * item.quantity;
      }
      const amountDelivery = toKopecks(input.amountDelivery);
      const amountTotal = amountProducts + amountDelivery;
      if (amountProducts <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Укажите цену изделий",
        });
      }

      const now = new Date();
      const deposit = depositFor(amountProducts);
      if (input.approve && (deposit <= 0 || deposit >= amountTotal)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Сумма слишком мала, чтобы разделить её на два платежа",
        });
      }

      const [updated] = await tx
        .update(productOrders)
        .set({
          amountProducts,
          amountDelivery,
          amountTotal,
          leadTime: input.leadTime || null,
          ...(input.approve && {
            status: "awaiting_deposit" as const,
            depositAmount: deposit,
            approvedAt: now,
            paymentDueAt: paymentDueFrom(now),
          }),
        })
        .where(eq(productOrders.id, input.id))
        .returning({ id: productOrders.id, status: productOrders.status });
      if (!updated) throw conflict();
      return updated;
    }),
  );

/** Отказ по заявке: покупатель увидит причину на странице заказа. */
export const decline = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      reason: z.string().trim().min(1, "Укажите причину").max(1000),
    }),
  )
  .handler(({ context, input }) =>
    transition(context.db, input.id, ["requested", "awaiting_deposit"], {
      status: "declined",
      declineReason: input.reason,
      paymentDueAt: null,
    }),
  );

/** Вернуть одобренную, но не оплаченную заявку на согласование — чтобы изменить условия. */
export const reopen = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(({ context, input }) =>
    transition(context.db, input.id, ["awaiting_deposit"], {
      status: "requested",
      depositAmount: null,
      approvedAt: null,
      paymentDueAt: null,
    }),
  );

/**
 * Изделие готово: мастер уточняет доставку и выставляет доплату — остаток
 * стоимости изделий плюс доставка.
 */
export const requestBalance = adminProcedure
  .input(z.object({ id: z.string().min(1), amountDelivery: rublesSchema }))
  .handler(async ({ context, input }) => {
    const [order] = await context.db
      .select({
        amountProducts: productOrders.amountProducts,
        depositAmount: productOrders.depositAmount,
      })
      .from(productOrders)
      .where(eq(productOrders.id, input.id));
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

    const amountDelivery = toKopecks(input.amountDelivery);
    const amountTotal = order.amountProducts + amountDelivery;
    if (order.depositAmount === null || amountTotal <= order.depositAmount) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Доплачивать нечего — проверьте суммы",
      });
    }
    const now = new Date();
    return transition(context.db, input.id, ["in_production"], {
      status: "awaiting_balance",
      amountDelivery,
      amountTotal,
      paymentDueAt: paymentDueFrom(now),
    });
  });

/** Ещё 3 дня на оплату — например, если срок вышел, а покупатель на связи. */
export const extendPayment = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(({ context, input }) =>
    transition(context.db, input.id, ["awaiting_deposit", "awaiting_balance"], {
      paymentDueAt: paymentDueFrom(new Date()),
    }),
  );

/**
 * Отмена заказа под заказ после предоплаты, до отправки. До предоплаты
 * заявку отклоняют (decline). Полученные деньги возвращаются вручную в
 * кабинете ЮKassa.
 */
export const cancel = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(({ context, input }) =>
    transition(
      context.db,
      input.id,
      ["in_production", "awaiting_balance", "ready_to_ship"],
      { status: "canceled", paymentDueAt: null },
    ),
  );
