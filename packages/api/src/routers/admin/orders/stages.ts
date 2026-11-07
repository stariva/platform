import { ORPCError } from "@orpc/server";
import {
  and,
  type Database,
  eq,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  productOrderItems,
  productOrders,
  type SQL,
  sql,
} from "@stariva/db";
import { madeToOrderParcelSchema } from "@stariva/web-api/contract";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { quoteStorefrontMadeToOrderDelivery } from "../../../storefront";
import { emailCustomer } from "./customer-email";
import { depositFor, paymentDueFrom, toKopecks } from "./stage-math";

/*
 * Этапы заказа под заказ, которые двигает мастер:
 * заявка → (условия, одобрение) → предоплата → изготовление → доплата → отправка.
 * Оплаты и создание отправления Ozon двигает webhook YooKassa на сайте, а не админка.
 */

type OrderRow = typeof productOrders.$inferSelect;
type OrderStatus = OrderRow["status"];

const rublesSchema = z.number().finite().nonnegative().max(10_000_000);

const conflict = (message = "Заказ изменился, обновите страницу") =>
  new ORPCError("CONFLICT", { message });

/**
 * Переводит заказ под заказ из одного из статусов `from`; CONFLICT, если он уже
 * в другом. `guard` — ещё одно условие той же записи: проверка отдельным
 * запросом не успела бы за покупателем или вебхуком.
 */
async function transition(
  db: Database,
  id: string,
  from: OrderStatus[],
  set: Partial<typeof productOrders.$inferInsert>,
  { guard, message }: { guard?: SQL; message?: string } = {},
) {
  const [updated] = await db
    .update(productOrders)
    .set(set)
    .where(
      and(
        eq(productOrders.id, id),
        eq(productOrders.kind, "made_to_order"),
        inArray(productOrders.status, from),
        guard,
      ),
    )
    .returning({ id: productOrders.id, status: productOrders.status });
  if (!updated) throw conflict(message);
  return updated;
}

/**
 * Расчёт доставки, сохранённый в заказе, ещё на месте и на ту же сумму.
 * Смена пункта покупателем стирает расчёт, поэтому доплату по расчёту до
 * старого пункта эта проверка не пропустит.
 */
const quoteStillValid = (amountDelivery: number) =>
  and(
    isNotNull(productOrders.checkoutSnapshot),
    sql`(${productOrders.checkoutSnapshot} ->> 'priceKopecks')::int = ${amountDelivery}`,
  );

/**
 * Сколько отправление Ozon может создаваться, прежде чем попытка считается
 * брошенной. Столько же в claimMadeToOrderShipment (apps/web, orders.ts).
 */
const SHIPMENT_ATTEMPT_LEASE_MS = 15 * 60_000;

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
  .handler(async ({ context, input }) => {
    const updated = await context.db.transaction(async (tx) => {
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
    });
    if (input.approve) await emailCustomer(context.db, updated.id);
    return updated;
  });

/** Отказ по заявке: покупатель увидит причину на странице заказа. */
export const decline = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      reason: z.string().trim().min(1, "Укажите причину").max(1000),
    }),
  )
  .handler(async ({ context, input }) => {
    const updated = await transition(
      context.db,
      input.id,
      ["requested", "awaiting_deposit"],
      { status: "declined", declineReason: input.reason, paymentDueAt: null },
    );
    await emailCustomer(context.db, updated.id);
    return updated;
  });

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

/** Выставляет доплату: остаток стоимости изделий плюс доставка в копейках. */
async function billBalance(
  db: Database,
  id: string,
  amountDelivery: number,
  set: Partial<typeof productOrders.$inferInsert> = {},
  options: { guard?: SQL; message?: string } = {},
) {
  const [order] = await db
    .select({
      amountProducts: productOrders.amountProducts,
      depositAmount: productOrders.depositAmount,
    })
    .from(productOrders)
    .where(eq(productOrders.id, id));
  if (!order) throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

  const amountTotal = order.amountProducts + amountDelivery;
  if (amountTotal > 2_147_483_647) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Сумма заказа слишком велика — проверьте цены и стоимость доставки",
    });
  }
  if (order.depositAmount === null || amountTotal <= order.depositAmount) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Доплачивать нечего — проверьте суммы",
    });
  }
  const updated = await transition(
    db,
    id,
    ["in_production"],
    {
      ...set,
      status: "awaiting_balance",
      amountDelivery,
      amountTotal,
      paymentDueAt: paymentDueFrom(new Date()),
    },
    options,
  );
  await emailCustomer(db, updated.id);
  return updated;
}

/**
 * Изделие готово, обычный путь: мастер указывает вес и размеры посылки, витрина
 * считает доставку до пункта покупателя, и эта сумма входит в доплату. Если Ozon
 * не посчитал, заказ остаётся в изготовлении и мастер видит причину.
 */
export const requestBalanceWithOzon = adminProcedure
  .input(z.object({ id: z.string().min(1), parcel: madeToOrderParcelSchema }))
  .handler(async ({ context, input }) => {
    const quote = await quoteStorefrontMadeToOrderDelivery(
      input.id,
      input.parcel,
    );
    if (!quote.available) {
      throw new ORPCError("CONFLICT", {
        message: quote.reason ?? "Ozon не посчитал доставку",
      });
    }
    // Пока шёл расчёт, покупатель мог сменить пункт: тогда расчёт стёрт, и
    // доплата по нему оставила бы оплаченный заказ без отправления
    return billBalance(
      context.db,
      input.id,
      quote.deliveryPriceKopecks,
      {},
      {
        guard: quoteStillValid(quote.deliveryPriceKopecks),
        message:
          "Покупатель сменил пункт выдачи или заказ изменился — обновите страницу и посчитайте доставку заново",
      },
    );
  });

/**
 * Запасной путь: Ozon не считает доставку или мастер отправит заказ сама и
 * указывает стоимость вручную. Без расчёта в заказе отправление в Ozon после
 * такой доплаты не создаётся.
 */
export const requestBalance = adminProcedure
  .input(z.object({ id: z.string().min(1), amountDelivery: rublesSchema }))
  .handler(({ context, input }) =>
    billBalance(context.db, input.id, toKopecks(input.amountDelivery), {
      checkoutSnapshot: null,
    }),
  );

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
 * кабинете ЮKassa. Пока сайт создаёт отправление Ozon, отменить нельзя:
 * отправление всё равно создалось бы, а деньги мастер уже вернула бы.
 */
export const cancel = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const updated = await transition(
      context.db,
      input.id,
      [
        "in_production",
        "awaiting_balance",
        "ready_to_ship",
        "ozon_order_failed",
      ],
      { status: "canceled", paymentDueAt: null },
      {
        // Брошенная попытка (сайт упал на полпути) отмене не мешает
        guard: or(
          ne(productOrders.ozonShipmentStatus, "creating"),
          lte(
            productOrders.ozonShipmentAttemptedAt,
            new Date(Date.now() - SHIPMENT_ATTEMPT_LEASE_MS),
          ),
        ),
        message:
          "Сайт сейчас создаёт отправление Ozon — отмените заказ через пару минут",
      },
    );
    await emailCustomer(context.db, updated.id);
    return updated;
  });
