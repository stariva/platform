import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { productOrderItems, productOrders, products } from "@stariva/db/schema";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
} from "@/lib/ozon-delivery/types";
import type { MadeToOrderOptions } from "./made-to-order-options";

export interface OrderLineInput {
  productSlug: string;
  ozonSku: number;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateProductOrderInput {
  userId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  items: OrderLineInput[];
  delivery: DeliverySelection;
  checkout: DeliveryCheckoutResponse;
}

export interface MadeToOrderLineInput {
  productSlug: string;
  name: string;
  price: number;
  quantity: number;
  options: MadeToOrderOptions;
}

export interface CreateMadeToOrderOrderInput {
  userId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  customerNotes?: string;
  items: MadeToOrderLineInput[];
}

function assertValidOrderTotal(amountTotal: number) {
  if (
    !Number.isSafeInteger(amountTotal) ||
    amountTotal <= 0 ||
    amountTotal > 2_147_483_647
  ) {
    throw new Error("invalid_product_order_total");
  }
}

/**
 * Заказ изделий под заказ: оплата 100% на сайте, доставку мастер согласует
 * после оплаты, поэтому ни пункта выдачи, ни расчёта Ozon здесь нет.
 */
export async function createMadeToOrderOrder(
  input: CreateMadeToOrderOrderInput,
): Promise<{ id: string; amountTotal: number }> {
  const orderId = randomUUID();
  const amountProducts = input.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
  assertValidOrderTotal(amountProducts);

  await db.insert(productOrders).values({
    id: orderId,
    kind: "made_to_order",
    userId: input.userId ?? null,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    status: "pending",
    amountProducts,
    amountDelivery: 0,
    amountTotal: amountProducts,
    currency: "RUB",
    deliveryMethod: "manual",
    customerNotes: input.customerNotes || null,
  });

  await db.insert(productOrderItems).values(
    input.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productSlug: item.productSlug,
      ozonSku: null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      options: item.options,
    })),
  );

  return { id: orderId, amountTotal: amountProducts };
}

/** Создаёт заказ на товары в статусе pending вместе с его позициями. */
export async function createProductOrder(
  input: CreateProductOrderInput,
): Promise<{ id: string; amountTotal: number }> {
  const orderId = randomUUID();
  const amountProducts = input.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
  const amountDelivery = input.checkout.deliveryPriceKopecks;
  const amountTotal = amountProducts + amountDelivery;
  assertValidOrderTotal(amountTotal);

  await db.insert(productOrders).values({
    id: orderId,
    userId: input.userId ?? null,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    status: "pending",
    amountProducts,
    amountDelivery,
    amountTotal,
    currency: "RUB",
    deliveryMethod: input.delivery.method,
    deliveryPointId:
      input.delivery.method === "pickup" ? input.delivery.pointId : null,
    deliveryAddress:
      input.delivery.method === "courier"
        ? {
            address: input.delivery.address,
            lat: input.delivery.latitude,
            lng: input.delivery.longitude,
          }
        : null,
    checkoutSnapshot: input.checkout,
  });

  await db.insert(productOrderItems).values(
    input.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productSlug: item.productSlug,
      ozonSku: item.ozonSku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  );

  return { id: orderId, amountTotal };
}

export async function attachPaymentId(
  orderId: string,
  paymentId: string,
): Promise<void> {
  await db
    .update(productOrders)
    .set({ paymentId })
    .where(eq(productOrders.id, orderId));
}

