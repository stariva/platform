import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import {
  type CampaignAttribution,
  productOrderItems,
  productOrderPayments,
  productOrders,
  products,
  user,
  type VisitorInfo,
} from "@stariva/db/schema";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
  PickupPoint,
} from "@/lib/ozon-delivery/types";
import type { MadeToOrderPaymentType } from "./made-to-order-flow";
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
  attribution?: CampaignAttribution | null;
  visitor?: VisitorInfo | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  /** Комментарий покупателя к заказу — попадает в customerNotes. */
  comment?: string;
  items: OrderLineInput[];
  delivery: DeliverySelection;
  /** Выбранный пункт выдачи — чтобы мастер видел его адрес, а не только id. */
  pickupPoint?: PickupPoint | null;
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
  attribution?: CampaignAttribution | null;
  visitor?: VisitorInfo | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  customerNotes?: string;
  deliveryPointId: string;
  /** Адрес пункта; null — Ozon сейчас не ответил, заявку всё равно принимаем. */
  pickupPoint: PickupPoint | null;
  items: MadeToOrderLineInput[];
}

/** Адрес пункта выдачи для заказа: его показываем покупателю и мастеру. */
function pickupPointAddress(point: PickupPoint | null | undefined) {
  return point
    ? {
        address: point.address,
        title: point.title,
        locality: point.locality,
        kind: point.kind,
        lat: point.latitude,
        lng: point.longitude,
      }
    : null;
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
 * Заявка на изделия под заказ: без оплаты. Цены из каталога — стартовые,
 * мастер согласует с покупателем итог и выставляет предоплату. Покупатель
 * выбирает пункт выдачи сразу, а расчёт Ozon будет, когда изделие готово.
 */
export async function createMadeToOrderOrder(
  input: CreateMadeToOrderOrderInput,
): Promise<{ id: string; number: number; amountTotal: number }> {
  const orderId = randomUUID();
  const amountProducts = input.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
  assertValidOrderTotal(amountProducts);

  const [created] = await db
    .insert(productOrders)
    .values({
      id: orderId,
      kind: "made_to_order",
      userId: input.userId ?? null,
      attribution: input.attribution ?? null,
      visitor: input.visitor ?? null,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail ?? null,
      status: "requested",
      amountProducts,
      amountDelivery: 0,
      amountTotal: amountProducts,
      currency: "RUB",
      deliveryMethod: "pickup",
      deliveryPointId: input.deliveryPointId,
      deliveryAddress: pickupPointAddress(input.pickupPoint),
      customerNotes: input.customerNotes || null,
    })
    .returning({ number: productOrders.number });
  if (!created) throw new Error("product_order_not_created");

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

  return { id: orderId, number: created.number, amountTotal: amountProducts };
}

/** Создаёт заказ на товары в статусе pending вместе с его позициями. */
export async function createProductOrder(
  input: CreateProductOrderInput,
): Promise<{ id: string; number: number; amountTotal: number }> {
  const orderId = randomUUID();
  const amountProducts = input.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
  const amountDelivery = input.checkout.deliveryPriceKopecks;
  const amountTotal = amountProducts + amountDelivery;
  assertValidOrderTotal(amountTotal);

  const [created] = await db
    .insert(productOrders)
    .values({
      id: orderId,
      userId: input.userId ?? null,
      attribution: input.attribution ?? null,
      visitor: input.visitor ?? null,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail ?? null,
      status: "pending",
      amountProducts,
      amountDelivery,
      amountTotal,
      currency: "RUB",
      customerNotes: input.comment || null,
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
          : pickupPointAddress(input.pickupPoint),
      checkoutSnapshot: input.checkout,
    })
    .returning({ number: productOrders.number });
  if (!created) throw new Error("product_order_not_created");

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

  return { id: orderId, number: created.number, amountTotal };
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

/**
 * Куда писать покупателю: email из заказа, а если его не оставили —
 * email аккаунта, из которого оформлен заказ.
 */
export async function getProductOrderCustomerEmail(order: {
  contactEmail: string | null;
  userId: string | null;
}): Promise<string | null> {
  if (order.contactEmail) return order.contactEmail;
  if (!order.userId) return null;
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, order.userId))
    .limit(1);
  return rows[0]?.email ?? null;
}

