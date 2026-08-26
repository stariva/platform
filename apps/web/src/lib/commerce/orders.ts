import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { productOrderItems, productOrders } from "@stariva/db/schema";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
} from "@/lib/ozon-delivery/types";

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
  if (
    !Number.isSafeInteger(amountTotal) ||
    amountTotal <= 0 ||
    amountTotal > 2_147_483_647
  ) {
    throw new Error("invalid_product_order_total");
  }

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

/** Идемпотентно помечает заказ оплаченным. Возвращает true, если статус реально сменился. */
export async function markProductOrderPaid(orderId: string): Promise<boolean> {
  const result = await db
    .update(productOrders)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(eq(productOrders.id, orderId), eq(productOrders.status, "pending")),
    )
    .returning({ id: productOrders.id });
  return result.length > 0;
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