export async function getProductOrderById(orderId: string) {
  const rows = await db
    .select()
    .from(productOrders)
    .where(eq(productOrders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProductOrderItems(orderId: string) {
  return db
    .select()
    .from(productOrderItems)
    .where(eq(productOrderItems.orderId, orderId));
}

/**
 * Идемпотентно помечает заказ оплаченным и списывает проданное с остатка.
 * Возвращает true, если статус реально сменился. Списание идёт только при
 * смене статуса, поэтому повторный webhook остаток не трогает. Заказ под
 * заказ уходит в «ждёт уточнения» и остаток не трогает — изделие ещё не сплетено.
 */
export async function markProductOrderPaid(orderId: string): Promise<boolean> {
  const result = await db
    .update(productOrders)
    .set({
      status: sql`case when ${productOrders.kind} = 'made_to_order' then 'awaiting_details'::product_order_status else 'paid'::product_order_status end`,
      paidAt: new Date(),
    })
    .where(
      and(eq(productOrders.id, orderId), eq(productOrders.status, "pending")),
    )
    .returning({ id: productOrders.id, kind: productOrders.kind });
  if (result.length === 0) return false;
  if (result[0]?.kind === "made_to_order") return true;

  const items = await getProductOrderItems(orderId);
  for (const item of items) {
    // Не уходим ниже нуля, если два заказа на последнюю штуку оплатили одновременно
    await db
      .update(products)
      .set({
        stockAvailable: sql`greatest(${products.stockAvailable} - ${item.quantity}, 0)`,
      })
      .where(eq(products.slug, item.productSlug));
  }
  return true;
}

export async function markProductOrderCanceled(orderId: string): Promise<void> {
  await db
    .update(productOrders)
    .set({ status: "canceled" })
    .where(
      and(eq(productOrders.id, orderId), eq(productOrders.status, "pending")),
    );
}

/** Claims unfinished Ozon shipment creation for one webhook worker. */
export async function claimProductOrderShipment(
  orderId: string,
): Promise<string | null> {
  const attemptId = randomUUID();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const result = await db
    .update(productOrders)
    .set({
      status: "paid",
      ozonShipmentStatus: "creating",
      ozonShipmentAttemptId: attemptId,
      ozonShipmentAttemptedAt: now,
    })
    .where(
      and(
        eq(productOrders.id, orderId),
        inArray(productOrders.status, ["paid", "ozon_order_failed"]),
        isNull(productOrders.ozonOrderId),
        or(
          inArray(productOrders.ozonShipmentStatus, ["pending", "failed"]),
          and(
            eq(productOrders.ozonShipmentStatus, "creating"),
            lt(productOrders.ozonShipmentAttemptedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning({ id: productOrders.id });
  return result.length > 0 ? attemptId : null;
}

/** Записывает результат успешного v2/order/create и переводит заказ в сборку. */
export async function attachOzonOrder(
  orderId: string,
  attemptId: string,
  ozonOrderId: string,
  postingNumbers: string[],
): Promise<void> {
  await db
    .update(productOrders)
    .set({
      ozonOrderId,
      ozonPostingNumbers: postingNumbers,
      ozonShipmentStatus: "created",
      status: "fulfilling",
    })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.ozonShipmentStatus, "creating"),
        eq(productOrders.ozonShipmentAttemptId, attemptId),
      ),
    );
}

/** Помечает заказ как требующий ручной обработки — оплата прошла, но заказ в Ozon не создался. */
export async function markProductOrderOzonFailed(
  orderId: string,
  attemptId: string,
): Promise<void> {
  await db
    .update(productOrders)
    .set({ status: "ozon_order_failed", ozonShipmentStatus: "failed" })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.ozonShipmentStatus, "creating"),
        eq(productOrders.ozonShipmentAttemptId, attemptId),
      ),
    );
}

export async function listUserProductOrders(userId: string) {
  return db
    .select()
    .from(productOrders)
    .where(eq(productOrders.userId, userId));
}

/** Статусы, пока покупатель может дополнять детали заказа под заказ. */
const DETAILS_EDITABLE_STATUSES = [
  "awaiting_details",
  "in_production",
] as const;

export interface MadeToOrderDetailsInput {
  /** Мерки и комментарий по позициям заказа; позиции не из заказа пропускаются. */
  items: {
    id: string;
    measurements: { label: string; value: string }[];
    comment?: string;
  }[];
  customerNotes?: string;
  deliveryNote?: string;
}

/**
 * Покупатель дополняет детали оплаченного заказа под заказ: мерки, пожелания,
 * куда отправить. Размер и цвет уже оплачены и здесь не меняются — их правит
 * мастер по согласованию. Возвращает false, если заказ уже нельзя дополнять.
 */
export async function updateMadeToOrderDetails(
  orderId: string,
  input: MadeToOrderDetailsInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(productOrders)
      .set({
        ...(input.customerNotes !== undefined && {
          customerNotes: input.customerNotes || null,
        }),
        ...(input.deliveryNote !== undefined && {
          deliveryNote: input.deliveryNote || null,
        }),
      })
      .where(
        and(
          eq(productOrders.id, orderId),
          eq(productOrders.kind, "made_to_order"),
          inArray(productOrders.status, [...DETAILS_EDITABLE_STATUSES]),
        ),
      )
      .returning({ id: productOrders.id });
    if (updated.length === 0) return false;

    const existing = new Map(
      (
        await tx
          .select()
          .from(productOrderItems)
          .where(eq(productOrderItems.orderId, orderId))
      ).map((item) => [item.id, item]),
    );
    for (const entry of input.items) {
      const item = existing.get(entry.id);
      if (!item?.options) continue;
      await tx
        .update(productOrderItems)
        .set({
          options: {
            ...item.options,
            measurements: entry.measurements,
            comment: entry.comment || undefined,
          },
        })
        .where(eq(productOrderItems.id, item.id));
    }
    return true;
  });
}

/**
 * Занимает право отправить мастеру уведомление об оплаченном заказе: ровно
 * один обработчик webhook получит true. Если отправка не удалась, право
 * возвращается — повторный webhook попробует ещё раз.
 */
export async function claimStaffNotification(
  orderId: string,
): Promise<boolean> {
  const result = await db
    .update(productOrders)
    .set({ staffNotifiedAt: new Date() })
    .where(
      and(eq(productOrders.id, orderId), isNull(productOrders.staffNotifiedAt)),
    )
    .returning({ id: productOrders.id });
  return result.length > 0;
}

export async function releaseStaffNotification(orderId: string): Promise<void> {
  await db
    .update(productOrders)
    .set({ staffNotifiedAt: null })
    .where(eq(productOrders.id, orderId));
}