/**
 * Обложки товаров по slug — для писем покупателю. Позиция хранит снапшот
 * названия и цены, а товар мог исчезнуть из каталога: тогда его нет в словаре.
 */
export async function getProductCoverImages(
  slugs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ slug: products.slug, images: products.images })
    .from(products)
    .where(inArray(products.slug, unique));
  return new Map(
    rows.flatMap((row) => (row.images[0] ? [[row.slug, row.images[0]]] : [])),
  );
}

export async function getProductOrderItems(orderId: string) {
  return db
    .select()
    .from(productOrderItems)
    .where(eq(productOrderItems.orderId, orderId));
}

/**
 * Идемпотентно помечает заказ готовых изделий оплаченным и списывает проданное
 * с остатка. Возвращает true, если статус реально сменился. Списание идёт
 * только при смене статуса, поэтому повторный webhook остаток не трогает.
 * Заказы под заказ оплачиваются по этапам — см. applyMadeToOrderPayment.
 */
export async function markProductOrderPaid(orderId: string): Promise<boolean> {
  const result = await db
    .update(productOrders)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.kind, "stock"),
        eq(productOrders.status, "pending"),
      ),
    )
    .returning({ id: productOrders.id });
  if (result.length === 0) return false;

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

/**
 * То же для изделия под заказ: оплачено полностью и доставка посчитана через
 * Ozon. Заказ с ручной доставкой (без расчёта) сюда не попадает.
 */
export async function claimMadeToOrderShipment(
  orderId: string,
): Promise<string | null> {
  const attemptId = randomUUID();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const result = await db
    .update(productOrders)
    .set({
      status: "ready_to_ship",
      ozonShipmentStatus: "creating",
      ozonShipmentAttemptId: attemptId,
      ozonShipmentAttemptedAt: now,
    })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.kind, "made_to_order"),
        inArray(productOrders.status, ["ready_to_ship", "ozon_order_failed"]),
        isNull(productOrders.ozonOrderId),
        isNotNull(productOrders.checkoutSnapshot),
        or(
          inArray(productOrders.ozonShipmentStatus, ["stock_held", "failed"]),
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

/**
 * Покупатель дополняет детали, пока мастер не одобрил заявку: после одобрения
 * цена и сроки зафиксированы, и менять что-то можно только через мастера.
 */
const DETAILS_EDITABLE_STATUSES = ["requested"] as const;

/**
 * Пункт выдачи можно менять дольше: изделие плетётся неделями. Когда доплата
 * выставлена, в ней уже посчитана доставка до этого пункта.
 */
const DELIVERY_POINT_EDITABLE_STATUSES = [
  "requested",
  "awaiting_deposit",
  "in_production",
] as const;

export function isDeliveryPointEditable(order: {
  kind: string;
  status: string;
}): boolean {
  return (
    order.kind === "made_to_order" &&
    (DELIVERY_POINT_EDITABLE_STATUSES as readonly string[]).includes(
      order.status,
    )
  );
}

/** Покупатель выбрал пункт. false — заказ уже нельзя менять. */
export async function setMadeToOrderDeliveryPoint(
  orderId: string,
  pointId: string,
  point: PickupPoint | null,
): Promise<boolean> {
  const updated = await db
    .update(productOrders)
    .set({
      deliveryMethod: "pickup",
      deliveryPointId: pointId,
      deliveryAddress: pickupPointAddress(point),
      // Расчёт был до старого пункта; новый посчитает кнопка мастера
      checkoutSnapshot: null,
    })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.kind, "made_to_order"),
        inArray(productOrders.status, [...DELIVERY_POINT_EDITABLE_STATUSES]),
      ),
    )
    .returning({ id: productOrders.id });
  return updated.length > 0;
}

/**
 * Изделие готово: с этого момента оно считается в остатке Ozon. Отметка
 * остаётся и при неудачном расчёте — повторное нажатие ничего не теряет.
 */
export async function holdMadeToOrderStock(orderId: string): Promise<boolean> {
  const updated = await db
    .update(productOrders)
    .set({ ozonShipmentStatus: "stock_held" })
    .where(
      and(
        eq(productOrders.id, orderId),
        eq(productOrders.kind, "made_to_order"),
        eq(productOrders.status, "in_production"),
        isNull(productOrders.ozonOrderId),
      ),
    )
    .returning({ id: productOrders.id });
  return updated.length > 0;
}

/** SKU Ozon по товарам каталога; товара без SKU в словаре нет. */
export async function getProductOzonSkus(
  slugs: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ slug: products.slug, ozonSku: products.ozonSku })
    .from(products)
    .where(inArray(products.slug, unique));
  return new Map(
    rows.flatMap((row) =>
      row.ozonSku === null ? [] : [[row.slug, row.ozonSku]],
    ),
  );
}

/** Запоминает расчёт Ozon и SKU позиций: они нужны для создания отправления. */
export async function saveMadeToOrderQuote(
  orderId: string,
  quote: DeliveryCheckoutResponse,
  skuByItemId: Map<string, number>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(productOrders)
      .set({ checkoutSnapshot: quote })
      .where(eq(productOrders.id, orderId));
    for (const [itemId, ozonSku] of skuByItemId) {
      await tx
        .update(productOrderItems)
        .set({ ozonSku })
        .where(eq(productOrderItems.id, itemId));
    }
  });
}

/** Свежий расчёт перед созданием отправления: даты покупатель видит на странице. */
export async function saveOrderCheckoutSnapshot(
  orderId: string,
  quote: DeliveryCheckoutResponse,
): Promise<void> {
  await db
    .update(productOrders)
    .set({ checkoutSnapshot: quote })
    .where(eq(productOrders.id, orderId));
}

export interface MadeToOrderDetailsInput {
  /** Мерки и комментарий по позициям заказа; позиции не из заказа пропускаются. */
  items: {
    id: string;
    measurements: { label: string; value: string }[];
    comment?: string;
  }[];
  customerNotes?: string;
}

/**
 * Покупатель дополняет заявку под заказ: мерки и пожелания.
 * Размер и цвет выбраны в заявке и здесь не меняются — их правит мастер по
 * согласованию. Возвращает false, если заказ уже нельзя дополнять.
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
 * Занимает право отправить мастеру уведомление о заказе — оплаченном или новой
 * заявке под заказ: ровно один обработчик получит true. Если отправка не
 * удалась, право возвращается — следующая попытка отправит ещё раз.
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

// ─── Оплата заказа под заказ по этапам ─────────────────────────────────────

/** Неоплаченную ссылку на тот же этап и сумму отдаём повторно, пока она свежая. */
const PAYMENT_LINK_REUSE_MS = 30 * 60_000;

/** Свежий неоплаченный платёж на тот же этап и сумму — чтобы повторное «Оплатить» не плодило платежи. */
export async function findReusableOrderPayment(
  orderId: string,
  type: MadeToOrderPaymentType,
  amount: number,
) {
  const rows = await db
    .select()
    .from(productOrderPayments)
    .where(
      and(
        eq(productOrderPayments.orderId, orderId),
        eq(productOrderPayments.type, type),
        eq(productOrderPayments.amount, amount),
        eq(productOrderPayments.status, "pending"),
        isNotNull(productOrderPayments.confirmationUrl),
        gt(
          productOrderPayments.createdAt,
          new Date(Date.now() - PAYMENT_LINK_REUSE_MS),
        ),
      ),
    )
    .orderBy(desc(productOrderPayments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Создаёт строку платежа до обращения к YooKassa: её id — ключ идемпотентности. */
export async function createOrderPayment(
  orderId: string,
  type: MadeToOrderPaymentType,
  amount: number,
): Promise<string> {
  const id = randomUUID();
  await db
    .insert(productOrderPayments)
    .values({ id, orderId, type, amount, status: "pending" });
  return id;
}

export async function attachOrderPaymentConfirmation(
  id: string,
  yookassaPaymentId: string,
  confirmationUrl: string,
): Promise<void> {
  await db
    .update(productOrderPayments)
    .set({ yookassaPaymentId, confirmationUrl })
    .where(eq(productOrderPayments.id, id));
}

export async function getOrderPayment(id: string) {
  const rows = await db
    .select()
    .from(productOrderPayments)
    .where(eq(productOrderPayments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listOrderPayments(orderId: string) {
  return db
    .select()
    .from(productOrderPayments)
    .where(eq(productOrderPayments.orderId, orderId));
}

export async function markOrderPaymentCanceled(id: string): Promise<void> {
  await db
    .update(productOrderPayments)
    .set({ status: "canceled" })
    .where(
      and(
        eq(productOrderPayments.id, id),
        eq(productOrderPayments.status, "pending"),
      ),
    );
}

/** Отмечает платёж оплаченным; true — только при первой отметке, повторный webhook получит false. */
export async function markOrderPaymentSucceeded(id: string): Promise<boolean> {
  const result = await db
    .update(productOrderPayments)
    .set({ status: "succeeded", paidAt: new Date() })
    .where(
      and(
        eq(productOrderPayments.id, id),
        ne(productOrderPayments.status, "succeeded"),
      ),
    )
    .returning({ id: productOrderPayments.id });
  return result.length > 0;
}

/**
 * Продвигает заказ после оплаченного этапа: предоплата — в изготовление,
 * доплата — к отправке. Сумма должна совпасть с тем, что заказ ждёт сейчас:
 * если мастер успел изменить условия или заказ отменён, возвращает false,
 * и оплату разбирают вручную. Срок оплаты здесь не проверяется — деньги уже
 * пришли, а ссылка была выдана до срока.
 */
export async function applyMadeToOrderPayment(
  orderId: string,
  type: MadeToOrderPaymentType,
  amount: number,
): Promise<boolean> {
  const now = new Date();
  const result =
    type === "deposit"
      ? await db
          .update(productOrders)
          .set({
            status: "in_production",
            depositPaidAt: now,
            paymentDueAt: null,
          })
          .where(
            and(
              eq(productOrders.id, orderId),
              eq(productOrders.kind, "made_to_order"),
              eq(productOrders.status, "awaiting_deposit"),
              eq(productOrders.depositAmount, amount),
            ),
          )
          .returning({ id: productOrders.id })
      : await db
          .update(productOrders)
          .set({ status: "ready_to_ship", paidAt: now, paymentDueAt: null })
          .where(
            and(
              eq(productOrders.id, orderId),
              eq(productOrders.kind, "made_to_order"),
              eq(productOrders.status, "awaiting_balance"),
              sql`${productOrders.amountTotal} - ${productOrders.depositAmount} = ${amount}`,
            ),
          )
          .returning({ id: productOrders.id });
  return result.length > 0;
}

/** Право один раз сообщить мастеру об оплате этапа; при сбое отправки его возвращают. */
export async function claimPaymentNotification(id: string): Promise<boolean> {
  const result = await db
    .update(productOrderPayments)
    .set({ staffNotifiedAt: new Date() })
    .where(
      and(
        eq(productOrderPayments.id, id),
        isNull(productOrderPayments.staffNotifiedAt),
      ),
    )
    .returning({ id: productOrderPayments.id });
  return result.length > 0;
}

export async function releasePaymentNotification(id: string): Promise<void> {
  await db
    .update(productOrderPayments)
    .set({ staffNotifiedAt: null })
    .where(eq(productOrderPayments.id, id));
}
